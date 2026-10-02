-- Phase 2B1: lifecycle storage, logical renewal exclusion, and recurring
-- component versioning. This migration creates no lifecycle events, excludes
-- no renewal periods, and creates no Payments.

begin;

-- The old uniqueness rule permits one Monthly and one Yearly row for the same
-- relationship. Choosing either as current would invent billing intent.
do $$
begin
  if exists (
    select 1
    from public.tool_link_billing_components as component
    where component.billing_type in ('Monthly', 'Yearly')
    group by component.tool_email_link_id
    having count(*) > 1
  ) then
    raise exception 'Migration 0030 requires at most one recurring billing component per relationship.';
  end if;

  if exists (
    select 1
    from public.tool_link_billing_components as component
    join public.tool_email_links as link on link.id = component.tool_email_link_id
    where component.billing_type in ('Monthly', 'Yearly')
      and link.unlinked_at is null
      and link.status not in (
        'Active', 'Running', 'On a Break', 'On a break', 'Goodbye',
        'Goodbye it was a journey', 'Goodbye, it was a journey'
      )
  ) then
    raise exception 'Migration 0030 found an unsupported lifecycle value on a linked recurring relationship.';
  end if;
end
$$;

alter table public.tool_link_billing_components
  add column if not exists retired_at timestamptz;

-- Existing inactive or unlinked recurring rows become historical. Active and
-- legacy Running rows remain current. No lifecycle date or event is inferred.
update public.tool_link_billing_components as component
set retired_at = clock_timestamp()
from public.tool_email_links as link
where link.id = component.tool_email_link_id
  and component.billing_type in ('Monthly', 'Yearly')
  and component.retired_at is null
  and (
    link.unlinked_at is not null
    or link.status in (
      'On a Break', 'On a break', 'Goodbye',
      'Goodbye it was a journey', 'Goodbye, it was a journey'
    )
  );

alter table public.tool_link_billing_components
  drop constraint if exists tool_link_billing_components_retired_type_check;
alter table public.tool_link_billing_components
  add constraint tool_link_billing_components_retired_type_check
  check (retired_at is null or billing_type in ('Monthly', 'Yearly'));

alter table public.tool_link_billing_components
  drop constraint if exists tool_link_billing_components_unique_type;

create unique index if not exists tool_link_billing_components_current_recurring_uidx
  on public.tool_link_billing_components (tool_email_link_id)
  where billing_type in ('Monthly', 'Yearly') and retired_at is null;

create unique index if not exists tool_link_billing_components_non_recurring_uidx
  on public.tool_link_billing_components (tool_email_link_id, billing_type)
  where billing_type in ('Lifetime', 'One-time', 'Top-up');

-- Retired recurring rows are immutable to ordinary delete paths. Security
-- definer reset/permanent-delete flows retain their existing ownership checks.
drop policy if exists "tool_link_billing_components_owner_insert"
  on public.tool_link_billing_components;
create policy "tool_link_billing_components_owner_insert"
on public.tool_link_billing_components for insert
with check (
  retired_at is null
  and exists (
    select 1
    from public.tool_email_links as link
    where link.id = tool_email_link_id
      and link.user_id = auth.uid()
  )
);

drop policy if exists "tool_link_billing_components_owner_update"
  on public.tool_link_billing_components;
create policy "tool_link_billing_components_owner_update"
on public.tool_link_billing_components for update
using (
  retired_at is null
  and exists (
    select 1
    from public.tool_email_links as link
    where link.id = tool_email_link_id
      and link.user_id = auth.uid()
  )
)
with check (
  retired_at is null
  and exists (
    select 1
    from public.tool_email_links as link
    where link.id = tool_email_link_id
      and link.user_id = auth.uid()
  )
);

drop policy if exists "tool_link_billing_components_owner_delete"
  on public.tool_link_billing_components;
create policy "tool_link_billing_components_owner_delete"
on public.tool_link_billing_components for delete
using (
  retired_at is null
  and exists (
    select 1
    from public.tool_email_links as link
    where link.id = tool_email_link_id
      and link.user_id = auth.uid()
  )
);

