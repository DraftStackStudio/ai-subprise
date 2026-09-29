-- Checkpoint 3B: guarded renewal decision and correction contracts.
--
-- This migration adds metadata for explicit not-charged decisions and keeps
-- every mutation behind exact relationship/period/transaction RPC guards.
-- Applying it does not resolve periods, create Payments, or change Current
-- Billing values. Derived Next renewal changes only when a resolution RPC is
-- invoked later by the user.

begin;

alter table public.billing_renewal_periods
  add column if not exists not_charged_reason_code text,
  add column if not exists not_charged_reason_text text,
  add column if not exists not_charged_note text;

-- Do not invent a reason for a decision made before this contract existed.
-- The deployment preflight should report such rows before this migration is
-- applied; this guard makes an accidental deployment fail safely as well.
do $$
begin
  if exists (
    select 1
    from public.billing_renewal_periods
    where resolution = 'not_charged'
      and not_charged_reason_code is null
  ) then
    raise exception 'Migration 0028 requires a reason for every existing not-charged renewal period.';
  end if;
end
$$;

alter table public.billing_renewal_periods
  drop constraint if exists billing_renewal_periods_not_charged_reason_check;
alter table public.billing_renewal_periods
  add constraint billing_renewal_periods_not_charged_reason_check
  check (
    (
      resolution is distinct from 'not_charged'
      and not_charged_reason_code is null
      and not_charged_reason_text is null
      and not_charged_note is null
    )
    or (
      resolution = 'not_charged'
      and not_charged_reason_code in (
        'cancelled_subscription',
        'payment_failed',
        'paused',
        'free_or_waived',
        'other'
      )
      and (
        (
          not_charged_reason_code = 'other'
          and nullif(btrim(not_charged_reason_text), '') is not null
        )
        or (
          not_charged_reason_code <> 'other'
          and not_charged_reason_text is null
        )
      )
    )
  );

-- Confirmation has no caller-supplied Payment Date. The generated Payment is
-- initially dated to the immutable scheduled renewal date and may only be
-- corrected later through update_billing_renewal_payment.
drop function if exists public.confirm_billing_renewal_paid(uuid, uuid, date);

