-- Durable, immutable audit history for guarded historical Payment corrections.
-- The transaction UUID is intentionally not a foreign key: the currently
-- supported manual-payment hard delete must not erase or block audit history.

begin;

create table public.billing_payment_correction_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_email_link_id uuid not null references public.tool_email_links(id) on delete cascade,
  payment_transaction_id uuid not null,
  payment_source text not null check (payment_source in ('manual', 'renewal')),
  effective_date date not null,
  before_snapshot jsonb not null check (jsonb_typeof(before_snapshot) = 'object'),
  after_snapshot jsonb not null check (jsonb_typeof(after_snapshot) = 'object'),
  changed_fields text[] not null check (
    cardinality(changed_fields) > 0
    and changed_fields <@ array['payment_date','plan_name','billing_type','currency','amount','status','note']::text[]
  ),
  created_at timestamptz not null default clock_timestamp(),
  constraint billing_payment_correction_changed_check check (before_snapshot <> after_snapshot),
  constraint billing_payment_correction_request_unique unique (user_id, request_id)
);

create index billing_payment_correction_relationship_idx
  on public.billing_payment_correction_events (tool_email_link_id, effective_date desc, created_at desc);
create index billing_payment_correction_transaction_idx
  on public.billing_payment_correction_events (payment_transaction_id, created_at asc);

alter table public.billing_payment_correction_events enable row level security;
create policy "Users can view own billing payment corrections"
  on public.billing_payment_correction_events for select
  using (auth.uid() = user_id);
revoke insert, update, delete on table public.billing_payment_correction_events from authenticated;
grant select on table public.billing_payment_correction_events to authenticated;

create or replace function public.billing_payment_snapshot(p_transaction public.billing_transactions)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'transactionId', p_transaction.id,
    'relationshipId', p_transaction.tool_email_link_id,
    'source', p_transaction.source,
    'sourceKey', p_transaction.source_key,
    'paymentDate', p_transaction.payment_date,
    'planName', p_transaction.plan_name_snapshot,
    'billingType', p_transaction.billing_type_snapshot,
    'currency', p_transaction.currency,
    'amount', p_transaction.amount,
    'status', p_transaction.status,
    'note', p_transaction.note
  );
$$;

