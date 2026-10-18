-- Current Billing change/correction audit and guarded atomic persistence.
-- Applying this migration alone creates no events, components, periods, or
-- Payments and does not revoke permissions used by the currently deployed app.

begin;

create table if not exists public.subscription_billing_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_email_link_id uuid not null references public.tool_email_links(id) on delete cascade,
  mode text not null,
  effective_date date not null,
  reason text,
  before_snapshot jsonb not null,
  after_snapshot jsonb not null,
  changed_fields text[] not null,
  classifications text[] not null default '{}'::text[],
  previous_recurring_component_id uuid references public.tool_link_billing_components(id) on delete set null,
  new_recurring_component_id uuid references public.tool_link_billing_components(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint subscription_billing_events_mode_check
    check (mode in ('change', 'correction')),
  constraint subscription_billing_events_snapshot_check
    check (
      jsonb_typeof(before_snapshot) = 'object'
      and jsonb_typeof(after_snapshot) = 'object'
      and before_snapshot <> after_snapshot
    ),
  constraint subscription_billing_events_changed_fields_check
    check (
      cardinality(changed_fields) > 0
      and array_position(changed_fields, null) is null
      and changed_fields <@ array[
        'plan_name', 'component_configuration', 'billing_type', 'amount',
        'currency', 'next_renewal_date', 'purchase_date', 'last_top_up_date'
      ]::text[]
    ),
  constraint subscription_billing_events_classifications_check
    check (
      array_position(classifications, null) is null
      and classifications <@ array[
        'plan_changed', 'component_added', 'component_removed',
        'billing_cycle_changed', 'billing_type_changed',
        'price_increased', 'price_decreased', 'amount_changed',
        'amount_recorded', 'amount_cleared', 'currency_changed',
        'renewal_date_changed', 'purchase_date_changed',
        'last_top_up_date_changed'
      ]::text[]
    ),
  constraint subscription_billing_events_correction_classification_check
    check (mode <> 'correction' or cardinality(classifications) = 0)
);

create index if not exists subscription_billing_events_relationship_date_idx
  on public.subscription_billing_events (tool_email_link_id, effective_date desc, created_at desc);

alter table public.subscription_billing_events enable row level security;
drop policy if exists "subscription_billing_events_owner_select"
  on public.subscription_billing_events;
create policy "subscription_billing_events_owner_select"
on public.subscription_billing_events for select
using (auth.uid() = user_id);

revoke all on table public.subscription_billing_events from anon;
revoke insert, update, delete on table public.subscription_billing_events from authenticated;
grant select on table public.subscription_billing_events to authenticated;

alter table public.billing_renewal_periods
  add column if not exists excluded_by_billing_event_id uuid;

alter table public.billing_renewal_periods
  drop constraint if exists billing_renewal_periods_exclusion_pair_check;
alter table public.billing_renewal_periods
  add constraint billing_renewal_periods_exclusion_pair_check
  check (
    (excluded_at is null
      and excluded_by_lifecycle_event_id is null
      and excluded_by_billing_event_id is null)
    or
    (excluded_at is not null
      and num_nonnulls(excluded_by_lifecycle_event_id, excluded_by_billing_event_id) = 1)
  );

alter table public.billing_renewal_periods
  drop constraint if exists billing_renewal_periods_excluded_billing_event_fkey;
alter table public.billing_renewal_periods
  add constraint billing_renewal_periods_excluded_billing_event_fkey
  foreign key (excluded_by_billing_event_id)
  references public.subscription_billing_events(id)
  on delete no action deferrable initially deferred;

create index if not exists billing_renewal_periods_billing_event_idx
  on public.billing_renewal_periods (excluded_by_billing_event_id)
  where excluded_by_billing_event_id is not null;

-- At most one unresolved, unexcluded renewal may be actionable for a
-- relationship and scheduled date, including across component versions.
create unique index if not exists billing_renewal_periods_one_reviewable_date_uidx
  on public.billing_renewal_periods (tool_email_link_id, scheduled_renewal_date)
  where resolution is null and excluded_at is null;