create table if not exists public.subscription_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_email_link_id uuid not null references public.tool_email_links(id) on delete cascade,
  previous_lifecycle_state text not null,
  next_lifecycle_state text not null,
  event_kind text not null,
  effective_date date not null,
  effective_date_precision text not null,
  reason text,
  planned_resume_date date,
  planned_resume_precision text,
  previous_billing_component_id uuid references public.tool_link_billing_components(id) on delete set null,
  new_billing_component_id uuid references public.tool_link_billing_components(id) on delete set null,
  plan_name_snapshot text,
  previous_plan_name text,
  billing_type_snapshot text,
  currency_snapshot text,
  amount_snapshot numeric(18, 6),
  created_at timestamptz not null default now(),
  constraint subscription_lifecycle_events_previous_state_check
    check (previous_lifecycle_state in ('Active', 'On a Break', 'Goodbye')),
  constraint subscription_lifecycle_events_next_state_check
    check (next_lifecycle_state in ('Active', 'On a Break', 'Goodbye')),
  constraint subscription_lifecycle_events_kind_check
    check (event_kind in ('paused', 'ended', 'resumed', 'restarted', 'restarted_plan_changed')),
  constraint subscription_lifecycle_events_effective_precision_check
    check (effective_date_precision in ('exact_date', 'month_only')),
  constraint subscription_lifecycle_events_planned_precision_check
    check (planned_resume_precision is null or planned_resume_precision in ('exact_date', 'month_only')),
  constraint subscription_lifecycle_events_planned_pair_check
    check ((planned_resume_date is null) = (planned_resume_precision is null)),
  constraint subscription_lifecycle_events_planned_pause_only_check
    check (planned_resume_date is null or event_kind = 'paused'),
  constraint subscription_lifecycle_events_transition_check
    check (
      (event_kind = 'paused' and previous_lifecycle_state = 'Active' and next_lifecycle_state = 'On a Break')
      or (event_kind = 'ended' and previous_lifecycle_state = 'Active' and next_lifecycle_state = 'Goodbye')
      or (event_kind = 'resumed' and previous_lifecycle_state = 'On a Break' and next_lifecycle_state = 'Active')
      or (event_kind in ('restarted', 'restarted_plan_changed') and previous_lifecycle_state = 'Goodbye' and next_lifecycle_state = 'Active')
    ),
  constraint subscription_lifecycle_events_billing_type_check
    check (billing_type_snapshot is null or billing_type_snapshot in ('Monthly', 'Yearly')),
  constraint subscription_lifecycle_events_currency_check
    check (currency_snapshot is null or currency_snapshot ~ '^[A-Z]{3}$'),
  constraint subscription_lifecycle_events_amount_check
    check (amount_snapshot is null or amount_snapshot >= 0)
);

create index if not exists subscription_lifecycle_events_relationship_date_idx
  on public.subscription_lifecycle_events (tool_email_link_id, effective_date desc, created_at desc);

alter table public.subscription_lifecycle_events enable row level security;
drop policy if exists "subscription_lifecycle_events_owner_select"
  on public.subscription_lifecycle_events;
create policy "subscription_lifecycle_events_owner_select"
on public.subscription_lifecycle_events for select
using (auth.uid() = user_id);

revoke all on table public.subscription_lifecycle_events from anon;
revoke insert, update, delete on table public.subscription_lifecycle_events from authenticated;
grant select on table public.subscription_lifecycle_events to authenticated;

alter table public.billing_renewal_periods
  add column if not exists excluded_at timestamptz,
  add column if not exists excluded_by_lifecycle_event_id uuid;

alter table public.billing_renewal_periods
  drop constraint if exists billing_renewal_periods_exclusion_pair_check;
alter table public.billing_renewal_periods
  add constraint billing_renewal_periods_exclusion_pair_check
  check ((excluded_at is null) = (excluded_by_lifecycle_event_id is null));

alter table public.billing_renewal_periods
  drop constraint if exists billing_renewal_periods_resolved_not_excluded_check;
alter table public.billing_renewal_periods
  add constraint billing_renewal_periods_resolved_not_excluded_check
  check (resolution is null or excluded_at is null);

alter table public.billing_renewal_periods
  drop constraint if exists billing_renewal_periods_excluded_event_fkey;
alter table public.billing_renewal_periods
  add constraint billing_renewal_periods_excluded_event_fkey
  foreign key (excluded_by_lifecycle_event_id)
  references public.subscription_lifecycle_events(id)
  on delete no action deferrable initially deferred;

create index if not exists billing_renewal_periods_reviewable_idx
  on public.billing_renewal_periods (user_id, tool_email_link_id, scheduled_renewal_date)
  where resolution is null and excluded_at is null;

