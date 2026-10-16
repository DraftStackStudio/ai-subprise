-- Phase 2B2-B1: guarded, atomic Resume Subscription contract.
-- Applying this migration creates no lifecycle events, billing components,
-- renewal periods, exclusions, or Payments. Those writes occur only when an
-- authenticated user explicitly invokes resume_subscription.

begin;

alter table public.subscription_lifecycle_events
  add column if not exists next_renewal_date_snapshot date;

alter table public.subscription_lifecycle_events
  drop constraint if exists subscription_lifecycle_events_next_renewal_event_check;
alter table public.subscription_lifecycle_events
  add constraint subscription_lifecycle_events_next_renewal_event_check
  check (
    next_renewal_date_snapshot is null
    or event_kind in ('resumed', 'restarted', 'restarted_plan_changed')
  );

create or replace function public.resume_subscription(
  p_relationship_id uuid,
  p_request_id uuid,
  p_pause_event_id uuid,
  p_billing_type text,
  p_currency text,
  p_amount text,
  p_next_renewal_date date,
  p_next_renewal_unknown boolean,
  p_local_date date default null
)
returns table (
  relationship_id uuid,
  lifecycle_event_id uuid,
  previous_billing_component_id uuid,
  new_billing_component_id uuid,
  next_renewal_date date,
  was_already_applied boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_local_date date := coalesce(p_local_date, current_date);
  v_currency text := upper(nullif(btrim(p_currency), ''));
  v_amount text := nullif(btrim(p_amount), '');
  v_amount_snapshot numeric(18, 6);
  v_link public.tool_email_links%rowtype;
  v_pause_event public.subscription_lifecycle_events%rowtype;
  v_existing_event public.subscription_lifecycle_events%rowtype;
  v_previous_component public.tool_link_billing_components%rowtype;
  v_existing_component public.tool_link_billing_components%rowtype;
  v_new_component_id uuid;
  v_plan_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;
  if p_request_id is null then
    raise exception 'A Resume request ID is required.';
  end if;
  if p_pause_event_id is null then
    raise exception 'The current Pause event is required.';
  end if;
  if v_local_date < current_date - 1 or v_local_date > current_date + 1 then
    raise exception 'The local calendar date is invalid.';
  end if;
  if p_billing_type not in ('Monthly', 'Yearly') then
    raise exception 'Resume supports Monthly or Yearly billing only.';
  end if;
  if v_currency is null or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Select a three-letter currency.';
  end if;
  v_amount_snapshot := public.billing_renewal_snapshot_amount(v_amount);
  if v_amount is not null and v_amount_snapshot is null then
    raise exception 'Enter an amount of zero or greater within the supported range.';
  end if;
  if p_next_renewal_unknown is null then
    raise exception 'Confirm the next renewal date or select Unknown.';
  end if;
  if p_next_renewal_unknown and p_next_renewal_date is not null then
    raise exception 'An unknown next renewal date must be left blank.';
  end if;
  if not p_next_renewal_unknown and p_next_renewal_date is null then
    raise exception 'Confirm the next renewal date or select Unknown.';
  end if;
  if p_next_renewal_date is not null and p_next_renewal_date <= v_local_date then
    raise exception 'The next renewal date must be later than the Resume date.';
  end if;

  -- A request ID is globally unique and a relationship operation is serialized
  -- with renewal sync and other lifecycle operations for this relationship.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 1));
  perform pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0));

  -- Idempotent retry path. Validate the complete persisted Resume payload.
  select event.* into v_existing_event
  from public.subscription_lifecycle_events as event
  where event.id = p_request_id;
  if found then
    select event.* into v_pause_event
    from public.subscription_lifecycle_events as event
    where event.id = p_pause_event_id;
    select component.* into v_existing_component
    from public.tool_link_billing_components as component
    where component.id = v_existing_event.new_billing_component_id;

    if v_existing_event.user_id <> v_user_id
      or v_existing_event.tool_email_link_id <> p_relationship_id
      or v_existing_event.event_kind <> 'resumed'
      or v_existing_event.previous_lifecycle_state <> 'Paused'
      or v_existing_event.next_lifecycle_state <> 'Active'
      or v_existing_event.effective_date <> v_local_date
      or v_existing_event.effective_date_precision <> 'exact_date'
      or v_pause_event.id is null
      or v_pause_event.user_id <> v_user_id
      or v_pause_event.tool_email_link_id <> p_relationship_id
      or v_pause_event.event_kind <> 'paused'
      or v_existing_event.previous_billing_component_id is distinct from v_pause_event.previous_billing_component_id
      or v_existing_event.billing_type_snapshot <> p_billing_type
      or v_existing_event.currency_snapshot <> v_currency
      or v_existing_event.amount_snapshot is distinct from v_amount_snapshot
      or v_existing_event.next_renewal_date_snapshot is distinct from p_next_renewal_date
      or v_existing_component.id is null
      or v_existing_component.tool_email_link_id <> p_relationship_id
      or v_existing_component.billing_type <> p_billing_type
      or v_existing_component.currency is distinct from v_currency
      or v_existing_component.amount is distinct from v_amount
      or v_existing_component.next_renewal_date is distinct from p_next_renewal_date
      or v_existing_component.recurrence_anchor_date is distinct from p_next_renewal_date
      or v_existing_component.retired_at is not null then
      raise exception 'This Resume request ID is already in use.';
    end if;

    return query select p_relationship_id, p_request_id,
      v_existing_event.previous_billing_component_id,
      v_existing_event.new_billing_component_id,
      v_existing_event.next_renewal_date_snapshot,
      true;
    return;
  end if;

  select link.* into v_link
  from public.tool_email_links as link
  where link.id = p_relationship_id and link.user_id = v_user_id
  for update;
  if not found then
    raise exception 'The selected relationship is no longer available.';
  end if;
  if v_link.unlinked_at is not null then
    raise exception 'Historical relationships cannot be resumed.';
  end if;
  if v_link.status <> 'Paused' then
    raise exception 'Only a Paused relationship can be resumed.';
  end if;
  if v_link.plan not in ('Active', 'Paid') then
    raise exception 'Only a paid recurring relationship can be resumed.';
  end if;

  select event.* into v_pause_event
  from public.subscription_lifecycle_events as event
  where event.id = p_pause_event_id
    and event.user_id = v_user_id
    and event.tool_email_link_id = p_relationship_id
    and event.event_kind = 'paused'
    and event.next_lifecycle_state = 'Paused'
  for update;
  if not found or v_pause_event.previous_billing_component_id is null then
    raise exception 'The current recurring Pause event is no longer available.';
  end if;
  if exists (
    select 1
    from public.subscription_lifecycle_events as later_event
    where later_event.tool_email_link_id = p_relationship_id
      and later_event.user_id = v_user_id
      and (later_event.created_at, later_event.id) > (v_pause_event.created_at, v_pause_event.id)
  ) then
    raise exception 'The selected Pause event is not the current lifecycle event.';
  end if;

  v_plan_name := nullif(btrim(v_link.plan_name), '');
  if v_plan_name is distinct from v_pause_event.plan_name_snapshot then
    raise exception 'The plan changed while paused. Use Billing Change before resuming.';
  end if;

  select component.* into v_previous_component
  from public.tool_link_billing_components as component
  where component.id = v_pause_event.previous_billing_component_id
    and component.tool_email_link_id = p_relationship_id
    and component.billing_type in ('Monthly', 'Yearly')
    and component.retired_at is not null
  for update;
  if not found then
    raise exception 'The retired recurring billing component is no longer available.';
  end if;
  if exists (
    select 1
    from public.tool_link_billing_components as component
    where component.tool_email_link_id = p_relationship_id
      and component.billing_type in ('Monthly', 'Yearly')
      and component.retired_at is null
  ) then
    raise exception 'A current recurring billing component already exists.';
  end if;

  insert into public.tool_link_billing_components (
    tool_email_link_id, billing_type, amount, currency,
    next_renewal_date, recurrence_anchor_date
  ) values (
    p_relationship_id, p_billing_type, v_amount, v_currency,
    p_next_renewal_date, p_next_renewal_date
  )
  returning id into v_new_component_id;

  insert into public.subscription_lifecycle_events (
    id, user_id, tool_email_link_id, previous_lifecycle_state,
    next_lifecycle_state, event_kind, effective_date,
    effective_date_precision, previous_billing_component_id,
    new_billing_component_id, plan_name_snapshot, previous_plan_name,
    billing_type_snapshot, currency_snapshot, amount_snapshot,
    next_renewal_date_snapshot
  ) values (
    p_request_id, v_user_id, p_relationship_id, 'Paused',
    'Active', 'resumed', v_local_date,
    'exact_date', v_previous_component.id,
    v_new_component_id, v_plan_name, v_pause_event.plan_name_snapshot,
    p_billing_type, v_currency, v_amount_snapshot,
    p_next_renewal_date
  );

  update public.tool_email_links as link
  set status = 'Active',
    billing_type = p_billing_type,
    amount = v_amount,
    currency = v_currency,
    next_charge_date = p_next_renewal_date
  where link.id = p_relationship_id
    and link.user_id = v_user_id
    and link.unlinked_at is null
    and link.status = 'Paused';
  if not found then
    raise exception 'The relationship changed before Resume completed.';
  end if;

  return query select p_relationship_id, p_request_id,
    v_previous_component.id, v_new_component_id,
    p_next_renewal_date, false;
end;
$$;

revoke all on function public.resume_subscription(
  uuid, uuid, uuid, text, text, text, date, boolean, date
) from public, anon;
grant execute on function public.resume_subscription(
  uuid, uuid, uuid, text, text, text, date, boolean, date
) to authenticated;

commit;
