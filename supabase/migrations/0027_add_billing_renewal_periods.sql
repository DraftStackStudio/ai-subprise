-- Persist expected recurring periods separately from confirmed transactions.
-- Applying this migration does not generate periods, change existing renewal
-- dates, or create payments. Period generation is an explicit, neutral sync.

alter table public.tool_link_billing_components
  add column if not exists recurrence_anchor_date date;

alter table public.billing_transactions
  drop constraint if exists billing_transactions_source_check;
alter table public.billing_transactions
  add constraint billing_transactions_source_check
  check (source in ('manual', 'renewal', 'legacy_json', 'api'));

-- Renewal-generated transactions are changed only by the guarded renewal
-- functions. Ordinary manual payments retain their existing edit access.
drop policy if exists "billing_transactions_owner_insert" on public.billing_transactions;
create policy "billing_transactions_owner_insert"
on public.billing_transactions for insert
with check (
  auth.uid() = user_id
  and source = 'manual'
  and (
    tool_email_link_id is null
    or exists (
      select 1 from public.tool_email_links as link
      where link.id = tool_email_link_id and link.user_id = auth.uid()
    )
  )
  and (
    tool_id is null
    or exists (
      select 1 from public.ai_tools as tool
      where tool.id = tool_id and tool.user_id = auth.uid()
    )
  )
  and (
    login_id is null
    or exists (
      select 1 from public.logins as login
      where login.id = login_id and login.user_id = auth.uid()
    )
  )
);

drop policy if exists "billing_transactions_owner_update" on public.billing_transactions;
create policy "billing_transactions_owner_update"
on public.billing_transactions for update
using (auth.uid() = user_id and source = 'manual')
with check (
  auth.uid() = user_id
  and source = 'manual'
  and (
    tool_email_link_id is null
    or exists (
      select 1 from public.tool_email_links as link
      where link.id = tool_email_link_id and link.user_id = auth.uid()
    )
  )
  and (
    tool_id is null
    or exists (
      select 1 from public.ai_tools as tool
      where tool.id = tool_id and tool.user_id = auth.uid()
    )
  )
  and (
    login_id is null
    or exists (
      select 1 from public.logins as login
      where login.id = login_id and login.user_id = auth.uid()
    )
  )
);

create table if not exists public.billing_renewal_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_email_link_id uuid not null references public.tool_email_links(id) on delete cascade,
  billing_component_id uuid not null references public.tool_link_billing_components(id) on delete restrict,
  scheduled_renewal_date date not null,
  actual_payment_date date,
  plan_name_snapshot text,
  billing_type_snapshot text not null,
  currency_snapshot text,
  amount_snapshot numeric(18, 6),
  resolution text,
  payment_transaction_id uuid unique references public.billing_transactions(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_renewal_periods_type_check
    check (billing_type_snapshot in ('Monthly', 'Yearly')),
  constraint billing_renewal_periods_currency_check
    check (currency_snapshot is null or currency_snapshot ~ '^[A-Z]{3}$'),
  constraint billing_renewal_periods_amount_check
    check (amount_snapshot is null or amount_snapshot >= 0),
  constraint billing_renewal_periods_resolution_check
    check (resolution is null or resolution in ('paid', 'not_charged')),
  constraint billing_renewal_periods_resolution_state_check
    check (
      (resolution is null and resolved_at is null and payment_transaction_id is null)
      or (resolution = 'paid' and resolved_at is not null and payment_transaction_id is not null and actual_payment_date is not null)
      or (resolution = 'not_charged' and resolved_at is not null and payment_transaction_id is null and actual_payment_date is null)
    ),
  constraint billing_renewal_periods_unique_scheduled_period
    unique (tool_email_link_id, billing_component_id, scheduled_renewal_date)
);

create index if not exists billing_renewal_periods_relationship_date_idx
  on public.billing_renewal_periods (tool_email_link_id, scheduled_renewal_date);

create index if not exists billing_renewal_periods_unresolved_idx
  on public.billing_renewal_periods (user_id, scheduled_renewal_date)
  where resolution is null;

create or replace function public.set_billing_renewal_period_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists billing_renewal_periods_set_updated_at
  on public.billing_renewal_periods;
create trigger billing_renewal_periods_set_updated_at
before update on public.billing_renewal_periods
for each row execute function public.set_billing_renewal_period_updated_at();