-- Recalculate only the current component. Decisions on a historical component
-- return the current schedule, if one exists, without mutating historical data.
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
  v_retired_at timestamptz;
  v_next_date date;
begin
  select component.recurrence_anchor_date, component.billing_type, component.retired_at
  into v_anchor, v_billing_type, v_retired_at
  from public.tool_link_billing_components as component
  where component.id = p_billing_component_id
    and component.tool_email_link_id = p_relationship_id
  for update;

  if not found or v_billing_type not in ('Monthly', 'Yearly') then
    raise exception 'The recurring billing component is no longer available.';
  end if;

  if v_retired_at is not null then
    select component.next_renewal_date
    into v_next_date
    from public.tool_link_billing_components as component
    where component.tool_email_link_id = p_relationship_id
      and component.billing_type in ('Monthly', 'Yearly')
      and component.retired_at is null;
    return v_next_date;
  end if;

  if v_anchor is null then
    raise exception 'The recurring billing component is no longer available.';
  end if;

  v_next_date := public.billing_renewal_next_on_or_after(v_anchor, v_billing_type, current_date);
  update public.tool_link_billing_components as component
  set next_renewal_date = v_next_date
  where component.id = p_billing_component_id
    and component.tool_email_link_id = p_relationship_id
    and component.retired_at is null;
  update public.tool_email_links as link
  set next_charge_date = v_next_date
  where link.id = p_relationship_id;
  return v_next_date;
end;
$$;

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
  v_anchor date; v_next_renewal date; v_billing_type text; v_amount text; v_currency text; v_plan_name text;
  v_start_index integer; v_sequence_index integer; v_candidate date; v_next_date date;
  v_inserted integer := 0; v_row_count integer;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if v_as_of_date > current_date + 1 then raise exception 'Renewal periods cannot be generated for a future cutoff.'; end if;
  select component.recurrence_anchor_date, component.next_renewal_date, component.billing_type,
    component.amount, component.currency, link.plan_name
  into v_anchor, v_next_renewal, v_billing_type, v_amount, v_currency, v_plan_name
  from public.tool_link_billing_components as component
  join public.tool_email_links as link on link.id = component.tool_email_link_id
  where component.id = p_billing_component_id
    and component.tool_email_link_id = p_relationship_id
    and component.retired_at is null
    and link.user_id = v_user_id and link.unlinked_at is null
    and coalesce(link.status, 'Active') = 'Active' and link.plan in ('Active', 'Paid')
  for update of component, link;
  if not found or v_next_renewal is null or v_billing_type not in ('Monthly', 'Yearly') then
    raise exception 'This active current recurring relationship is no longer available.';
  end if;
  if v_anchor is null then
    v_anchor := v_next_renewal;
    update public.tool_link_billing_components as component set recurrence_anchor_date = v_anchor
    where component.id = p_billing_component_id
      and component.tool_email_link_id = p_relationship_id
      and component.retired_at is null;
  end if;
  v_start_index := public.billing_renewal_sequence_index(v_anchor, v_billing_type, v_next_renewal);
  if v_start_index is null then
    v_next_renewal := public.billing_renewal_next_on_or_after(v_anchor, v_billing_type, v_as_of_date);
    v_start_index := public.billing_renewal_sequence_index(v_anchor, v_billing_type, v_next_renewal);
  end if;
  if v_start_index is null then raise exception 'Next renewal does not match its cadence anchor.'; end if;
  for v_sequence_index in v_start_index..(v_start_index + 1199) loop
    v_candidate := public.billing_renewal_date_from_anchor(v_anchor, v_billing_type, v_sequence_index);
    exit when v_candidate >= v_as_of_date;
    insert into public.billing_renewal_periods (
      user_id, tool_email_link_id, billing_component_id, scheduled_renewal_date, billing_date,
      plan_name_snapshot, billing_type_snapshot, currency_snapshot, amount_snapshot
    ) values (
      v_user_id, p_relationship_id, p_billing_component_id, v_candidate, v_candidate,
      nullif(btrim(v_plan_name), ''), v_billing_type,
      case when upper(btrim(v_currency)) ~ '^[A-Z]{3}$' then upper(btrim(v_currency)) else null end,
      public.billing_renewal_snapshot_amount(v_amount)
    ) on conflict (tool_email_link_id, billing_component_id, scheduled_renewal_date) do nothing;
    get diagnostics v_row_count = row_count;
    v_inserted := v_inserted + v_row_count;
  end loop;
  if v_candidate < v_as_of_date then raise exception 'Renewal generation exceeded its safety limit.'; end if;
  v_next_date := public.billing_renewal_next_on_or_after(v_anchor, v_billing_type, v_as_of_date);
  update public.tool_link_billing_components as component set next_renewal_date = v_next_date
  where component.id = p_billing_component_id
    and component.tool_email_link_id = p_relationship_id
    and component.retired_at is null;
  update public.tool_email_links as link set next_charge_date = v_next_date
  where link.id = p_relationship_id;
  return v_inserted;
