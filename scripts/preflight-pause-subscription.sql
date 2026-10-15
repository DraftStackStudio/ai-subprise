-- Strictly read-only live preflight for migration 0032.
-- Makes no RPC calls and performs no database writes.
with
required_columns(table_name, column_name) as (
  values
    ('tool_email_links', 'status'),
    ('tool_email_links', 'plan'),
    ('tool_email_links', 'trial_resolved'),
    ('tool_email_links', 'next_charge_date'),
    ('tool_email_links', 'unlinked_at'),
    ('tool_link_billing_components', 'recurrence_anchor_date'),
    ('tool_link_billing_components', 'retired_at'),
    ('billing_renewal_periods', 'billing_date'),
    ('billing_renewal_periods', 'excluded_at'),
    ('billing_renewal_periods', 'excluded_by_lifecycle_event_id'),
    ('subscription_lifecycle_events', 'effective_date_precision'),
    ('subscription_lifecycle_events', 'planned_resume_date'),
    ('subscription_lifecycle_events', 'planned_resume_precision')
),
missing_columns as (
  select required.table_name, required.column_name
  from required_columns as required
  left join information_schema.columns as installed
    on installed.table_schema = 'public'
   and installed.table_name = required.table_name
   and installed.column_name = required.column_name
  where installed.column_name is null
),
required_functions(signature) as (
  values
    ('public.billing_renewal_date_from_anchor(date,text,integer)'),
    ('public.billing_renewal_snapshot_amount(text)'),
    ('public.sync_due_billing_renewal_periods(uuid,uuid,date)')
),
missing_functions as (
  select required.signature
  from required_functions as required
  where to_regprocedure(required.signature) is null
),
unsupported_statuses as (
  select link.status, count(*)::bigint as row_count
  from public.tool_email_links as link
  where link.status not in ('Active', 'Paused', 'Goodbye')
  group by link.status
),
multiple_current_recurring as (
  select component.tool_email_link_id, count(*)::bigint as component_count
  from public.tool_link_billing_components as component
  where component.billing_type in ('Monthly', 'Yearly')
    and component.retired_at is null
  group by component.tool_email_link_id
  having count(*) > 1
),
invalid_exclusions as (
  select period.id
  from public.billing_renewal_periods as period
  where (period.excluded_at is null) <> (period.excluded_by_lifecycle_event_id is null)
     or (period.resolution is not null and period.excluded_at is not null)
),
baseline as (
  select
    (select count(*) from public.tool_email_links) as relationship_count,
    (select count(*) from public.tool_link_billing_components) as component_count,
    (select count(*) from public.billing_transactions) as payment_count,
    (select count(*) from public.billing_renewal_periods) as renewal_period_count,
    (select count(*) from public.billing_renewal_periods where excluded_at is not null) as excluded_period_count,
    (select count(*) from public.billing_renewal_activity) as renewal_activity_count,
    (select count(*) from public.subscription_lifecycle_events) as lifecycle_event_count,
    (select md5(coalesce(string_agg(to_jsonb(link)::text, '|' order by link.id::text), ''))
       from public.tool_email_links as link) as relationship_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(component)::text, '|' order by component.id::text), ''))
       from public.tool_link_billing_components as component) as component_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(period)::text, '|' order by period.id::text), ''))
       from public.billing_renewal_periods as period) as renewal_period_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(payment)::text, '|' order by payment.id::text), ''))
       from public.billing_transactions as payment) as payment_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(activity)::text, '|' order by activity.id::text), ''))
       from public.billing_renewal_activity as activity) as renewal_activity_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(event)::text, '|' order by event.id::text), ''))
       from public.subscription_lifecycle_events as event) as lifecycle_event_fingerprint
),
checks as (
  select
    to_regclass('public.subscription_lifecycle_events') is not null as lifecycle_table_exists,
    not exists (select 1 from missing_columns) as required_columns_exist,
    not exists (select 1 from missing_functions) as required_functions_exist,
    to_regprocedure('public.pause_subscription(uuid,uuid,date,text,text,date,text,date)') is not null
      as migration_0032_already_applied,
    (select count(*) from unsupported_statuses) as unsupported_relationship_status_count,
    (select count(*) from multiple_current_recurring) as multiple_current_recurring_relationship_count,
    (select count(*) from invalid_exclusions) as invalid_exclusion_count,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.subscription_lifecycle_events'::regclass
        and conname = 'subscription_lifecycle_events_transition_check'
        and pg_get_constraintdef(oid) ilike '%Active%Paused%'
    ) as canonical_pause_transition_exists,
    exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and indexname = 'tool_link_billing_components_current_recurring_uidx'
    ) as current_recurring_unique_index_exists
)
select
  baseline.*,
  checks.*,
  (select count(*) from public.tool_email_links where status = 'Active' and unlinked_at is null and plan in ('Active', 'Paid'))
    as eligible_active_paid_relationship_count,
  (select count(*) from public.tool_email_links where status = 'Active' and unlinked_at is null and plan = 'Trial' and not coalesce(trial_resolved, false))
    as unresolved_active_trial_count,
  checks.lifecycle_table_exists
    and checks.required_columns_exist
    and checks.required_functions_exist
    and not checks.migration_0032_already_applied
    and checks.unsupported_relationship_status_count = 0
    and checks.multiple_current_recurring_relationship_count = 0
    and checks.invalid_exclusion_count = 0
    and checks.canonical_pause_transition_exists
    and checks.current_recurring_unique_index_exists
    as migration_0032_preflight_passed
from baseline cross join checks;