alter table public.billing_renewal_periods enable row level security;

drop policy if exists "billing_renewal_periods_owner_select" on public.billing_renewal_periods;
create policy "billing_renewal_periods_owner_select"
on public.billing_renewal_periods for select
using (auth.uid() = user_id);

revoke all on table public.billing_renewal_periods from anon;
revoke insert, update, delete on table public.billing_renewal_periods from authenticated;
grant select on table public.billing_renewal_periods to authenticated;

-- Always calculate from the immutable anchor rather than the previously
-- clamped occurrence. This keeps 31 Jan -> 28 Feb -> 31 Mar and preserves a
-- leap-day yearly cadence.
create or replace function public.billing_renewal_date_from_anchor(
  p_anchor_date date,
  p_billing_type text,
  p_sequence_index integer
)
returns date
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  v_anchor_year integer := extract(year from p_anchor_date)::integer;
  v_anchor_month integer := extract(month from p_anchor_date)::integer;
  v_anchor_day integer := extract(day from p_anchor_date)::integer;
  v_month_index integer;
  v_target_year integer;
  v_target_month integer;
  v_last_day integer;
begin
  if p_sequence_index < 0 or p_billing_type not in ('Monthly', 'Yearly') then
    raise exception 'Invalid renewal cadence input.';
  end if;

  v_month_index := (v_anchor_year * 12 + v_anchor_month - 1)
    + case when p_billing_type = 'Monthly' then p_sequence_index else p_sequence_index * 12 end;
  v_target_year := v_month_index / 12;
  v_target_month := mod(v_month_index, 12) + 1;
  v_last_day := extract(day from (make_date(v_target_year, v_target_month, 1) + interval '1 month - 1 day'))::integer;
  return make_date(v_target_year, v_target_month, least(v_anchor_day, v_last_day));
end;
$$;

create or replace function public.billing_renewal_sequence_index(
  p_anchor_date date,
  p_billing_type text,
  p_scheduled_date date
)
returns integer
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  v_index integer;
  v_candidate date;
begin
  for v_index in 0..12000 loop
    v_candidate := public.billing_renewal_date_from_anchor(p_anchor_date, p_billing_type, v_index);
    if v_candidate = p_scheduled_date then return v_index; end if;
    if v_candidate > p_scheduled_date then return null; end if;
  end loop;
  return null;
end;
$$;

create or replace function public.billing_renewal_snapshot_amount(p_amount text)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_amount is null or btrim(p_amount) !~ '^\d+(\.\d+)?$' then return null; end if;
  return btrim(p_amount)::numeric(18, 6);
exception when numeric_value_out_of_range then
  return null;
end;
$$;

-- Recalculate from persisted decisions only. Wall-clock time is deliberately
-- absent: time passing can never advance Current Billing.
create or replace function public.recalculate_billing_next_renewal(
  p_relationship_id uuid,
  p_billing_component_id uuid
)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anchor date;
  v_billing_type text;
  v_earliest_unresolved date;
  v_latest_period date;
  v_latest_index integer;
  v_next_date date;
begin
  select component.recurrence_anchor_date, component.billing_type
  into v_anchor, v_billing_type
  from public.tool_link_billing_components as component
  where component.id = p_billing_component_id
    and component.tool_email_link_id = p_relationship_id
  for update;

  if not found or v_anchor is null or v_billing_type not in ('Monthly', 'Yearly') then
    raise exception 'The recurring billing component is no longer available.';
  end if;

  select min(period.scheduled_renewal_date)
  into v_earliest_unresolved
  from public.billing_renewal_periods as period
  where period.tool_email_link_id = p_relationship_id
    and period.billing_component_id = p_billing_component_id
    and period.resolution is null;

  if v_earliest_unresolved is not null then
    v_next_date := v_earliest_unresolved;
  else
    select max(period.scheduled_renewal_date)
    into v_latest_period
    from public.billing_renewal_periods as period
    where period.tool_email_link_id = p_relationship_id
      and period.billing_component_id = p_billing_component_id;

    if v_latest_period is null then
      select component.next_renewal_date into v_next_date
      from public.tool_link_billing_components as component
      where component.id = p_billing_component_id;
    else
      v_latest_index := public.billing_renewal_sequence_index(v_anchor, v_billing_type, v_latest_period);
      if v_latest_index is null then raise exception 'A renewal period no longer matches its cadence anchor.'; end if;
      v_next_date := public.billing_renewal_date_from_anchor(v_anchor, v_billing_type, v_latest_index + 1);
    end if;
  end if;

  update public.tool_link_billing_components
  set next_renewal_date = v_next_date
  where id = p_billing_component_id
    and tool_email_link_id = p_relationship_id;

  update public.tool_email_links
  set next_charge_date = v_next_date
  where id = p_relationship_id;

  return v_next_date;