-- Preserve the existing 0032 sync contract while making its insert compatible
-- with the cross-component reviewable-date uniqueness rule above. A current
-- component must not create a replacement row while another unexcluded period
-- already represents that relationship/date.
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
    ) on conflict do nothing;
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

create or replace function public.current_billing_canonical_amount(p_amount text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_amount text := nullif(btrim(p_amount), '');
  v_numeric numeric(18, 6);
begin
  if v_amount is null then return null; end if;
  if v_amount !~ '^\d+(\.\d+)?$' then
    raise exception 'Enter an amount of zero or greater within the supported range.';
  end if;
  v_numeric := public.billing_renewal_snapshot_amount(v_amount);
  if v_numeric is null then
    raise exception 'Enter an amount of zero or greater within the supported range.';
  end if;
  return trim(trailing '.' from trim(trailing '0' from v_numeric::text));
end;
$$;

create or replace function public.current_billing_normalize_snapshot(
  p_plan_name text,
  p_components jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_component jsonb;
  v_components jsonb := '{}'::jsonb;
  v_type text;
  v_slot text;
  v_currency text;
  v_amount text;
  v_date_text text;
  v_date date;
  v_count integer := 0;
begin
  if p_components is null or jsonb_typeof(p_components) <> 'array' then
    raise exception 'Current Billing components must be an array.';
  end if;

  for v_component in select value from jsonb_array_elements(p_components)
  loop
    v_count := v_count + 1;
    if v_count > 2 or jsonb_typeof(v_component) <> 'object' then
      raise exception 'Select one main billing type and optionally Top-up credit (maximum two types).';
    end if;
    v_type := nullif(btrim(v_component ->> 'billingType'), '');
    if v_type is null or v_type not in ('Monthly', 'Yearly', 'Lifetime', 'One-time', 'Top-up') then
      raise exception 'Select a billing type for each component.';
    end if;
    v_slot := case when v_type = 'Top-up' then 'top_up' else 'primary' end;
    if v_components ? v_slot then
      raise exception 'This billing component is already configured.';
    end if;

    v_currency := upper(nullif(btrim(v_component ->> 'currency'), ''));
    if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
      raise exception 'Select a valid currency.';
    end if;
    v_amount := public.current_billing_canonical_amount(v_component ->> 'amount');
    v_date_text := nullif(btrim(case
      when v_type in ('Monthly', 'Yearly') then v_component ->> 'nextRenewalDate'
      when v_type = 'Top-up' then v_component ->> 'lastTopUpDate'
      else v_component ->> 'purchaseDate'
    end), '');
    v_date := null;
    if v_date_text is not null then
      begin
        if v_date_text !~ '^\d{4}-\d{2}-\d{2}$' then raise data_exception; end if;
        v_date := v_date_text::date;
        if to_char(v_date, 'YYYY-MM-DD') <> v_date_text then raise data_exception; end if;
      exception when others then
        raise exception 'Enter a valid billing date.';
      end;
    end if;

    v_components := v_components || jsonb_build_object(v_slot, jsonb_build_object(
      'billingType', v_type,
      'currency', v_currency,
      'amount', v_amount,
      'nextRenewalDate', case when v_type in ('Monthly', 'Yearly') then v_date else null end,
      'purchaseDate', case when v_type in ('Lifetime', 'One-time') then v_date else null end,
      'lastTopUpDate', case when v_type = 'Top-up' then v_date else null end
    ));
  end loop;

  return jsonb_build_object(
    'planName', btrim(coalesce(p_plan_name, '')),
    'components', v_components
  );
end;
$$;

create or replace function public.current_billing_revision(p_relationship_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_revision jsonb;
begin
  select jsonb_build_object(
    'planName', btrim(coalesce(link.plan_name, '')),
    'components', coalesce((
      select jsonb_object_agg(component_data.slot, component_data.payload)
      from (
        select
          case when component.billing_type = 'Top-up' then 'top_up' else 'primary' end as slot,
          jsonb_build_object(
            'id', component.id,
            'billingType', component.billing_type,
            'currency', nullif(upper(btrim(component.currency)), ''),
            'amount', public.current_billing_canonical_amount(component.amount),
            'nextRenewalDate', component.next_renewal_date,
            'purchaseDate', component.purchase_date,
            'lastTopUpDate', component.last_top_up_date
          ) as payload
        from public.tool_link_billing_components as component
        where component.tool_email_link_id = link.id
          and component.retired_at is null
        order by case when component.billing_type = 'Top-up' then 2 else 1 end
      ) as component_data
    ), '{}'::jsonb)
  ) into v_revision
  from public.tool_email_links as link
  where link.id = p_relationship_id;
  return v_revision;
end;
$$;

create or replace function public.current_billing_diff(
  p_before jsonb,
  p_after jsonb,
  p_mode text
)
returns table (changed_fields text[], classifications text[])
language plpgsql
immutable
set search_path = public
as $$
declare
  v_changed text[] := '{}'::text[];
  v_classes text[] := '{}'::text[];
  v_slot text;
  v_before jsonb;
  v_after jsonb;
  v_field text;
  v_before_type text;
  v_after_type text;
  v_before_amount text;
  v_after_amount text;
  v_before_currency text;
  v_after_currency text;
begin
  if p_mode not in ('change', 'correction') then
    raise exception 'Select whether this is a billing change or correction.';
  end if;
  if p_before ->> 'planName' is distinct from p_after ->> 'planName' then
    v_changed := array_append(v_changed, 'plan_name');
    if p_mode = 'change' then v_classes := array_append(v_classes, 'plan_changed'); end if;
  end if;

  foreach v_slot in array array['primary', 'top_up']
  loop
    v_before := p_before #> array['components', v_slot];
    v_after := p_after #> array['components', v_slot];
    if v_before is null and v_after is null then continue; end if;
    if v_before is null or v_after is null then
      v_changed := array_append(v_changed, 'component_configuration');
      if p_mode = 'change' then
        v_classes := array_append(v_classes, case when v_before is null then 'component_added' else 'component_removed' end);
      end if;
      continue;
    end if;

    foreach v_field in array array['billingType', 'amount', 'currency', 'nextRenewalDate', 'purchaseDate', 'lastTopUpDate']
    loop
      if v_before ->> v_field is distinct from v_after ->> v_field then
        v_changed := array_append(v_changed, case v_field
          when 'billingType' then 'billing_type'
          when 'nextRenewalDate' then 'next_renewal_date'
          when 'purchaseDate' then 'purchase_date'
          when 'lastTopUpDate' then 'last_top_up_date'
          else lower(v_field) end);
      end if;
    end loop;

    if p_mode = 'change' then
      v_before_type := v_before ->> 'billingType';
      v_after_type := v_after ->> 'billingType';
      if v_before_type is distinct from v_after_type then
        v_classes := array_append(v_classes, case
          when v_before_type in ('Monthly', 'Yearly') and v_after_type in ('Monthly', 'Yearly')
            then 'billing_cycle_changed' else 'billing_type_changed' end);
      end if;
      v_before_currency := v_before ->> 'currency';
      v_after_currency := v_after ->> 'currency';
      if v_before_currency is distinct from v_after_currency then
        v_classes := array_append(v_classes, 'currency_changed');
      end if;
      v_before_amount := v_before ->> 'amount';
      v_after_amount := v_after ->> 'amount';
      if v_before_amount is distinct from v_after_amount then
        v_classes := array_append(v_classes, case
          when v_before_amount is null then 'amount_recorded'
          when v_after_amount is null then 'amount_cleared'
          when v_before_currency is not null and v_before_currency = v_after_currency
            and v_before_amount::numeric < v_after_amount::numeric then 'price_increased'
          when v_before_currency is not null and v_before_currency = v_after_currency
            and v_before_amount::numeric > v_after_amount::numeric then 'price_decreased'
          else 'amount_changed' end);
      end if;
      if v_before ->> 'nextRenewalDate' is distinct from v_after ->> 'nextRenewalDate' then
        v_classes := array_append(v_classes, 'renewal_date_changed');
      end if;
      if v_before ->> 'purchaseDate' is distinct from v_after ->> 'purchaseDate' then
        v_classes := array_append(v_classes, 'purchase_date_changed');
      end if;
      if v_before ->> 'lastTopUpDate' is distinct from v_after ->> 'lastTopUpDate' then
        v_classes := array_append(v_classes, 'last_top_up_date_changed');
      end if;
    end if;
  end loop;

  return query
  select
    array(
      select deduplicated.value
      from (
        select item.value, min(item.position) as first_position
        from unnest(v_changed) with ordinality as item(value, position)
        group by item.value
      ) as deduplicated
      order by deduplicated.first_position
    ),
    case when p_mode = 'correction' then '{}'::text[] else
      array(
        select deduplicated.value
        from (
          select item.value, min(item.position) as first_position
          from unnest(v_classes) with ordinality as item(value, position)
          group by item.value
        ) as deduplicated
        order by deduplicated.first_position
      )
    end;
end;
$$;

create or replace function public.update_current_billing(
  p_relationship_id uuid,
  p_request_id uuid,
  p_effective_date date,
  p_mode text,
  p_expected_revision jsonb,
  p_plan_name text,
  p_components jsonb,
  p_reason text default null,
  p_local_date date default null
)
returns table (
  relationship_id uuid,
  billing_event_id uuid,
  previous_recurring_component_id uuid,
  new_recurring_component_id uuid,
  excluded_period_count integer,
  was_already_applied boolean,
  was_no_op boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_local_date date := coalesce(p_local_date, current_date);
  v_reason text := nullif(btrim(p_reason), '');
  v_link public.tool_email_links%rowtype;
  v_existing_event public.subscription_billing_events%rowtype;
  v_before_revision jsonb;
  v_before_snapshot jsonb;
  v_after_snapshot jsonb;
  v_before_primary jsonb;
  v_after_primary jsonb;
  v_after_top_up jsonb;
  v_changed_fields text[];
  v_classifications text[];
  v_old_primary public.tool_link_billing_components%rowtype;
  v_old_top_up public.tool_link_billing_components%rowtype;
  v_previous_recurring_id uuid;
  v_new_recurring_id uuid;
  v_primary_id uuid;
  v_top_up_id uuid;
  v_recurring_boundary boolean := false;
  v_changed_at timestamptz := clock_timestamp();
  v_anchor date;
  v_next_date date;
  v_new_anchor date;
  v_candidate date;
  v_sequence integer;
  v_excluded integer := 0;
  v_primary_type text;
  v_billing_type text;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if p_request_id is null then raise exception 'A Current Billing request ID is required.'; end if;
  if p_effective_date is null then raise exception 'An effective date is required.'; end if;
  if p_mode not in ('change', 'correction') then raise exception 'Select whether this is a billing change or correction.'; end if;
  if v_local_date < current_date - 1 or v_local_date > current_date + 1 then
    raise exception 'The local calendar date is invalid.';
  end if;
  if p_mode = 'correction' and p_effective_date <> v_local_date then
    raise exception 'A correction becomes operational on its save date.';
  end if;
  if p_mode = 'change' and p_effective_date > v_local_date then
    raise exception 'Future billing changes are not supported.';
  end if;

  v_after_snapshot := public.current_billing_normalize_snapshot(p_plan_name, p_components);
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 1));
  perform pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0));

  select event.* into v_existing_event
  from public.subscription_billing_events as event
  where event.id = p_request_id;
  if found then
    if v_existing_event.user_id <> v_user_id
      or v_existing_event.tool_email_link_id <> p_relationship_id
      or v_existing_event.mode <> p_mode
      or v_existing_event.effective_date <> p_effective_date
      or v_existing_event.reason is distinct from v_reason
      or v_existing_event.after_snapshot <> v_after_snapshot then
      raise exception 'This Current Billing request ID is already in use.';
    end if;
    return query select p_relationship_id, p_request_id,
      v_existing_event.previous_recurring_component_id,
      v_existing_event.new_recurring_component_id,
      (select count(*)::integer from public.billing_renewal_periods as period
       where period.excluded_by_billing_event_id = p_request_id), true, false;
    return;
  end if;

  select link.* into v_link
  from public.tool_email_links as link
  where link.id = p_relationship_id and link.user_id = v_user_id
  for update;
  if not found then raise exception 'The selected relationship is no longer available.'; end if;
  if v_link.unlinked_at is not null then raise exception 'Historical relationships cannot be edited.'; end if;
  if v_link.status <> 'Active' or v_link.plan not in ('Active', 'Paid') then
    raise exception 'Only an Active paid relationship can update Current Billing.';
  end if;
  if (select count(*) from public.tool_link_billing_components as component
      where component.tool_email_link_id = p_relationship_id and component.retired_at is null
        and component.billing_type <> 'Top-up') > 1
    or (select count(*) from public.tool_link_billing_components as component
      where component.tool_email_link_id = p_relationship_id and component.retired_at is null
        and component.billing_type = 'Top-up') > 1 then
    raise exception 'Current Billing has an unsupported component configuration.';
  end if;

  select component.* into v_old_primary
  from public.tool_link_billing_components as component
  where component.tool_email_link_id = p_relationship_id
    and component.retired_at is null and component.billing_type <> 'Top-up'
  for update;
  select component.* into v_old_top_up
  from public.tool_link_billing_components as component
  where component.tool_email_link_id = p_relationship_id
    and component.retired_at is null and component.billing_type = 'Top-up'
  for update;

  v_before_revision := public.current_billing_revision(p_relationship_id);
  if p_expected_revision is null or p_expected_revision <> v_before_revision then
    raise exception 'Current Billing changed. Reopen the editor before saving.';
  end if;
  v_before_snapshot := v_before_revision #- '{components,primary,id}' #- '{components,top_up,id}';
  select diff.changed_fields, diff.classifications
  into v_changed_fields, v_classifications
  from public.current_billing_diff(v_before_snapshot, v_after_snapshot, p_mode) as diff;
  if coalesce(cardinality(v_changed_fields), 0) = 0 then
    return query select p_relationship_id, null::uuid, null::uuid, null::uuid, 0, false, true;
    return;
  end if;

  v_before_primary := v_before_snapshot #> '{components,primary}';
  v_after_primary := v_after_snapshot #> '{components,primary}';
  v_after_top_up := v_after_snapshot #> '{components,top_up}';
  v_previous_recurring_id := case when v_old_primary.billing_type in ('Monthly', 'Yearly') then v_old_primary.id else null end;
  v_recurring_boundary := p_mode = 'change'
    and (v_before_snapshot ->> 'planName' is distinct from (v_after_snapshot ->> 'planName')
      or v_before_primary is distinct from v_after_primary)
    and (v_old_primary.billing_type in ('Monthly', 'Yearly')
      or v_after_primary ->> 'billingType' in ('Monthly', 'Yearly'));

  if v_recurring_boundary and v_old_primary.id is not null
    and v_old_primary.billing_type in ('Monthly', 'Yearly') then
    if exists (
      select 1 from public.billing_renewal_periods as period
      where period.user_id = v_user_id
        and period.tool_email_link_id = p_relationship_id
        and period.billing_component_id = v_old_primary.id
        and period.resolution is not null
        and coalesce(period.billing_date, period.scheduled_renewal_date) >= p_effective_date
    ) then
      raise exception 'The effective date conflicts with a resolved renewal period.';
    end if;
    v_anchor := coalesce(v_old_primary.recurrence_anchor_date, v_old_primary.next_renewal_date);
    if v_anchor is not null then
      for v_sequence in 0..1199 loop
        v_candidate := public.billing_renewal_date_from_anchor(v_anchor, v_old_primary.billing_type, v_sequence);
        exit when v_candidate >= p_effective_date;
        insert into public.billing_renewal_periods (
          user_id, tool_email_link_id, billing_component_id, scheduled_renewal_date,
          billing_date, plan_name_snapshot, billing_type_snapshot,
          currency_snapshot, amount_snapshot
        ) values (
          v_user_id, p_relationship_id, v_old_primary.id, v_candidate,
          v_candidate, nullif(btrim(v_link.plan_name), ''), v_old_primary.billing_type,
          case when upper(btrim(v_old_primary.currency)) ~ '^[A-Z]{3}$'
            then upper(btrim(v_old_primary.currency)) else null end,
          public.billing_renewal_snapshot_amount(v_old_primary.amount)
        ) on conflict do nothing;
      end loop;
      if v_candidate < p_effective_date then
        raise exception 'Current Billing renewal materialisation exceeded its safety limit.';
      end if;
    end if;
  end if;

  -- Reconcile the primary component. Genuine recurring boundaries always
  -- preserve the previous recurring row; corrections update in place unless
  -- the component changes between recurring and non-recurring semantics.
  if v_recurring_boundary then
    if v_old_primary.id is not null and v_old_primary.billing_type in ('Monthly', 'Yearly') then
      update public.tool_link_billing_components
      set retired_at = v_changed_at
      where id = v_old_primary.id and tool_email_link_id = p_relationship_id and retired_at is null;
    elsif v_old_primary.id is not null and v_before_primary is distinct from v_after_primary then
      delete from public.tool_link_billing_components
      where id = v_old_primary.id and tool_email_link_id = p_relationship_id and retired_at is null;
    end if;
    v_primary_id := null;
  else
    v_primary_id := v_old_primary.id;
  end if;

  if v_after_primary is null then
    if not v_recurring_boundary and v_old_primary.id is not null then
      if v_old_primary.billing_type in ('Monthly', 'Yearly') then
        update public.tool_link_billing_components set retired_at = v_changed_at
        where id = v_old_primary.id and tool_email_link_id = p_relationship_id and retired_at is null;
      else
        delete from public.tool_link_billing_components
        where id = v_old_primary.id and tool_email_link_id = p_relationship_id and retired_at is null;
      end if;
    end if;
    v_primary_id := null;
  else
    v_primary_type := v_after_primary ->> 'billingType';
    v_next_date := nullif(v_after_primary ->> 'nextRenewalDate', '')::date;
    v_new_anchor := null;
    if v_primary_type in ('Monthly', 'Yearly') and v_next_date is not null then
      if v_old_primary.id is not null and v_old_primary.billing_type = v_primary_type
        and v_old_primary.recurrence_anchor_date is not null
        and public.billing_renewal_sequence_index(v_old_primary.recurrence_anchor_date, v_primary_type, v_next_date) is not null then
        v_new_anchor := v_old_primary.recurrence_anchor_date;
      else
        v_new_anchor := v_next_date;
      end if;
      if v_next_date < p_effective_date then
        raise exception 'Next renewal cannot be earlier than the effective date.';
      end if;
    end if;

    if v_primary_id is not null and v_old_primary.billing_type = v_primary_type then
      if v_before_primary is distinct from v_after_primary then
        update public.tool_link_billing_components as component
        set amount = v_after_primary ->> 'amount',
          currency = v_after_primary ->> 'currency',
          next_renewal_date = v_next_date,
          purchase_date = nullif(v_after_primary ->> 'purchaseDate', '')::date,
          last_top_up_date = null,
          recurrence_anchor_date = case when v_primary_type in ('Monthly', 'Yearly') then v_new_anchor else null end
        where component.id = v_primary_id
          and component.tool_email_link_id = p_relationship_id
          and component.retired_at is null;
      end if;
    else
      if v_primary_id is not null then
        if v_old_primary.billing_type in ('Monthly', 'Yearly') then
          update public.tool_link_billing_components set retired_at = v_changed_at
          where id = v_primary_id and tool_email_link_id = p_relationship_id and retired_at is null;
        else
          delete from public.tool_link_billing_components
          where id = v_primary_id and tool_email_link_id = p_relationship_id and retired_at is null;
        end if;
      end if;
      insert into public.tool_link_billing_components (
        tool_email_link_id, billing_type, amount, currency, next_renewal_date,
        purchase_date, last_top_up_date, recurrence_anchor_date
      ) values (
        p_relationship_id, v_primary_type, v_after_primary ->> 'amount',
        v_after_primary ->> 'currency', v_next_date,
        nullif(v_after_primary ->> 'purchaseDate', '')::date, null,
        case when v_primary_type in ('Monthly', 'Yearly') then v_new_anchor else null end
      ) returning id into v_primary_id;
    end if;
    if v_primary_type in ('Monthly', 'Yearly') then v_new_recurring_id := v_primary_id; end if;
  end if;

  -- Top-up remains a distinct non-recurring component.
  if v_after_top_up is null then
    if v_old_top_up.id is not null then
      delete from public.tool_link_billing_components
      where id = v_old_top_up.id and tool_email_link_id = p_relationship_id;
    end if;
    v_top_up_id := null;
  elsif v_old_top_up.id is not null then
    if v_before_snapshot #> '{components,top_up}' is distinct from v_after_top_up then
      update public.tool_link_billing_components as component
      set amount = v_after_top_up ->> 'amount',
        currency = v_after_top_up ->> 'currency',
        last_top_up_date = nullif(v_after_top_up ->> 'lastTopUpDate', '')::date
      where component.id = v_old_top_up.id
        and component.tool_email_link_id = p_relationship_id
        and component.billing_type = 'Top-up' and component.retired_at is null;
    end if;
    v_top_up_id := v_old_top_up.id;
  else
    insert into public.tool_link_billing_components (
      tool_email_link_id, billing_type, amount, currency, last_top_up_date
    ) values (
      p_relationship_id, 'Top-up', v_after_top_up ->> 'amount',
      v_after_top_up ->> 'currency', nullif(v_after_top_up ->> 'lastTopUpDate', '')::date
    ) returning id into v_top_up_id;
  end if;

  v_billing_type := concat_ws(', ', v_after_primary ->> 'billingType', v_after_top_up ->> 'billingType');
  update public.tool_email_links as link
  set plan_name = nullif(v_after_snapshot ->> 'planName', ''),
    billing_type = nullif(v_billing_type, ''),
    amount = case when v_after_primary is not null
      then v_after_primary ->> 'amount' else v_after_top_up ->> 'amount' end,
    currency = case when v_after_primary is not null
      then v_after_primary ->> 'currency' else v_after_top_up ->> 'currency' end,
    next_charge_date = nullif(v_after_primary ->> 'nextRenewalDate', '')::date,
    purchase_date = nullif(v_after_primary ->> 'purchaseDate', '')::date,
    last_top_up_date = nullif(v_after_top_up ->> 'lastTopUpDate', '')::date
  where link.id = p_relationship_id and link.user_id = v_user_id
    and link.unlinked_at is null and link.status = 'Active' and link.plan in ('Active', 'Paid');
  if not found then raise exception 'The relationship changed before Current Billing could be saved.'; end if;

  insert into public.subscription_billing_events (
    id, user_id, tool_email_link_id, mode, effective_date, reason,
    before_snapshot, after_snapshot, changed_fields, classifications,
    previous_recurring_component_id, new_recurring_component_id, created_at
  ) values (
    p_request_id, v_user_id, p_relationship_id, p_mode, p_effective_date, v_reason,
    v_before_snapshot, v_after_snapshot, v_changed_fields, v_classifications,
    v_previous_recurring_id, v_new_recurring_id, v_changed_at
  );

  if v_recurring_boundary and v_previous_recurring_id is not null then
    update public.billing_renewal_periods as period
    set excluded_at = v_changed_at,
      excluded_by_billing_event_id = p_request_id
    where period.user_id = v_user_id
      and period.tool_email_link_id = p_relationship_id
      and period.billing_component_id = v_previous_recurring_id
      and period.resolution is null and period.excluded_at is null
      and coalesce(period.billing_date, period.scheduled_renewal_date) >= p_effective_date;
    get diagnostics v_excluded = row_count;
  end if;

  return query select p_relationship_id, p_request_id,
    v_previous_recurring_id, v_new_recurring_id, v_excluded, false, false;
end;
$$;

revoke all on function public.current_billing_canonical_amount(text) from public, anon, authenticated;
revoke all on function public.current_billing_normalize_snapshot(text, jsonb) from public, anon, authenticated;
revoke all on function public.current_billing_revision(uuid) from public, anon, authenticated;
revoke all on function public.current_billing_diff(jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.update_current_billing(uuid, uuid, date, text, jsonb, text, jsonb, text, date)
  from public, anon;
grant execute on function public.update_current_billing(uuid, uuid, date, text, jsonb, text, jsonb, text, date)
  to authenticated;
revoke all on function public.sync_due_billing_renewal_periods(uuid, uuid, date)
  from public, anon;
grant execute on function public.sync_due_billing_renewal_periods(uuid, uuid, date)
  to authenticated;

commit;
