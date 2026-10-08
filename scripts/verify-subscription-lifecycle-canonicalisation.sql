-- Strictly read-only durable verification for migration 0031.
-- It verifies canonical state storage and preserves 0030 billing/renewal
-- contracts without assuming fixed application-data counts.

with
relationship_column as (
  select
    column_info.is_nullable = 'NO' as is_not_null,
    column_info.column_default = '''Active''::text' as default_is_active
  from information_schema.columns as column_info
  where column_info.table_schema = 'public'
    and column_info.table_name = 'tool_email_links'
    and column_info.column_name = 'status'
),
constraint_contract as (
  select
    exists (
      select 1
      from pg_constraint as constraint_info
      where constraint_info.conrelid = 'public.tool_email_links'::regclass
        and constraint_info.conname = 'tool_email_links_status_check'
        and lower(pg_get_constraintdef(constraint_info.oid)) like '%active%paused%goodbye%'
        and lower(pg_get_constraintdef(constraint_info.oid)) not like '%running%'
        and lower(pg_get_constraintdef(constraint_info.oid)) not like '%on a break%'
    ) as relationship_status_check_is_canonical,
    exists (
      select 1
      from pg_constraint as constraint_info
      where constraint_info.conrelid = 'public.subscription_lifecycle_events'::regclass
        and constraint_info.conname = 'subscription_lifecycle_events_previous_state_check'
        and lower(pg_get_constraintdef(constraint_info.oid)) like '%active%paused%goodbye%'
        and lower(pg_get_constraintdef(constraint_info.oid)) not like '%on a break%'
    ) as previous_state_check_is_canonical,
    exists (
      select 1
      from pg_constraint as constraint_info
      where constraint_info.conrelid = 'public.subscription_lifecycle_events'::regclass
        and constraint_info.conname = 'subscription_lifecycle_events_next_state_check'
        and lower(pg_get_constraintdef(constraint_info.oid)) like '%active%paused%goodbye%'
        and lower(pg_get_constraintdef(constraint_info.oid)) not like '%on a break%'
    ) as next_state_check_is_canonical,
    exists (
      select 1
      from pg_constraint as constraint_info
      where constraint_info.conrelid = 'public.subscription_lifecycle_events'::regclass
        and constraint_info.conname = 'subscription_lifecycle_events_transition_check'
        and lower(pg_get_constraintdef(constraint_info.oid)) like '%event_kind = ''paused''%next_lifecycle_state = ''paused''%'
        and lower(pg_get_constraintdef(constraint_info.oid)) like '%event_kind = ''resumed''%previous_lifecycle_state = ''paused''%'
        and lower(pg_get_constraintdef(constraint_info.oid)) not like '%on a break%'
    ) as transition_check_is_canonical
),
relationship_states as (
  select
    count(*) filter (where link.status in (
      'Running', 'On a Break', 'On a break',
      'Goodbye it was a journey', 'Goodbye, it was a journey'
    )) as legacy_relationship_status_count,
    count(*) filter (where link.status not in ('Active', 'Paused', 'Goodbye'))
      as unsupported_relationship_status_count,
    count(*) filter (where link.status = 'Active') as active_count,
    count(*) filter (where link.status = 'Paused') as paused_count,
    count(*) filter (where link.status = 'Goodbye') as goodbye_count
  from public.tool_email_links as link
),
ledger_states as (
  select
    count(*) filter (
      where event.previous_lifecycle_state not in ('Active', 'Paused', 'Goodbye')
         or event.next_lifecycle_state not in ('Active', 'Paused', 'Goodbye')
    ) as noncanonical_ledger_state_count,
    count(*) filter (
      where not (
        (event.event_kind = 'paused' and event.previous_lifecycle_state = 'Active' and event.next_lifecycle_state = 'Paused')
        or (event.event_kind = 'ended' and event.previous_lifecycle_state = 'Active' and event.next_lifecycle_state = 'Goodbye')
        or (event.event_kind = 'resumed' and event.previous_lifecycle_state = 'Paused' and event.next_lifecycle_state = 'Active')
        or (event.event_kind in ('restarted', 'restarted_plan_changed') and event.previous_lifecycle_state = 'Goodbye' and event.next_lifecycle_state = 'Active')
      )
    ) as invalid_transition_count,
    count(*) as lifecycle_event_count
  from public.subscription_lifecycle_events as event
),
classification as (
  select
    count(*) filter (
      where component.billing_type in ('Monthly', 'Yearly')
        and component.retired_at is null
        and (link.unlinked_at is not null or link.status in ('Paused', 'Goodbye'))
    ) as recurring_classification_mismatch_count,
    count(*) filter (
      where component.billing_type not in ('Monthly', 'Yearly')
        and component.retired_at is not null
    ) as invalid_non_recurring_retirement_count
  from public.tool_link_billing_components as component
  join public.tool_email_links as link on link.id = component.tool_email_link_id
),
current_recurring_conflicts as (
  select count(*) as conflict_count
  from (
    select component.tool_email_link_id
    from public.tool_link_billing_components as component
    where component.billing_type in ('Monthly', 'Yearly')
      and component.retired_at is null
    group by component.tool_email_link_id
    having count(*) > 1
  ) as conflict
),
integrity as (
  select
    (select count(*) from public.tool_link_billing_components as component
     left join public.tool_email_links as link on link.id = component.tool_email_link_id
     where link.id is null) as orphan_component_count,
    (select count(*) from public.billing_renewal_periods as period
     left join public.tool_email_links as link on link.id = period.tool_email_link_id
     left join public.tool_link_billing_components as component on component.id = period.billing_component_id
     where link.id is null or component.id is null) as orphan_period_count,
    (select count(*) from public.billing_transactions as payment
     left join public.tool_email_links as link on link.id = payment.tool_email_link_id
     where link.id is null) as orphan_payment_count,
    (select count(*) from public.billing_renewal_activity as activity
     left join public.tool_email_links as link on link.id = activity.tool_email_link_id
     left join public.billing_renewal_periods as period on period.id = activity.billing_renewal_period_id
     where link.id is null or period.id is null) as orphan_activity_count,
    (select count(*) from public.billing_renewal_periods as period
     where (period.excluded_at is null) <> (period.excluded_by_lifecycle_event_id is null)
        or (period.resolution is not null and period.excluded_at is not null)) as invalid_exclusion_count
),
permissions as (
  select
    exists (
      select 1
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'subscription_lifecycle_events'
        and relation.relrowsecurity
    )
    and exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'subscription_lifecycle_events'
        and policyname = 'subscription_lifecycle_events_owner_select'
        and cmd = 'SELECT'
        and coalesce(qual, '') like '%auth.uid()%'
        and coalesce(qual, '') like '%user_id%'
    )
    and has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'SELECT')
    and not has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'INSERT')
    and not has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'DELETE')
    and not has_table_privilege('anon', 'public.subscription_lifecycle_events', 'SELECT')
    and not has_table_privilege('anon', 'public.subscription_lifecycle_events', 'INSERT')
    and not has_table_privilege('anon', 'public.subscription_lifecycle_events', 'UPDATE')
    and not has_table_privilege('anon', 'public.subscription_lifecycle_events', 'DELETE')
    as lifecycle_permission_contract_passed
),
rpc_contracts as (
  select
    coalesce(lower(pg_get_functiondef(to_regprocedure(
      'public.sync_due_billing_renewal_periods(uuid,uuid,date)'
    ))) like '%component.retired_at is null%', false)
    and coalesce(lower(pg_get_functiondef(to_regprocedure(
      'public.confirm_billing_renewal_paid(uuid,uuid)'
    ))) like '%period.excluded_at is null%', false)
    and coalesce(lower(pg_get_functiondef(to_regprocedure(
      'public.mark_billing_renewal_not_charged(uuid,uuid,text,text,text)'
    ))) like '%period.excluded_at is null%', false)
    and coalesce(lower(pg_get_functiondef(to_regprocedure(
      'public.update_billing_renewal_period_snapshot(uuid,uuid,text,text,numeric,date,text,date)'
    ))) like '%v_component_retired_at is null%', false)
    as protected_rpc_contract_passed
),
counts as (
  select
    (select count(*) from public.tool_email_links) as relationship_count,
    (select count(*) from public.tool_link_billing_components) as component_count,
    (select count(*) from public.billing_transactions) as payment_count,
    (select count(*) from public.billing_renewal_periods) as renewal_period_count,
    (select count(*) from public.billing_renewal_periods where excluded_at is not null) as excluded_period_count,
    (select count(*) from public.billing_renewal_activity) as renewal_activity_count
),
preservation_fingerprints as (
  select
    (select md5(coalesce(string_agg(
      (to_jsonb(link) - 'status')::text, '|' order by link.id::text
    ), '')) from public.tool_email_links as link) as relationships_except_status_fingerprint,
    (select md5(coalesce(string_agg(
      to_jsonb(component)::text, '|' order by component.id::text
    ), '')) from public.tool_link_billing_components as component) as billing_components_fingerprint,
    (select md5(coalesce(string_agg(
      to_jsonb(period)::text, '|' order by period.id::text
    ), '')) from public.billing_renewal_periods as period) as renewal_periods_fingerprint,
    (select md5(coalesce(string_agg(
      to_jsonb(payment)::text, '|' order by payment.id::text
    ), '')) from public.billing_transactions as payment) as payments_fingerprint,
    (select md5(coalesce(string_agg(
      to_jsonb(activity)::text, '|' order by activity.id::text
    ), '')) from public.billing_renewal_activity as activity) as renewal_activity_fingerprint,
    (select md5(coalesce(string_agg(
      (to_jsonb(event) - 'previous_lifecycle_state' - 'next_lifecycle_state')::text,
      '|' order by event.id::text
    ), '')) from public.subscription_lifecycle_events as event) as lifecycle_events_except_states_fingerprint
)
select
  relationship_column.is_not_null as relationship_status_is_not_null,
  relationship_column.default_is_active as relationship_status_default_is_active,
  constraint_contract.relationship_status_check_is_canonical,
  constraint_contract.previous_state_check_is_canonical,
  constraint_contract.next_state_check_is_canonical,
  constraint_contract.transition_check_is_canonical,
  relationship_states.legacy_relationship_status_count,
  relationship_states.unsupported_relationship_status_count,
  relationship_states.active_count,
  relationship_states.paused_count,
  relationship_states.goodbye_count,
  ledger_states.noncanonical_ledger_state_count,
  ledger_states.invalid_transition_count,
  ledger_states.invalid_transition_count = 0 as canonical_ledger_transitions_valid,
  ledger_states.lifecycle_event_count,
  classification.recurring_classification_mismatch_count,
  classification.invalid_non_recurring_retirement_count,
  current_recurring_conflicts.conflict_count as current_recurring_conflict_count,
  integrity.orphan_component_count,
  integrity.orphan_period_count,
  integrity.orphan_payment_count,
  integrity.orphan_activity_count,
  integrity.invalid_exclusion_count,
  permissions.lifecycle_permission_contract_passed,
  rpc_contracts.protected_rpc_contract_passed,
  counts.relationship_count,
  counts.component_count,
  counts.payment_count,
  counts.renewal_period_count,
  counts.excluded_period_count,
  counts.renewal_activity_count,
  preservation_fingerprints.relationships_except_status_fingerprint,
  preservation_fingerprints.billing_components_fingerprint,
  preservation_fingerprints.renewal_periods_fingerprint,
  preservation_fingerprints.payments_fingerprint,
  preservation_fingerprints.renewal_activity_fingerprint,
  preservation_fingerprints.lifecycle_events_except_states_fingerprint,
  (
    relationship_column.is_not_null
    and relationship_column.default_is_active
    and constraint_contract.relationship_status_check_is_canonical
    and constraint_contract.previous_state_check_is_canonical
    and constraint_contract.next_state_check_is_canonical
    and constraint_contract.transition_check_is_canonical
    and relationship_states.legacy_relationship_status_count = 0
    and relationship_states.unsupported_relationship_status_count = 0
    and ledger_states.noncanonical_ledger_state_count = 0
    and ledger_states.invalid_transition_count = 0
    and classification.recurring_classification_mismatch_count = 0
    and classification.invalid_non_recurring_retirement_count = 0
    and current_recurring_conflicts.conflict_count = 0
    and integrity.orphan_component_count = 0
    and integrity.orphan_period_count = 0
    and integrity.orphan_payment_count = 0
    and integrity.orphan_activity_count = 0
    and integrity.invalid_exclusion_count = 0
    and permissions.lifecycle_permission_contract_passed
    and rpc_contracts.protected_rpc_contract_passed
  ) as migration_0031_postcheck_passed
from relationship_column
cross join constraint_contract
cross join relationship_states
cross join ledger_states
cross join classification
cross join current_recurring_conflicts
cross join integrity
cross join permissions
cross join rpc_contracts
cross join counts
cross join preservation_fingerprints;
