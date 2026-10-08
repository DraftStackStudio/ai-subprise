-- Strictly read-only live preflight for migration 0031.
-- Run before applying 0031. No application function is invoked.

with
required_columns(table_name, column_name) as (
  values
    ('tool_email_links', 'status'),
    ('tool_email_links', 'unlinked_at'),
    ('tool_link_billing_components', 'retired_at'),
    ('billing_renewal_periods', 'excluded_at'),
    ('billing_renewal_periods', 'excluded_by_lifecycle_event_id'),
    ('subscription_lifecycle_events', 'previous_lifecycle_state'),
    ('subscription_lifecycle_events', 'next_lifecycle_state'),
    ('subscription_lifecycle_events', 'event_kind')
),
prerequisites as (
  select
    to_regclass('public.subscription_lifecycle_events') is not null
      as lifecycle_table_exists,
    not exists (
      select 1
      from required_columns as required
      where not exists (
        select 1
        from information_schema.columns as column_info
        where column_info.table_schema = 'public'
          and column_info.table_name = required.table_name
          and column_info.column_name = required.column_name
      )
    ) as required_columns_exist,
    (
      select column_info.is_nullable = 'NO'
        and column_info.column_default = '''Running''::text'
      from information_schema.columns as column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = 'tool_email_links'
        and column_info.column_name = 'status'
    ) as relationship_status_has_expected_pre0031_contract,
    not exists (
      select 1
      from (values
        ('subscription_lifecycle_events_previous_state_check'),
        ('subscription_lifecycle_events_next_state_check'),
        ('subscription_lifecycle_events_transition_check')
      ) as expected(constraint_name)
      where not exists (
        select 1 from pg_constraint as constraint_info
        where constraint_info.conrelid = 'public.subscription_lifecycle_events'::regclass
          and constraint_info.conname = expected.constraint_name
      )
    ) as lifecycle_constraints_exist
),
status_checks as (
  select
    count(*) filter (
      where constraint_info.conname = 'tool_email_links_status_check'
    ) as canonical_named_check_count,
    count(*) filter (
      where constraint_info.conname <> 'tool_email_links_status_check'
    ) as conflicting_status_check_count
  from pg_constraint as constraint_info
  where constraint_info.conrelid = 'public.tool_email_links'::regclass
    and constraint_info.contype = 'c'
    and lower(pg_get_constraintdef(constraint_info.oid)) like '%status%'
),
relationship_states as (
  select
    count(*) filter (
      where link.status not in (
        'Active', 'Running', 'Paused', 'On a Break', 'On a break', 'Goodbye',
        'Goodbye it was a journey', 'Goodbye, it was a journey'
      )
    ) as unsupported_relationship_status_count,
    count(*) filter (where link.status = 'Running') as running_to_active_count,
    count(*) filter (where link.status in ('On a Break', 'On a break')) as legacy_to_paused_count,
    count(*) filter (where link.status in (
      'Goodbye it was a journey', 'Goodbye, it was a journey'
    )) as legacy_to_goodbye_count,
    count(*) filter (where link.status = 'Active') as active_unchanged_count,
    count(*) filter (where link.status = 'Paused') as paused_unchanged_count,
    count(*) filter (where link.status = 'Goodbye') as goodbye_unchanged_count,
    count(*) filter (where link.unlinked_at is null) as linked_relationship_count,
    count(*) filter (where link.unlinked_at is not null) as unlinked_relationship_count,
    count(*) as relationship_count
  from public.tool_email_links as link
),
ledger_states as (
  select
    count(*) filter (
      where event.previous_lifecycle_state not in (
        'Active', 'Running', 'Paused', 'On a Break', 'On a break', 'Goodbye',
        'Goodbye it was a journey', 'Goodbye, it was a journey'
      )
        or event.next_lifecycle_state not in (
          'Active', 'Running', 'Paused', 'On a Break', 'On a break', 'Goodbye',
          'Goodbye it was a journey', 'Goodbye, it was a journey'
        )
    ) as unsupported_ledger_state_count,
    count(*) filter (
      where event.previous_lifecycle_state not in ('Active', 'Paused', 'Goodbye')
         or event.next_lifecycle_state not in ('Active', 'Paused', 'Goodbye')
    ) as ledger_rows_requiring_normalisation,
    count(*) as lifecycle_event_count
  from public.subscription_lifecycle_events as event
),
baseline as (
  select
    (select count(*) from public.tool_link_billing_components) as component_count,
    (select count(*) from public.tool_link_billing_components where retired_at is not null)
      as retired_component_count,
    (select count(*) from public.billing_transactions) as payment_count,
    (select count(*) from public.billing_renewal_periods) as renewal_period_count,
    (select count(*) from public.billing_renewal_periods where resolution is not null)
      as resolved_period_count,
    (select count(*) from public.billing_renewal_periods where excluded_at is not null)
      as excluded_period_count,
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
),
already_applied as (
  select
    status_checks.canonical_named_check_count = 1
    and coalesce((
      select column_info.column_default = '''Active''::text'
      from information_schema.columns as column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = 'tool_email_links'
        and column_info.column_name = 'status'
    ), false)
    and relationship_states.running_to_active_count = 0
    and relationship_states.legacy_to_paused_count = 0
    and relationship_states.legacy_to_goodbye_count = 0
    and ledger_states.ledger_rows_requiring_normalisation = 0
      as migration_0031_already_applied
  from status_checks
  cross join relationship_states
  cross join ledger_states
)
select
  prerequisites.lifecycle_table_exists,
  prerequisites.required_columns_exist,
  prerequisites.relationship_status_has_expected_pre0031_contract,
  prerequisites.lifecycle_constraints_exist,
  status_checks.canonical_named_check_count,
  status_checks.conflicting_status_check_count,
  relationship_states.unsupported_relationship_status_count,
  relationship_states.running_to_active_count,
  relationship_states.legacy_to_paused_count,
  relationship_states.legacy_to_goodbye_count,
  relationship_states.active_unchanged_count,
  relationship_states.paused_unchanged_count,
  relationship_states.goodbye_unchanged_count,
  relationship_states.linked_relationship_count,
  relationship_states.unlinked_relationship_count,
  relationship_states.relationship_count,
  ledger_states.unsupported_ledger_state_count,
  ledger_states.ledger_rows_requiring_normalisation,
  ledger_states.lifecycle_event_count,
  baseline.component_count,
  baseline.retired_component_count,
  baseline.payment_count,
  baseline.renewal_period_count,
  baseline.resolved_period_count,
  baseline.excluded_period_count,
  baseline.renewal_activity_count,
  preservation_fingerprints.relationships_except_status_fingerprint,
  preservation_fingerprints.billing_components_fingerprint,
  preservation_fingerprints.renewal_periods_fingerprint,
  preservation_fingerprints.payments_fingerprint,
  preservation_fingerprints.renewal_activity_fingerprint,
  preservation_fingerprints.lifecycle_events_except_states_fingerprint,
  already_applied.migration_0031_already_applied,
  (
    prerequisites.lifecycle_table_exists
    and prerequisites.required_columns_exist
    and prerequisites.relationship_status_has_expected_pre0031_contract
    and prerequisites.lifecycle_constraints_exist
    and status_checks.canonical_named_check_count = 0
    and status_checks.conflicting_status_check_count = 0
    and relationship_states.unsupported_relationship_status_count = 0
    and ledger_states.unsupported_ledger_state_count = 0
    and not already_applied.migration_0031_already_applied
  ) as migration_0031_preflight_passed
from prerequisites
cross join status_checks
cross join relationship_states
cross join ledger_states
cross join baseline
cross join preservation_fingerprints
cross join already_applied;
