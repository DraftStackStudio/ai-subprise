-- Narrow, idempotent repair for databases where migration 0029 was already applied.
-- This replaces two RPC definitions only. It does not update application data.

begin;

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
  where component.id = p_billing_component_id and component.tool_email_link_id = p_relationship_id
    and link.user_id = v_user_id and link.unlinked_at is null
    and coalesce(link.status, 'Active') = 'Active' and link.plan in ('Active', 'Paid')
  for update of component, link;
  if not found or v_next_renewal is null or v_billing_type not in ('Monthly', 'Yearly') then
    raise exception 'This active recurring relationship is no longer available.';
  end if;
  if v_anchor is null then
    v_anchor := v_next_renewal;
    update public.tool_link_billing_components as component set recurrence_anchor_date = v_anchor
    where component.id = p_billing_component_id and component.tool_email_link_id = p_relationship_id;
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
  where component.id = p_billing_component_id and component.tool_email_link_id = p_relationship_id;
  update public.tool_email_links as link set next_charge_date = v_next_date where link.id = p_relationship_id;
  return v_inserted;
end;
$$;

create or replace function public.update_billing_renewal_period_snapshot(
  p_relationship_id uuid, p_period_id uuid, p_plan_name text, p_currency text,
  p_amount numeric(18,6), p_billing_date date, p_date_scope text, p_local_date date default null
)
returns table (period_id uuid)
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid(); v_local_date date := coalesce(p_local_date, current_date);
  v_currency text := nullif(upper(btrim(p_currency)), ''); v_component_id uuid; v_billing_type text;
  v_scheduled_date date; v_previous_date date; v_current_plan text; v_current_currency text;
  v_current_amount numeric(18,6); v_anchor date; v_next_date date; v_offset integer := 0; v_period record;
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
    period.currency_snapshot, period.amount_snapshot, component.recurrence_anchor_date
  into v_component_id, v_billing_type, v_scheduled_date, v_previous_date, v_current_plan,
    v_current_currency, v_current_amount, v_anchor
  from public.billing_renewal_periods as period
  join public.tool_email_links as link on link.id = period.tool_email_link_id
  join public.tool_link_billing_components as component on component.id = period.billing_component_id and component.tool_email_link_id = period.tool_email_link_id
  where period.id = p_period_id and period.tool_email_link_id = p_relationship_id and period.user_id = v_user_id
    and period.resolution is null and period.payment_transaction_id is null
    and link.user_id = v_user_id and link.unlinked_at is null
  for update of period, component, link;
  if not found then raise exception 'This unresolved renewal period or relationship changed.'; end if;
  if p_date_scope = 'this_and_future' and exists (
    select 1 from public.billing_renewal_periods as resolved
    where resolved.tool_email_link_id = p_relationship_id and resolved.billing_component_id = v_component_id
      and resolved.scheduled_renewal_date >= v_scheduled_date and resolved.resolution is not null
  ) then raise exception 'Future schedule changes cannot rewrite an already resolved billing period.'; end if;

  update public.billing_renewal_periods as period set plan_name_snapshot = nullif(btrim(p_plan_name), ''),
    currency_snapshot = v_currency, amount_snapshot = p_amount, billing_date = p_billing_date
  where period.id = p_period_id and period.tool_email_link_id = p_relationship_id and period.user_id = v_user_id
    and period.resolution is null and period.payment_transaction_id is null;

  if p_date_scope = 'this_and_future' and p_billing_date is distinct from v_previous_date then
    for v_period in select period.id from public.billing_renewal_periods as period
      where period.tool_email_link_id = p_relationship_id and period.billing_component_id = v_component_id
        and period.scheduled_renewal_date > v_scheduled_date and period.resolution is null
      order by period.scheduled_renewal_date for update
    loop
      v_offset := v_offset + 1;
      update public.billing_renewal_periods as period
      set billing_date = public.billing_renewal_date_from_anchor(p_billing_date, v_billing_type, v_offset)
      where period.id = v_period.id;
    end loop;
    update public.tool_link_billing_components as component set recurrence_anchor_date = p_billing_date
    where component.id = v_component_id and component.tool_email_link_id = p_relationship_id;
    v_next_date := public.billing_renewal_next_on_or_after(p_billing_date, v_billing_type, v_local_date);
    update public.tool_link_billing_components as component set next_renewal_date = v_next_date
    where component.id = v_component_id and component.tool_email_link_id = p_relationship_id;
    update public.tool_email_links as link set next_charge_date = v_next_date where link.id = p_relationship_id;
  end if;

  if p_billing_date is distinct from v_previous_date
    or nullif(btrim(p_plan_name), '') is distinct from v_current_plan
    or v_currency is distinct from v_current_currency or p_amount is distinct from v_current_amount then
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

commit;
