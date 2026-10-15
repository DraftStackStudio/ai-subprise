-- Phase 2B2-A1: atomic Pause Subscription database contract.
-- This migration installs the guarded Pause RPC and adds relationship-scoped
-- serialization to the existing renewal sync RPC. It does not pause any
-- relationship, create lifecycle history, generate renewal periods, or alter
-- billing data merely by being applied.

begin;

-- Serialize ordinary renewal generation with Pause for the same relationship.
-- The function body otherwise preserves the verified 0030 sync contract.
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
  perform pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0));
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

create or replace function public.pause_subscription(
  p_relationship_id uuid,
  p_request_id uuid,
  p_effective_date date,
  p_effective_date_precision text,
  p_reason text default null,
  p_planned_resume_date date default null,
  p_planned_resume_precision text default null,
  p_local_date date default null
)
returns table (
  relationship_id uuid,
  lifecycle_event_id uuid,
  retired_billing_component_id uuid,
  materialized_period_count integer,
  excluded_period_count integer,
  was_already_applied boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_local_date date := coalesce(p_local_date, current_date);
  v_reason text := nullif(btrim(p_reason), '');
  v_changed_at timestamptz := clock_timestamp();
  v_link public.tool_email_links%rowtype;
  v_component public.tool_link_billing_components%rowtype;
  v_existing_event record;
  v_anchor date;
  v_candidate date;
  v_sequence_index integer;
  v_row_count integer;
  v_materialized integer := 0;
  v_excluded integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;
  if p_request_id is null then
    raise exception 'A Pause request ID is required.';
  end if;
  if p_effective_date is null then
    raise exception 'Enter a Pause effective date.';
  end if;
  if p_effective_date_precision not in ('exact_date', 'month_only') then
    raise exception 'Select an exact date or month-only Pause date.';
  end if;
  if v_local_date < current_date - 1 or v_local_date > current_date + 1 then
    raise exception 'The local calendar date is invalid.';
  end if;
  if p_effective_date > v_local_date then
    raise exception 'Pause effective date cannot be in the future.';
  end if;
  if p_effective_date_precision = 'month_only'
    and p_effective_date <> (date_trunc('month', p_effective_date)::date + interval '1 month - 1 day')::date then
    raise exception 'A month-only Pause date must use the final calendar day of the month.';
  end if;
  if (p_planned_resume_date is null) <> (p_planned_resume_precision is null) then
    raise exception 'Planned resume date and precision must be provided together.';
  end if;
  if p_planned_resume_precision is not null
    and p_planned_resume_precision not in ('exact_date', 'month_only') then
    raise exception 'Select an exact date or month-only planned resume date.';
  end if;
  if p_planned_resume_date is not null and p_planned_resume_date <= p_effective_date then
    raise exception 'Planned resume date must be later than the Pause effective date.';
  end if;
  if p_planned_resume_precision = 'month_only'
    and p_planned_resume_date <> (date_trunc('month', p_planned_resume_date)::date + interval '1 month - 1 day')::date then
    raise exception 'A month-only planned resume date must use the final calendar day of the month.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0));

  -- Fast retry path. A request UUID is also the immutable ledger-event ID.
  select event.* into v_existing_event
  from public.subscription_lifecycle_events as event
  where event.id = p_request_id;
  if found then
    if v_existing_event.user_id <> v_user_id
      or v_existing_event.tool_email_link_id <> p_relationship_id
      or v_existing_event.event_kind <> 'paused'
      or v_existing_event.effective_date <> p_effective_date
      or v_existing_event.effective_date_precision <> p_effective_date_precision
      or v_existing_event.reason is distinct from v_reason
      or v_existing_event.planned_resume_date is distinct from p_planned_resume_date
      or v_existing_event.planned_resume_precision is distinct from p_planned_resume_precision then
      raise exception 'This Pause request ID is already in use.';
    end if;
    return query select p_relationship_id, p_request_id,
      v_existing_event.previous_billing_component_id,
      0,
      (select count(*)::integer from public.billing_renewal_periods as period
       where period.excluded_by_lifecycle_event_id = p_request_id),
      true;
    return;
  end if;

  -- Lock the exact owned relationship before checking state. This serializes
  -- Pause with renewal sync and with another lifecycle request.
  select link.*
  into v_link
  from public.tool_email_links as link
  where link.id = p_relationship_id and link.user_id = v_user_id
  for update;
  if not found then
    raise exception 'The selected relationship is no longer available.';
  end if;

  -- A concurrent retry may have completed while this call waited for the lock.
  select event.* into v_existing_event
  from public.subscription_lifecycle_events as event
  where event.id = p_request_id;
  if found then
    if v_existing_event.user_id <> v_user_id
      or v_existing_event.tool_email_link_id <> p_relationship_id
      or v_existing_event.event_kind <> 'paused'
      or v_existing_event.effective_date <> p_effective_date
      or v_existing_event.effective_date_precision <> p_effective_date_precision
      or v_existing_event.reason is distinct from v_reason
      or v_existing_event.planned_resume_date is distinct from p_planned_resume_date
      or v_existing_event.planned_resume_precision is distinct from p_planned_resume_precision then
      raise exception 'This Pause request ID is already in use.';
    end if;
    return query select p_relationship_id, p_request_id,
      v_existing_event.previous_billing_component_id,
      0,
      (select count(*)::integer from public.billing_renewal_periods as period
       where period.excluded_by_lifecycle_event_id = p_request_id),
      true;
    return;
  end if;

  if v_link.unlinked_at is not null then
    raise exception 'Historical relationships cannot be paused.';
  end if;
  if v_link.status <> 'Active' then
    raise exception 'Only an Active relationship can be paused.';
  end if;
  if v_link.plan = 'Trial' and not coalesce(v_link.trial_resolved, false) then
    raise exception 'Resolve the Trial before pausing this relationship.';
  end if;
  if v_link.plan not in ('Active', 'Paid') then
    raise exception 'Only an active paid relationship can be paused.';
  end if;

  select component.* into v_component
  from public.tool_link_billing_components as component
  where component.tool_email_link_id = p_relationship_id
    and component.billing_type in ('Monthly', 'Yearly')
    and component.retired_at is null
  for update;

  if found then
    v_anchor := coalesce(v_component.recurrence_anchor_date, v_component.next_renewal_date);
    if v_anchor is not null then
      for v_sequence_index in 0..1199 loop
        v_candidate := public.billing_renewal_date_from_anchor(
          v_anchor, v_component.billing_type, v_sequence_index
        );
        exit when v_candidate > p_effective_date;
        insert into public.billing_renewal_periods (
          user_id, tool_email_link_id, billing_component_id,
          scheduled_renewal_date, billing_date, plan_name_snapshot,
          billing_type_snapshot, currency_snapshot, amount_snapshot
        ) values (
          v_user_id, p_relationship_id, v_component.id,
          v_candidate, v_candidate, nullif(btrim(v_link.plan_name), ''),
          v_component.billing_type,
          case when upper(btrim(v_component.currency)) ~ '^[A-Z]{3}$'
            then upper(btrim(v_component.currency)) else null end,
          public.billing_renewal_snapshot_amount(v_component.amount)
        ) on conflict (
          tool_email_link_id, billing_component_id, scheduled_renewal_date
        ) do nothing;
        get diagnostics v_row_count = row_count;
        v_materialized := v_materialized + v_row_count;
      end loop;
      if v_candidate <= p_effective_date then
        raise exception 'Pause renewal materialisation exceeded its safety limit.';
      end if;
    end if;
  end if;

  insert into public.subscription_lifecycle_events (
    id, user_id, tool_email_link_id, previous_lifecycle_state,
    next_lifecycle_state, event_kind, effective_date,
    effective_date_precision, reason, planned_resume_date,
    planned_resume_precision, previous_billing_component_id,
    new_billing_component_id, plan_name_snapshot, previous_plan_name,
    billing_type_snapshot, currency_snapshot, amount_snapshot, created_at
  ) values (
    p_request_id, v_user_id, p_relationship_id, 'Active',
    'Paused', 'paused', p_effective_date,
    p_effective_date_precision, v_reason, p_planned_resume_date,
    p_planned_resume_precision, v_component.id,
    null, nullif(btrim(v_link.plan_name), ''), nullif(btrim(v_link.plan_name), ''),
    v_component.billing_type,
    case when upper(btrim(v_component.currency)) ~ '^[A-Z]{3}$'
      then upper(btrim(v_component.currency)) else null end,
    public.billing_renewal_snapshot_amount(v_component.amount), v_changed_at
  );

  if v_component.id is not null then
    update public.billing_renewal_periods as period
    set excluded_at = v_changed_at,
      excluded_by_lifecycle_event_id = p_request_id
    where period.user_id = v_user_id
      and period.tool_email_link_id = p_relationship_id
      and period.billing_component_id = v_component.id
      and period.resolution is null
      and period.excluded_at is null
      and coalesce(period.billing_date, period.scheduled_renewal_date) > p_effective_date;
    get diagnostics v_excluded = row_count;

    update public.tool_link_billing_components as component
    set retired_at = v_changed_at
    where component.id = v_component.id
      and component.tool_email_link_id = p_relationship_id
      and component.retired_at is null;
    if not found then
      raise exception 'The current recurring billing component changed before Pause completed.';
    end if;
  end if;

  update public.tool_email_links as link
  set status = 'Paused', next_charge_date = null
  where link.id = p_relationship_id
    and link.user_id = v_user_id
    and link.unlinked_at is null
    and link.status = 'Active';
  if not found then
    raise exception 'The relationship changed before Pause completed.';
  end if;

  return query select p_relationship_id, p_request_id, v_component.id,
    v_materialized, v_excluded, false;
end;
$$;

revoke all on function public.pause_subscription(
  uuid, uuid, date, text, text, date, text, date
) from public, anon;
grant execute on function public.pause_subscription(
  uuid, uuid, date, text, text, date, text, date
) to authenticated;
revoke all on function public.sync_due_billing_renewal_periods(uuid, uuid, date)
  from public, anon;
grant execute on function public.sync_due_billing_renewal_periods(uuid, uuid, date)
  to authenticated;

commit;