end;
$$;

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
  v_user_id uuid := auth.uid(); v_component_id uuid; v_billing_date date; v_plan_name text; v_billing_type text;
  v_currency text; v_amount numeric(18,6); v_resolution text; v_payment_id uuid; v_existing_payment_id uuid;
  v_tool_id uuid; v_login_id uuid; v_tool_name text; v_account_label text; v_account_login text; v_next_date date;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  select period.billing_component_id, coalesce(period.billing_date, period.scheduled_renewal_date),
    period.plan_name_snapshot, period.billing_type_snapshot, period.currency_snapshot, period.amount_snapshot,
    period.resolution, period.payment_transaction_id, link.tool_id, link.email_account_id,
    tool.name, login.label, login.email_address
  into v_component_id, v_billing_date, v_plan_name, v_billing_type, v_currency, v_amount,
    v_resolution, v_existing_payment_id, v_tool_id, v_login_id, v_tool_name, v_account_label, v_account_login
  from public.billing_renewal_periods as period
  join public.tool_email_links as link on link.id = period.tool_email_link_id
  join public.tool_link_billing_components as component on component.id = period.billing_component_id
    and component.tool_email_link_id = period.tool_email_link_id
  left join public.ai_tools as tool on tool.id = link.tool_id
  left join public.logins as login on login.id = link.email_account_id
  where period.id = p_period_id and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id and period.excluded_at is null
    and link.user_id = v_user_id and link.unlinked_at is null
  for update of period, component, link;
  if not found then raise exception 'The reviewable renewal period or relationship changed.'; end if;
  if v_resolution = 'paid' and v_existing_payment_id is not null then
    v_next_date := public.recalculate_billing_next_renewal(p_relationship_id, v_component_id);
    return query select p_period_id, v_existing_payment_id, v_next_date; return;
  end if;
  if v_resolution is not null then raise exception 'This renewal period has already been resolved.'; end if;
  insert into public.billing_transactions (
    user_id, tool_email_link_id, tool_id, login_id, payment_date, tool_name_snapshot,
    account_label_snapshot, account_login_snapshot, plan_name_snapshot, billing_type_snapshot,
    amount, currency, status, note, source, source_key
  ) values (
    v_user_id, p_relationship_id, v_tool_id, v_login_id, v_billing_date, v_tool_name,
    v_account_label, v_account_login, v_plan_name, v_billing_type, v_amount, v_currency,
    'Paid', 'Recurring renewal explicitly confirmed by user.', 'renewal', 'renewal-period:' || p_period_id::text
  ) on conflict (user_id, source, source_key) where source_key is not null do nothing
  returning id into v_payment_id;
  if v_payment_id is null then
    select transaction.id into v_payment_id
    from public.billing_transactions as transaction
    where transaction.user_id = v_user_id and transaction.source = 'renewal'
      and transaction.source_key = 'renewal-period:' || p_period_id::text
      and transaction.tool_email_link_id = p_relationship_id;
  end if;
  if v_payment_id is null then raise exception 'The confirmed renewal payment could not be identified.'; end if;
  update public.billing_renewal_periods as period
  set actual_payment_date = v_billing_date, resolution = 'paid', payment_transaction_id = v_payment_id,
    resolved_at = clock_timestamp(), not_charged_reason_code = null,
    not_charged_reason_text = null, not_charged_note = null
  where period.id = p_period_id and period.tool_email_link_id = p_relationship_id
    and period.resolution is null and period.excluded_at is null;
  if not found then raise exception 'The renewal period changed before it could be resolved.'; end if;
  v_next_date := public.recalculate_billing_next_renewal(p_relationship_id, v_component_id);
  return query select p_period_id, v_payment_id, v_next_date;