end;
$$;

-- Materialize neutral expected periods. No outcome, payment, or date advance is
-- inferred. Repeated calls are safe because the scheduled period is unique.
create or replace function public.sync_due_billing_renewal_periods(
  p_relationship_id uuid,
  p_billing_component_id uuid,
  p_as_of_date date default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_as_of_date date := coalesce(p_as_of_date, current_date);
  v_anchor date;
  v_next_renewal date;
  v_billing_type text;
  v_amount text;
  v_currency text;
  v_plan_name text;
  v_start_index integer;
  v_sequence_index integer;
  v_candidate date;
  v_inserted integer := 0;
  v_row_count integer;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  -- The browser supplies its local calendar date. Permit the one-day lead that
  -- can occur in UTC+ time zones while rejecting arbitrary future generation.
  if v_as_of_date > current_date + 1 then raise exception 'Renewal periods cannot be generated for a future cutoff.'; end if;

  select component.recurrence_anchor_date, component.next_renewal_date, component.billing_type,
    component.amount, component.currency, link.plan_name
  into v_anchor, v_next_renewal, v_billing_type, v_amount, v_currency, v_plan_name
  from public.tool_link_billing_components as component
  join public.tool_email_links as link on link.id = component.tool_email_link_id
  where component.id = p_billing_component_id
    and component.tool_email_link_id = p_relationship_id
    and link.user_id = v_user_id
    and link.unlinked_at is null
    and coalesce(link.status, 'Active') = 'Active'
    and link.plan in ('Active', 'Paid')
  for update of component, link;

  if not found or v_next_renewal is null or v_billing_type not in ('Monthly', 'Yearly') then
    raise exception 'This active recurring relationship is no longer available.';
  end if;

  if v_anchor is null then
    v_anchor := v_next_renewal;
    update public.tool_link_billing_components
    set recurrence_anchor_date = v_anchor
    where id = p_billing_component_id
      and tool_email_link_id = p_relationship_id;
  end if;

  v_start_index := public.billing_renewal_sequence_index(v_anchor, v_billing_type, v_next_renewal);
  if v_start_index is null then raise exception 'Next renewal does not match its cadence anchor.'; end if;

  for v_sequence_index in v_start_index..(v_start_index + 1199) loop
    v_candidate := public.billing_renewal_date_from_anchor(v_anchor, v_billing_type, v_sequence_index);
    exit when v_candidate >= v_as_of_date;

    insert into public.billing_renewal_periods (
      user_id, tool_email_link_id, billing_component_id, scheduled_renewal_date,
      plan_name_snapshot, billing_type_snapshot, currency_snapshot, amount_snapshot
    ) values (
      v_user_id, p_relationship_id, p_billing_component_id, v_candidate,
      nullif(btrim(v_plan_name), ''), v_billing_type,
      case when upper(btrim(v_currency)) ~ '^[A-Z]{3}$' then upper(btrim(v_currency)) else null end,
      public.billing_renewal_snapshot_amount(v_amount)
    )
    on conflict (tool_email_link_id, billing_component_id, scheduled_renewal_date) do nothing;
    get diagnostics v_row_count = row_count;
    v_inserted := v_inserted + v_row_count;
  end loop;

  if v_candidate < v_as_of_date then raise exception 'Renewal generation exceeded its safety limit.'; end if;
  return v_inserted;
end;
$$;

create or replace function public.confirm_billing_renewal_paid(
  p_relationship_id uuid,
  p_period_id uuid,
  p_actual_payment_date date default null
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
  v_actual_date date;
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

  v_actual_date := coalesce(p_actual_payment_date, v_scheduled_date);
  if v_actual_date > current_date + 1 then raise exception 'A future payment cannot be confirmed.'; end if;

  insert into public.billing_transactions (
    user_id, tool_email_link_id, tool_id, login_id, payment_date,
    tool_name_snapshot, account_label_snapshot, account_login_snapshot,
    plan_name_snapshot, billing_type_snapshot, amount, currency, status,
    note, source, source_key
  ) values (
    v_user_id, p_relationship_id, v_tool_id, v_login_id, v_actual_date,
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
  set actual_payment_date = v_actual_date,
    resolution = 'paid',
    payment_transaction_id = v_payment_id,
    resolved_at = clock_timestamp()
  where id = p_period_id
    and tool_email_link_id = p_relationship_id
    and resolution is null;
  if not found then raise exception 'The renewal period changed before it could be resolved.'; end if;

  v_next_date := public.recalculate_billing_next_renewal(p_relationship_id, v_component_id);
  return query select p_period_id, v_payment_id, v_next_date;
end;
$$;

create or replace function public.mark_billing_renewal_not_charged(
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
  v_next_date date;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;

  select period.billing_component_id, period.resolution
  into v_component_id, v_resolution
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
  if v_resolution = 'not_charged' then
    v_next_date := public.recalculate_billing_next_renewal(p_relationship_id, v_component_id);
    return query select p_period_id, null::uuid, v_next_date;
    return;
  end if;
  if v_resolution is not null then raise exception 'This renewal period has already been resolved.'; end if;

  update public.billing_renewal_periods
  set actual_payment_date = null,
    resolution = 'not_charged',
    payment_transaction_id = null,
    resolved_at = clock_timestamp()
  where id = p_period_id
    and tool_email_link_id = p_relationship_id
    and resolution is null;
  if not found then raise exception 'The renewal period changed before it could be resolved.'; end if;

  v_next_date := public.recalculate_billing_next_renewal(p_relationship_id, v_component_id);
  return query select p_period_id, null::uuid, v_next_date;
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
    resolved_at = null
  where id = p_period_id
    and tool_email_link_id = p_relationship_id;

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

-- Keep the existing clean-slate operation compatible with the protected
-- period -> generated-payment relationship. This definition is installed only;
-- applying the migration does not invoke the destructive operation.
create or replace function public.reset_ai_tools_clean_slate()
returns table (
  billing_transactions_deleted bigint,
  ai_tools_deleted bigint,
  tool_email_links_deleted bigint,
  billing_components_deleted bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  deleted_transactions bigint := 0;
  deleted_tools bigint := 0;
  relationship_count bigint := 0;
  component_count bigint := 0;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;

  select count(*) into relationship_count
  from public.tool_email_links as link
  where link.user_id = current_user_id;

  select count(*) into component_count
  from public.tool_link_billing_components as component
  where exists (
    select 1 from public.tool_email_links as link
    where link.id = component.tool_email_link_id
      and link.user_id = current_user_id
  );

  -- Paid renewal periods protect their exact generated transaction. Remove
  -- those period records first, then retain the established reset order.
  delete from public.billing_renewal_periods
  where user_id = current_user_id;

  delete from public.billing_transactions
  where user_id = current_user_id;
  get diagnostics deleted_transactions = row_count;

  delete from public.ai_tools
  where user_id = current_user_id;
  get diagnostics deleted_tools = row_count;

  return query select deleted_transactions, deleted_tools, relationship_count, component_count;
end;
$$;

revoke all on function public.set_billing_renewal_period_updated_at() from public, anon, authenticated;
revoke all on function public.billing_renewal_date_from_anchor(date, text, integer) from public, anon, authenticated;
revoke all on function public.billing_renewal_sequence_index(date, text, date) from public, anon, authenticated;
revoke all on function public.billing_renewal_snapshot_amount(text) from public, anon;
revoke all on function public.recalculate_billing_next_renewal(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sync_due_billing_renewal_periods(uuid, uuid, date) from public, anon;
revoke all on function public.confirm_billing_renewal_paid(uuid, uuid, date) from public, anon;
revoke all on function public.mark_billing_renewal_not_charged(uuid, uuid) from public, anon;
revoke all on function public.undo_billing_renewal_resolution(uuid, uuid) from public, anon;

grant execute on function public.sync_due_billing_renewal_periods(uuid, uuid, date) to authenticated;
grant execute on function public.confirm_billing_renewal_paid(uuid, uuid, date) to authenticated;
grant execute on function public.mark_billing_renewal_not_charged(uuid, uuid) to authenticated;
grant execute on function public.undo_billing_renewal_resolution(uuid, uuid) to authenticated;