create or replace function public.correct_manual_billing_payment(
  p_relationship_id uuid,
  p_payment_transaction_id uuid,
  p_payment_date date,
  p_plan_name text,
  p_billing_type text,
  p_currency text,
  p_amount numeric(18,6),
  p_status text,
  p_note text,
  p_expected_updated_at timestamptz,
  p_request_id uuid,
  p_local_date date default null
)
returns table (payment_transaction_id uuid, correction_event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_local_date date := coalesce(p_local_date, current_date);
  v_plan_name text := nullif(btrim(p_plan_name), '');
  v_billing_type text := nullif(btrim(p_billing_type), '');
  v_currency text := nullif(upper(btrim(p_currency)), '');
  v_note text := nullif(btrim(p_note), '');
  v_transaction public.billing_transactions%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_changed text[] := array[]::text[];
  v_existing public.billing_payment_correction_events%rowtype;
  v_event_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_request_id is null then raise exception 'A correction request ID is required.'; end if;
  if p_expected_updated_at is null then raise exception 'The original Payment version is required.'; end if;
  if v_local_date > current_date + 1 then raise exception 'The local calendar date cannot be in the future.'; end if;
  if p_payment_date is null or p_payment_date > v_local_date then raise exception 'Enter a valid Payment Date that is not in the future.'; end if;
  if v_billing_type is not null and v_billing_type not in ('Monthly','Yearly','Lifetime','One-time','Top-up') then raise exception 'Enter a valid Billing Type.'; end if;
  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then raise exception 'Enter a valid three-letter currency.'; end if;
  if p_amount is not null and p_amount < 0 then raise exception 'Amount must be zero or greater.'; end if;
  if p_status not in ('Paid','Refunded','Failed','Pending') then raise exception 'Enter a valid Payment Status.'; end if;

  select event.* into v_existing from public.billing_payment_correction_events as event
  where event.user_id = v_user_id and event.request_id = p_request_id;
  if found then
    if v_existing.tool_email_link_id <> p_relationship_id
      or v_existing.payment_transaction_id <> p_payment_transaction_id
      or v_existing.payment_source <> 'manual'
      or v_existing.after_snapshot->>'paymentDate' is distinct from p_payment_date::text
      or coalesce(v_existing.after_snapshot->>'planName', '') is distinct from coalesce(v_plan_name, '')
      or coalesce(v_existing.after_snapshot->>'billingType', '') is distinct from coalesce(v_billing_type, '')
      or coalesce(v_existing.after_snapshot->>'currency', '') is distinct from coalesce(v_currency, '')
      or coalesce(v_existing.after_snapshot->>'amount', '') is distinct from coalesce(p_amount::text, '')
      or v_existing.after_snapshot->>'status' is distinct from p_status
      or coalesce(v_existing.after_snapshot->>'note', '') is distinct from coalesce(v_note, '') then
      raise exception 'This correction request ID was already used for different values.';
    end if;
    return query select p_payment_transaction_id, v_existing.id;
    return;
  end if;

  select transaction.* into v_transaction
  from public.billing_transactions as transaction
  join public.tool_email_links as link on link.id = transaction.tool_email_link_id
  where transaction.id = p_payment_transaction_id
    and transaction.tool_email_link_id = p_relationship_id
    and transaction.user_id = v_user_id
    and transaction.source = 'manual'
    and link.user_id = v_user_id and link.unlinked_at is null
  for update of transaction, link;
  if not found then raise exception 'This manual Payment or account relationship changed.'; end if;
  if v_transaction.updated_at is distinct from p_expected_updated_at then raise exception 'This Payment changed after editing began. Refresh and try again.'; end if;

  v_before := public.billing_payment_snapshot(v_transaction);
  if v_transaction.payment_date is distinct from p_payment_date then v_changed := array_append(v_changed, 'payment_date'); end if;
  if v_transaction.plan_name_snapshot is distinct from v_plan_name then v_changed := array_append(v_changed, 'plan_name'); end if;
  if v_transaction.billing_type_snapshot is distinct from v_billing_type then v_changed := array_append(v_changed, 'billing_type'); end if;
  if v_transaction.currency is distinct from v_currency then v_changed := array_append(v_changed, 'currency'); end if;
  if v_transaction.amount is distinct from p_amount then v_changed := array_append(v_changed, 'amount'); end if;
  if v_transaction.status is distinct from p_status then v_changed := array_append(v_changed, 'status'); end if;
  if v_transaction.note is distinct from v_note then v_changed := array_append(v_changed, 'note'); end if;
  if cardinality(v_changed) = 0 then
    return query select p_payment_transaction_id, null::uuid;
    return;
  end if;

  update public.billing_transactions as transaction
  set payment_date = p_payment_date, plan_name_snapshot = v_plan_name,
    billing_type_snapshot = v_billing_type, currency = v_currency, amount = p_amount,
    status = p_status, note = v_note
  where transaction.id = p_payment_transaction_id and transaction.user_id = v_user_id;
  select transaction.* into v_transaction from public.billing_transactions as transaction
  where transaction.id = p_payment_transaction_id;
  v_after := public.billing_payment_snapshot(v_transaction);
  insert into public.billing_payment_correction_events (
    request_id, user_id, tool_email_link_id, payment_transaction_id, payment_source,
    effective_date, before_snapshot, after_snapshot, changed_fields
  ) values (
    p_request_id, v_user_id, p_relationship_id, p_payment_transaction_id, 'manual',
    p_payment_date, v_before, v_after, v_changed
  ) returning id into v_event_id;
  return query select p_payment_transaction_id, v_event_id;
end;
$$;

drop function if exists public.update_billing_renewal_payment(uuid, uuid, uuid, date, text, numeric, date);
create or replace function public.update_billing_renewal_payment(
  p_relationship_id uuid,
  p_period_id uuid,
  p_payment_transaction_id uuid,
  p_payment_date date,
  p_plan_name text,
  p_billing_type text,
  p_currency text,
  p_amount numeric(18,6),
  p_expected_updated_at timestamptz,
  p_request_id uuid,
  p_local_date date default null
)
returns table (period_id uuid, payment_transaction_id uuid, correction_event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_local_date date := coalesce(p_local_date, current_date);
  v_plan_name text := nullif(btrim(p_plan_name), '');
  v_currency text := nullif(upper(btrim(p_currency)), '');
  v_transaction public.billing_transactions%rowtype;
  v_period public.billing_renewal_periods%rowtype;
  v_locked record;
  v_before jsonb;
  v_after jsonb;
  v_changed text[] := array[]::text[];
  v_existing public.billing_payment_correction_events%rowtype;
  v_event_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_request_id is null then raise exception 'A correction request ID is required.'; end if;
  if p_expected_updated_at is null then raise exception 'The original Payment version is required.'; end if;
  if v_local_date > current_date + 1 then raise exception 'The local calendar date cannot be in the future.'; end if;
  if p_payment_date is null or p_payment_date > v_local_date then raise exception 'Enter a valid Payment Date that is not in the future.'; end if;
  if p_billing_type not in ('Monthly','Yearly') then raise exception 'Renewal Payments can only use Monthly or Yearly Billing Type.'; end if;
  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then raise exception 'Enter a valid three-letter currency.'; end if;
  if p_amount is not null and p_amount < 0 then raise exception 'Amount must be zero or greater.'; end if;

  select event.* into v_existing from public.billing_payment_correction_events as event
  where event.user_id = v_user_id and event.request_id = p_request_id;
  if found then
    if v_existing.tool_email_link_id <> p_relationship_id
      or v_existing.payment_transaction_id <> p_payment_transaction_id
      or v_existing.payment_source <> 'renewal'
      or v_existing.after_snapshot->>'paymentDate' is distinct from p_payment_date::text
      or coalesce(v_existing.after_snapshot->>'planName', '') is distinct from coalesce(v_plan_name, '')
      or v_existing.after_snapshot->>'billingType' is distinct from p_billing_type
      or coalesce(v_existing.after_snapshot->>'currency', '') is distinct from coalesce(v_currency, '')
      or coalesce(v_existing.after_snapshot->>'amount', '') is distinct from coalesce(p_amount::text, '') then
      raise exception 'This correction request ID was already used for different values.';
    end if;
    return query select p_period_id, p_payment_transaction_id, v_existing.id;
    return;
  end if;

  select period as period_row, transaction as transaction_row into v_locked
  from public.billing_renewal_periods as period
  join public.tool_email_links as link on link.id = period.tool_email_link_id
  join public.billing_transactions as transaction on transaction.id = period.payment_transaction_id
  where period.id = p_period_id and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id and period.resolution = 'paid'
    and period.payment_transaction_id = p_payment_transaction_id and period.excluded_at is null
    and link.user_id = v_user_id and link.unlinked_at is null
    and transaction.user_id = v_user_id and transaction.tool_email_link_id = p_relationship_id
    and transaction.source = 'renewal' and transaction.source_key = 'renewal-period:' || p_period_id::text
  for update of period, link, transaction;
  if not found then raise exception 'The renewal period, relationship, or generated Payment changed.'; end if;
  v_period := v_locked.period_row;
  v_transaction := v_locked.transaction_row;
  if v_transaction.updated_at is distinct from p_expected_updated_at then raise exception 'This Payment changed after editing began. Refresh and try again.'; end if;

  v_before := public.billing_payment_snapshot(v_transaction);
  if v_transaction.payment_date is distinct from p_payment_date then v_changed := array_append(v_changed, 'payment_date'); end if;
  if v_transaction.plan_name_snapshot is distinct from v_plan_name then v_changed := array_append(v_changed, 'plan_name'); end if;
  if v_transaction.billing_type_snapshot is distinct from p_billing_type then v_changed := array_append(v_changed, 'billing_type'); end if;
  if v_transaction.currency is distinct from v_currency then v_changed := array_append(v_changed, 'currency'); end if;
  if v_transaction.amount is distinct from p_amount then v_changed := array_append(v_changed, 'amount'); end if;
  if cardinality(v_changed) = 0 then
    return query select p_period_id, p_payment_transaction_id, null::uuid;
    return;
  end if;

  update public.billing_renewal_periods as period
  set actual_payment_date = p_payment_date, plan_name_snapshot = v_plan_name,
    billing_type_snapshot = p_billing_type, currency_snapshot = v_currency, amount_snapshot = p_amount
  where period.id = p_period_id and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id and period.resolution = 'paid'
    and period.payment_transaction_id = p_payment_transaction_id and period.excluded_at is null;
  if not found then raise exception 'The exact renewal period could not be updated safely.'; end if;
  update public.billing_transactions as transaction
  set payment_date = p_payment_date, plan_name_snapshot = v_plan_name,
    billing_type_snapshot = p_billing_type, currency = v_currency, amount = p_amount
  where transaction.id = p_payment_transaction_id and transaction.user_id = v_user_id
    and transaction.tool_email_link_id = p_relationship_id and transaction.source = 'renewal'
    and transaction.source_key = 'renewal-period:' || p_period_id::text;
  if not found then raise exception 'The exact renewal Payment could not be updated safely.'; end if;
  select transaction.* into v_transaction from public.billing_transactions as transaction
  where transaction.id = p_payment_transaction_id;
  v_after := public.billing_payment_snapshot(v_transaction);
  insert into public.billing_payment_correction_events (
    request_id, user_id, tool_email_link_id, payment_transaction_id, payment_source,
    effective_date, before_snapshot, after_snapshot, changed_fields
  ) values (
    p_request_id, v_user_id, p_relationship_id, p_payment_transaction_id, 'renewal',
    p_payment_date, v_before, v_after, v_changed
  ) returning id into v_event_id;
  return query select p_period_id, p_payment_transaction_id, v_event_id;
end;
$$;

-- All historical edits now pass through a guarded RPC that records the event
-- in the same transaction. Inserts and the existing manual delete remain.
drop policy if exists "billing_transactions_owner_update" on public.billing_transactions;
revoke update on table public.billing_transactions from authenticated;

revoke all on function public.billing_payment_snapshot(public.billing_transactions) from public, anon, authenticated;
revoke all on function public.correct_manual_billing_payment(uuid, uuid, date, text, text, text, numeric, text, text, timestamptz, uuid, date) from public, anon;
revoke all on function public.update_billing_renewal_payment(uuid, uuid, uuid, date, text, text, text, numeric, timestamptz, uuid, date) from public, anon;
grant execute on function public.correct_manual_billing_payment(uuid, uuid, date, text, text, text, numeric, text, text, timestamptz, uuid, date) to authenticated;
grant execute on function public.update_billing_renewal_payment(uuid, uuid, uuid, date, text, text, text, numeric, timestamptz, uuid, date) to authenticated;

commit;