end;
$$;

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
  v_user_id uuid := auth.uid(); v_component_id uuid; v_resolution text;
  v_existing_reason_code text; v_existing_reason_text text; v_existing_note text;
  v_reason_code text := lower(btrim(coalesce(p_reason_code, '')));
  v_reason_text text := nullif(btrim(p_reason_text), ''); v_note text := nullif(btrim(p_note), '');
  v_next_date date;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if v_reason_code not in ('cancelled_subscription', 'payment_failed', 'paused', 'free_or_waived', 'other') then
    raise exception 'Select a valid Not charged reason.';
  end if;
  if v_reason_code = 'other' and v_reason_text is null then raise exception 'Enter a reason when Other is selected.'; end if;
  if v_reason_code <> 'other' then v_reason_text := null; end if;
  select period.billing_component_id, period.resolution, period.not_charged_reason_code,
    period.not_charged_reason_text, period.not_charged_note
  into v_component_id, v_resolution, v_existing_reason_code, v_existing_reason_text, v_existing_note
  from public.billing_renewal_periods as period
  join public.tool_email_links as link on link.id = period.tool_email_link_id
  join public.tool_link_billing_components as component on component.id = period.billing_component_id
    and component.tool_email_link_id = period.tool_email_link_id
  where period.id = p_period_id and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id and period.excluded_at is null
    and link.user_id = v_user_id and link.unlinked_at is null
  for update of period, component, link;
  if not found then raise exception 'The reviewable renewal period or relationship changed.'; end if;
  if v_resolution = 'not_charged'
    and v_existing_reason_code = v_reason_code
    and v_existing_reason_text is not distinct from v_reason_text
    and v_existing_note is not distinct from v_note then
    v_next_date := public.recalculate_billing_next_renewal(p_relationship_id, v_component_id);
    return query select p_period_id, null::uuid, v_next_date; return;
  end if;
  if v_resolution is not null then raise exception 'This renewal period has already been resolved.'; end if;
  update public.billing_renewal_periods as period
  set actual_payment_date = null, resolution = 'not_charged', payment_transaction_id = null,
    resolved_at = clock_timestamp(), not_charged_reason_code = v_reason_code,
    not_charged_reason_text = v_reason_text, not_charged_note = v_note
  where period.id = p_period_id and period.tool_email_link_id = p_relationship_id
    and period.resolution is null and period.excluded_at is null;
  if not found then raise exception 'The renewal period changed before it could be resolved.'; end if;
  v_next_date := public.recalculate_billing_next_renewal(p_relationship_id, v_component_id);
  return query select p_period_id, null::uuid, v_next_date;
end;
$$;