create or replace function public.confirm_billing_renewal_paid(
  p_relationship_id uuid,
  p_period_id uuid
)
returns table (period_id uuid, payment_transaction_id uuid, next_renewal_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_component_id uuid;
  v_scheduled_date date;
  v_plan_name text;
  v_billing_type text;
  v_currency text;
  v_amount numeric(18, 6);
  v_resolution text;
  v_payment_id uuid;
  v_existing_payment_id uuid;
  v_tool_id uuid;
  v_login_id uuid;
  v_tool_name text;
  v_account_label text;
  v_account_login text;
  v_next_date date;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;

  select period.billing_component_id, period.scheduled_renewal_date,
    period.plan_name_snapshot, period.billing_type_snapshot, period.currency_snapshot,
    period.amount_snapshot, period.resolution, period.payment_transaction_id,
    link.tool_id, link.email_account_id, tool.name, login.label, login.email_address
  into v_component_id, v_scheduled_date, v_plan_name, v_billing_type, v_currency,
    v_amount, v_resolution, v_existing_payment_id, v_tool_id, v_login_id,
    v_tool_name, v_account_label, v_account_login
  from public.billing_renewal_periods as period
  join public.tool_email_links as link on link.id = period.tool_email_link_id
  join public.tool_link_billing_components as component on component.id = period.billing_component_id
    and component.tool_email_link_id = period.tool_email_link_id
  left join public.ai_tools as tool on tool.id = link.tool_id
  left join public.logins as login on login.id = link.email_account_id
  where period.id = p_period_id
    and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id
    and link.user_id = v_user_id
    and link.unlinked_at is null
  for update of period, component, link;

  if not found then raise exception 'The renewal period or relationship changed.'; end if;
  if v_resolution = 'paid' and v_existing_payment_id is not null then
    v_next_date := public.recalculate_billing_next_renewal(p_relationship_id, v_component_id);
    return query select p_period_id, v_existing_payment_id, v_next_date;
    return;
  end if;
  if v_resolution is not null then raise exception 'This renewal period has already been resolved.'; end if;

  insert into public.billing_transactions (
    user_id, tool_email_link_id, tool_id, login_id, payment_date,
    tool_name_snapshot, account_label_snapshot, account_login_snapshot,
    plan_name_snapshot, billing_type_snapshot, amount, currency, status,
    note, source, source_key
  ) values (
    v_user_id, p_relationship_id, v_tool_id, v_login_id, v_scheduled_date,
    v_tool_name, v_account_label, v_account_login,
    v_plan_name, v_billing_type, v_amount, v_currency, 'Paid',
    'Recurring renewal explicitly confirmed by user.', 'renewal',
    'renewal-period:' || p_period_id::text
  )
  on conflict (user_id, source, source_key) where source_key is not null do nothing
  returning id into v_payment_id;

  if v_payment_id is null then
    select transaction.id into v_payment_id
    from public.billing_transactions as transaction
    where transaction.user_id = v_user_id
      and transaction.source = 'renewal'
      and transaction.source_key = 'renewal-period:' || p_period_id::text
      and transaction.tool_email_link_id = p_relationship_id;
  end if;
  if v_payment_id is null then raise exception 'The confirmed renewal payment could not be identified.'; end if;

  update public.billing_renewal_periods
  set actual_payment_date = v_scheduled_date,
    resolution = 'paid',
    payment_transaction_id = v_payment_id,
    resolved_at = clock_timestamp(),
    not_charged_reason_code = null,
    not_charged_reason_text = null,
    not_charged_note = null
  where id = p_period_id
    and tool_email_link_id = p_relationship_id
    and resolution is null;
  if not found then raise exception 'The renewal period changed before it could be resolved.'; end if;

  v_next_date := public.recalculate_billing_next_renewal(p_relationship_id, v_component_id);
  return query select p_period_id, v_payment_id, v_next_date;
end;
$$;

drop function if exists public.mark_billing_renewal_not_charged(uuid, uuid);

create or replace function public.mark_billing_renewal_not_charged(
  p_relationship_id uuid,
  p_period_id uuid,
  p_reason_code text,
  p_reason_text text default null,
  p_note text default null
)
returns table (period_id uuid, payment_transaction_id uuid, next_renewal_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_component_id uuid;
  v_resolution text;
  v_existing_reason_code text;
  v_existing_reason_text text;
  v_existing_note text;
  v_reason_code text := lower(btrim(coalesce(p_reason_code, '')));
  v_reason_text text := nullif(btrim(p_reason_text), '');
  v_note text := nullif(btrim(p_note), '');
  v_next_date date;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if v_reason_code not in (
    'cancelled_subscription', 'payment_failed', 'paused', 'free_or_waived', 'other'
  ) then
    raise exception 'Select a valid Not charged reason.';
  end if;
  if v_reason_code = 'other' and v_reason_text is null then
    raise exception 'Enter a reason when Other is selected.';
  end if;
  if v_reason_code <> 'other' then v_reason_text := null; end if;

  select period.billing_component_id, period.resolution,
    period.not_charged_reason_code, period.not_charged_reason_text, period.not_charged_note
  into v_component_id, v_resolution,
    v_existing_reason_code, v_existing_reason_text, v_existing_note
  from public.billing_renewal_periods as period
  join public.tool_email_links as link on link.id = period.tool_email_link_id
  join public.tool_link_billing_components as component on component.id = period.billing_component_id
    and component.tool_email_link_id = period.tool_email_link_id
  where period.id = p_period_id
    and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id
    and link.user_id = v_user_id
    and link.unlinked_at is null
  for update of period, component, link;

  if not found then raise exception 'The renewal period or relationship changed.'; end if;
  if v_resolution = 'not_charged'
    and v_existing_reason_code = v_reason_code
    and v_existing_reason_text is not distinct from v_reason_text
    and v_existing_note is not distinct from v_note then
    v_next_date := public.recalculate_billing_next_renewal(p_relationship_id, v_component_id);
    return query select p_period_id, null::uuid, v_next_date;
    return;
  end if;
  if v_resolution is not null then raise exception 'This renewal period has already been resolved.'; end if;

  update public.billing_renewal_periods
  set actual_payment_date = null,
    resolution = 'not_charged',
    payment_transaction_id = null,
    resolved_at = clock_timestamp(),
    not_charged_reason_code = v_reason_code,
    not_charged_reason_text = v_reason_text,
    not_charged_note = v_note
  where id = p_period_id
    and tool_email_link_id = p_relationship_id
    and resolution is null;
  if not found then raise exception 'The renewal period changed before it could be resolved.'; end if;

  v_next_date := public.recalculate_billing_next_renewal(p_relationship_id, v_component_id);
  return query select p_period_id, null::uuid, v_next_date;
end;
$$;

create or replace function public.update_billing_renewal_period_snapshot(
  p_relationship_id uuid,
  p_period_id uuid,
  p_plan_name text,
  p_currency text,
  p_amount numeric(18, 6)
)
returns table (period_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_currency text := nullif(upper(btrim(p_currency)), '');
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Enter a valid three-letter currency.';
  end if;
  if p_amount is not null and p_amount < 0 then
    raise exception 'Amount must be zero or greater.';
  end if;

  perform 1
  from public.billing_renewal_periods as period
  join public.tool_email_links as link on link.id = period.tool_email_link_id
  join public.tool_link_billing_components as component on component.id = period.billing_component_id
    and component.tool_email_link_id = period.tool_email_link_id
  where period.id = p_period_id
    and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id
    and period.resolution is null
    and period.payment_transaction_id is null
    and link.user_id = v_user_id
    and link.unlinked_at is null
  for update of period, component, link;

  if not found then raise exception 'This unresolved renewal period or relationship changed.'; end if;

  update public.billing_renewal_periods
  set plan_name_snapshot = nullif(btrim(p_plan_name), ''),
    currency_snapshot = v_currency,
    amount_snapshot = p_amount
  where id = p_period_id
    and tool_email_link_id = p_relationship_id
    and user_id = v_user_id
    and resolution is null
    and payment_transaction_id is null;
  if not found then raise exception 'The renewal period changed before it could be updated.'; end if;

  return query select p_period_id;
end;
$$;

create or replace function public.update_billing_renewal_payment(
  p_relationship_id uuid,
  p_period_id uuid,
  p_payment_transaction_id uuid,
  p_payment_date date,
  p_currency text,
  p_amount numeric(18, 6),
  p_local_date date default null
)
returns table (period_id uuid, payment_transaction_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_local_date date := coalesce(p_local_date, current_date);
  v_currency text := nullif(upper(btrim(p_currency)), '');
  v_period_rows integer;
  v_transaction_rows integer;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if v_local_date > current_date + 1 then
    raise exception 'The local calendar date cannot be in the future.';
  end if;
  if p_payment_date is null then raise exception 'Enter a valid Payment Date.'; end if;
  if p_payment_date > v_local_date then raise exception 'Payment Date cannot be in the future.'; end if;
  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Enter a valid three-letter currency.';
  end if;
  if p_amount is not null and p_amount < 0 then
    raise exception 'Amount must be zero or greater.';
  end if;

  perform 1
  from public.billing_renewal_periods as period
  join public.tool_email_links as link on link.id = period.tool_email_link_id
  join public.tool_link_billing_components as component on component.id = period.billing_component_id
    and component.tool_email_link_id = period.tool_email_link_id
  join public.billing_transactions as transaction
    on transaction.id = period.payment_transaction_id
  where period.id = p_period_id
    and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id
    and period.resolution = 'paid'
    and period.payment_transaction_id = p_payment_transaction_id
    and link.user_id = v_user_id
    and link.unlinked_at is null
    and transaction.user_id = v_user_id
    and transaction.tool_email_link_id = p_relationship_id
    and transaction.source = 'renewal'
    and transaction.source_key = 'renewal-period:' || p_period_id::text
  for update of period, component, link, transaction;

  if not found then raise exception 'The renewal period, relationship, or generated Payment changed.'; end if;

  update public.billing_renewal_periods as period
  set actual_payment_date = p_payment_date,
    currency_snapshot = v_currency,
    amount_snapshot = p_amount
  where period.id = p_period_id
    and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id
    and period.resolution = 'paid'
    and period.payment_transaction_id = p_payment_transaction_id;
  get diagnostics v_period_rows = row_count;

  update public.billing_transactions as transaction
  set payment_date = p_payment_date,
    currency = v_currency,
    amount = p_amount
  where transaction.id = p_payment_transaction_id
    and transaction.user_id = v_user_id
    and transaction.tool_email_link_id = p_relationship_id
    and transaction.source = 'renewal'
    and transaction.source_key = 'renewal-period:' || p_period_id::text;
  get diagnostics v_transaction_rows = row_count;

  if v_period_rows <> 1 or v_transaction_rows <> 1 then
    raise exception 'The exact renewal Payment could not be updated safely.';
  end if;

  return query select p_period_id, p_payment_transaction_id;
end;
$$;

create or replace function public.undo_billing_renewal_resolution(
  p_relationship_id uuid,
  p_period_id uuid
)
returns table (period_id uuid, payment_transaction_id uuid, next_renewal_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_component_id uuid;
  v_resolution text;
  v_payment_id uuid;
  v_deleted integer;
  v_next_date date;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;

  select period.billing_component_id, period.resolution, period.payment_transaction_id
  into v_component_id, v_resolution, v_payment_id
  from public.billing_renewal_periods as period
  join public.tool_email_links as link on link.id = period.tool_email_link_id
  join public.tool_link_billing_components as component on component.id = period.billing_component_id
    and component.tool_email_link_id = period.tool_email_link_id
  where period.id = p_period_id
    and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id
    and link.user_id = v_user_id
    and link.unlinked_at is null
  for update of period, component, link;

  if not found then raise exception 'The renewal period or relationship changed.'; end if;
  if v_resolution is null then
    v_next_date := public.recalculate_billing_next_renewal(p_relationship_id, v_component_id);
    return query select p_period_id, null::uuid, v_next_date;
    return;
  end if;

  update public.billing_renewal_periods
  set actual_payment_date = null,
    resolution = null,
    payment_transaction_id = null,
    resolved_at = null,
    not_charged_reason_code = null,
    not_charged_reason_text = null,
    not_charged_note = null
  where id = p_period_id
    and tool_email_link_id = p_relationship_id
    and user_id = v_user_id;

  if v_resolution = 'paid' then
    delete from public.billing_transactions as transaction
    where transaction.id = v_payment_id
      and transaction.user_id = v_user_id
      and transaction.tool_email_link_id = p_relationship_id
      and transaction.source = 'renewal'
      and transaction.source_key = 'renewal-period:' || p_period_id::text;
    get diagnostics v_deleted = row_count;
    if v_deleted <> 1 then raise exception 'The payment created for this renewal could not be safely removed.'; end if;
  end if;

  v_next_date := public.recalculate_billing_next_renewal(p_relationship_id, v_component_id);
  return query select p_period_id, null::uuid, v_next_date;
end;
$$;

-- Keep direct mutation protection from 0027. Only the guarded functions below
-- are executable by the authenticated application role.
revoke insert, update, delete on table public.billing_renewal_periods from authenticated;

revoke all on function public.confirm_billing_renewal_paid(uuid, uuid) from public, anon;
revoke all on function public.mark_billing_renewal_not_charged(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.update_billing_renewal_period_snapshot(uuid, uuid, text, text, numeric) from public, anon;
revoke all on function public.update_billing_renewal_payment(uuid, uuid, uuid, date, text, numeric, date) from public, anon;
revoke all on function public.undo_billing_renewal_resolution(uuid, uuid) from public, anon;

grant execute on function public.confirm_billing_renewal_paid(uuid, uuid) to authenticated;
grant execute on function public.mark_billing_renewal_not_charged(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.update_billing_renewal_period_snapshot(uuid, uuid, text, text, numeric) to authenticated;
grant execute on function public.update_billing_renewal_payment(uuid, uuid, uuid, date, text, numeric, date) to authenticated;
grant execute on function public.undo_billing_renewal_resolution(uuid, uuid) to authenticated;

commit;