create or replace function public.update_billing_renewal_period_snapshot(
  p_relationship_id uuid, p_period_id uuid, p_plan_name text, p_currency text,
  p_amount numeric(18,6), p_billing_date date, p_date_scope text, p_local_date date default null
)
returns table (period_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid(); v_local_date date := coalesce(p_local_date, current_date);
  v_currency text := nullif(upper(btrim(p_currency)), ''); v_component_id uuid; v_billing_type text;
  v_scheduled_date date; v_previous_date date; v_current_plan text; v_current_currency text;
  v_current_amount numeric(18,6); v_anchor date; v_next_date date; v_offset integer := 0;
  v_component_retired_at timestamptz; v_period record;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_date_scope not in ('period_only','this_and_future') then raise exception 'Select how the Billing Date change should apply.'; end if;
  if p_billing_date is null then raise exception 'Enter a valid Billing Date.'; end if;
  if v_local_date > current_date + 1 then raise exception 'The local calendar date cannot be in the future.'; end if;
  if p_billing_date > v_local_date then raise exception 'Billing Date cannot be in the future.'; end if;
  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then raise exception 'Enter a valid three-letter currency.'; end if;
  if p_amount is not null and p_amount < 0 then raise exception 'Amount must be zero or greater.'; end if;
  select period.billing_component_id, period.billing_type_snapshot, period.scheduled_renewal_date,
    coalesce(period.billing_date, period.scheduled_renewal_date), period.plan_name_snapshot,
    period.currency_snapshot, period.amount_snapshot, component.recurrence_anchor_date, component.retired_at
  into v_component_id, v_billing_type, v_scheduled_date, v_previous_date, v_current_plan,
    v_current_currency, v_current_amount, v_anchor, v_component_retired_at
  from public.billing_renewal_periods as period
  join public.tool_email_links as link on link.id = period.tool_email_link_id
  join public.tool_link_billing_components as component on component.id = period.billing_component_id
    and component.tool_email_link_id = period.tool_email_link_id
  where period.id = p_period_id and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id and period.resolution is null
    and period.payment_transaction_id is null and period.excluded_at is null
    and link.user_id = v_user_id and link.unlinked_at is null
  for update of period, component, link;
  if not found then raise exception 'This reviewable renewal period or relationship changed.'; end if;
  if p_date_scope = 'this_and_future' and exists (
    select 1 from public.billing_renewal_periods as resolved
    where resolved.tool_email_link_id = p_relationship_id
      and resolved.billing_component_id = v_component_id
      and resolved.scheduled_renewal_date >= v_scheduled_date
      and resolved.resolution is not null
  ) then raise exception 'Future schedule changes cannot rewrite an already resolved billing period.'; end if;

  update public.billing_renewal_periods as period
  set plan_name_snapshot = nullif(btrim(p_plan_name), ''), currency_snapshot = v_currency,
    amount_snapshot = p_amount, billing_date = p_billing_date
  where period.id = p_period_id and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id and period.resolution is null
    and period.payment_transaction_id is null and period.excluded_at is null;

  if p_date_scope = 'this_and_future' and p_billing_date is distinct from v_previous_date then
    for v_period in
      select period.id
      from public.billing_renewal_periods as period
      where period.tool_email_link_id = p_relationship_id
        and period.billing_component_id = v_component_id
        and period.scheduled_renewal_date > v_scheduled_date
        and period.resolution is null and period.excluded_at is null
      order by period.scheduled_renewal_date
      for update
    loop
      v_offset := v_offset + 1;
      update public.billing_renewal_periods as period
      set billing_date = public.billing_renewal_date_from_anchor(p_billing_date, v_billing_type, v_offset)
      where period.id = v_period.id and period.excluded_at is null;
    end loop;

    if v_component_retired_at is null then
      update public.tool_link_billing_components as component
      set recurrence_anchor_date = p_billing_date
      where component.id = v_component_id
        and component.tool_email_link_id = p_relationship_id
        and component.retired_at is null;
      v_next_date := public.billing_renewal_next_on_or_after(p_billing_date, v_billing_type, v_local_date);
      update public.tool_link_billing_components as component
      set next_renewal_date = v_next_date
      where component.id = v_component_id
        and component.tool_email_link_id = p_relationship_id
        and component.retired_at is null;
      update public.tool_email_links as link
      set next_charge_date = v_next_date
      where link.id = p_relationship_id;
    end if;
  end if;

  if p_billing_date is distinct from v_previous_date
    or nullif(btrim(p_plan_name), '') is distinct from v_current_plan
    or v_currency is distinct from v_current_currency
    or p_amount is distinct from v_current_amount then
    insert into public.billing_renewal_activity (
      user_id, tool_email_link_id, billing_renewal_period_id, kind, activity_date,
      previous_billing_date, billing_date, plan_name_snapshot, billing_type_snapshot,
      currency_snapshot, amount_snapshot, note
    ) values (
      v_user_id, p_relationship_id, p_period_id,
      case when p_date_scope = 'this_and_future' and p_billing_date is distinct from v_previous_date
        then 'billing_schedule_changed' else 'billing_period_corrected' end,
      v_local_date, v_previous_date, p_billing_date, nullif(btrim(p_plan_name), ''),
      v_billing_type, v_currency, p_amount,
      case when p_date_scope = 'period_only' then 'Updated this billing period only.' else null end
    );
  end if;
  return query select p_period_id;
end;
$$;

-- Reassert the existing permissions after replacing function definitions.
revoke all on function public.recalculate_billing_next_renewal(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sync_due_billing_renewal_periods(uuid, uuid, date) from public, anon;
revoke all on function public.confirm_billing_renewal_paid(uuid, uuid) from public, anon;
revoke all on function public.mark_billing_renewal_not_charged(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.update_billing_renewal_period_snapshot(uuid, uuid, text, text, numeric, date, text, date) from public, anon;

grant execute on function public.sync_due_billing_renewal_periods(uuid, uuid, date) to authenticated;
grant execute on function public.confirm_billing_renewal_paid(uuid, uuid) to authenticated;
grant execute on function public.mark_billing_renewal_not_charged(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.update_billing_renewal_period_snapshot(uuid, uuid, text, text, numeric, date, text, date) to authenticated;

commit;
