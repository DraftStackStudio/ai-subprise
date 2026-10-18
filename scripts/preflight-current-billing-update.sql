-- Strictly read-only production preflight for migration 0034.
-- Run as one statement in Supabase SQL Editor. It invokes no application RPC.
with prerequisite_columns(table_name, column_name) as (
  values
    ('tool_email_links', 'id'),
    ('tool_email_links', 'user_id'),
    ('tool_email_links', 'status'),
    ('tool_email_links', 'plan'),
    ('tool_email_links', 'plan_name'),
    ('tool_email_links', 'next_charge_date'),
    ('tool_email_links', 'unlinked_at'),
    ('tool_link_billing_components', 'retired_at'),
    ('tool_link_billing_components', 'recurrence_anchor_date'),
    ('tool_link_billing_components', 'next_renewal_date'),
    ('billing_renewal_periods', 'billing_date'),
    ('billing_renewal_periods', 'excluded_at'),
    ('billing_renewal_periods', 'excluded_by_lifecycle_event_id'),
    ('billing_renewal_periods', 'resolution'),
    ('billing_renewal_periods', 'payment_transaction_id')
), missing_columns as (
  select required.*
  from prerequisite_columns as required
  where not exists (
    select 1
    from information_schema.columns as installed
    where installed.table_schema = 'public'
      and installed.table_name = required.table_name
      and installed.column_name = required.column_name
  )
), prerequisite_relations(relation_name) as (
  values
    ('public.tool_email_links'),
    ('public.tool_link_billing_components'),
    ('public.billing_transactions'),
    ('public.billing_renewal_periods'),
    ('public.billing_renewal_activity'),
    ('public.subscription_lifecycle_events')
), missing_relations as (
  select required.relation_name
  from prerequisite_relations as required
  where to_regclass(required.relation_name) is null
), prerequisite_functions(signature) as (
  values
    ('public.billing_renewal_date_from_anchor(date,text,integer)'),
    ('public.billing_renewal_sequence_index(date,text,date)'),
    ('public.billing_renewal_next_on_or_after(date,text,date)'),
    ('public.billing_renewal_snapshot_amount(text)'),
    ('public.sync_due_billing_renewal_periods(uuid,uuid,date)'),
    ('public.pause_subscription(uuid,uuid,date,text,text,date,text,date)'),
    ('public.resume_subscription(uuid,uuid,uuid,text,text,text,date,boolean,date)')
), missing_functions as (
  select required.signature
  from prerequisite_functions as required
  where to_regprocedure(required.signature) is null
), prerequisite_indexes(index_name) as (
  values
    ('public.tool_link_billing_components_current_recurring_uidx'),
    ('public.tool_link_billing_components_non_recurring_uidx'),
    ('public.billing_renewal_periods_relationship_date_idx'),
    ('public.billing_renewal_periods_unresolved_idx'),
    ('public.billing_renewal_periods_reviewable_idx')
), missing_indexes as (
  select required.index_name
  from prerequisite_indexes as required
  where to_regclass(required.index_name) is null
), tool_email_link_policies as (
  select
    installed.policyname,
    installed.cmd,
    regexp_replace(lower(coalesce(installed.qual, '')), '[[:space:]()]', '', 'g') as normalized_using,
    regexp_replace(lower(coalesce(installed.with_check, '')), '[[:space:]()]', '', 'g') as normalized_check
  from pg_policies as installed
  where installed.schemaname = 'public'
    and installed.tablename = 'tool_email_links'
    and installed.permissive = 'PERMISSIVE'
    and ('public' = any(installed.roles) or 'authenticated' = any(installed.roles))
), tool_email_link_policy_evaluation as (
  select
    policy.*,
    policy.normalized_using in (
      'auth.uid=user_id',
      'user_id=auth.uid',
      'auth.uid=tool_email_links.user_id',
      'tool_email_links.user_id=auth.uid'
    ) as owner_using,
    policy.normalized_check in (
      'auth.uid=user_id',
      'user_id=auth.uid',
      'auth.uid=tool_email_links.user_id',
      'tool_email_links.user_id=auth.uid'
    ) as owner_check
  from tool_email_link_policies as policy
), tool_email_link_policy_contract as (
  select
    coalesce(bool_or(cmd in ('SELECT', 'ALL') and owner_using), false) as select_covered,
    coalesce(bool_or(cmd in ('INSERT', 'ALL') and owner_check), false) as insert_covered,
    coalesce(bool_or(cmd in ('UPDATE', 'ALL') and owner_using and owner_check), false) as update_covered,
    coalesce(bool_or(cmd in ('DELETE', 'ALL') and owner_using), false) as delete_covered
  from tool_email_link_policy_evaluation
), unsafe_tool_email_link_policies as (
  select policy.policyname
  from tool_email_link_policy_evaluation as policy
  where case policy.cmd
    when 'SELECT' then not policy.owner_using
    when 'INSERT' then not policy.owner_check
    when 'UPDATE' then not (policy.owner_using and policy.owner_check)
    when 'DELETE' then not policy.owner_using
    when 'ALL' then not (policy.owner_using and policy.owner_check)
    else false
  end
), prerequisite_policies(table_name, policy_name, command_name) as (
  values
    ('tool_link_billing_components', 'tool_link_billing_components_owner_select', 'SELECT'),
    ('tool_link_billing_components', 'tool_link_billing_components_owner_insert', 'INSERT'),
    ('tool_link_billing_components', 'tool_link_billing_components_owner_update', 'UPDATE'),
    ('tool_link_billing_components', 'tool_link_billing_components_owner_delete', 'DELETE'),
    ('billing_renewal_periods', 'billing_renewal_periods_owner_select', 'SELECT'),
    ('billing_renewal_activity', 'Users can view own billing renewal activity', 'SELECT'),
    ('subscription_lifecycle_events', 'subscription_lifecycle_events_owner_select', 'SELECT')
), missing_policies as (
  select required.*
  from prerequisite_policies as required
  where not exists (
    select 1
    from pg_policies as installed
    where installed.schemaname = 'public'
      and installed.tablename = required.table_name
      and installed.policyname = required.policy_name
      and installed.cmd = required.command_name
  )
  union all
  select
    'tool_email_links'::text,
    coverage.policy_name,
    coverage.command_name
  from tool_email_link_policy_contract as contract
  cross join lateral (
    values
      ('owner_select_coverage', 'SELECT', contract.select_covered),
      ('owner_insert_coverage', 'INSERT', contract.insert_covered),
      ('owner_update_coverage', 'UPDATE', contract.update_covered),
      ('owner_delete_coverage', 'DELETE', contract.delete_covered)
  ) as coverage(policy_name, command_name, covered)
  where not coverage.covered
), rls_contract as (
  select count(*) filter (where relation.relrowsecurity) = 5 as required_rls_enabled
  from pg_class as relation
  join pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname in (
      'tool_email_links',
      'tool_link_billing_components',
      'billing_renewal_periods',
      'billing_renewal_activity',
      'subscription_lifecycle_events'
    )
), direct_write_contract as (
  select
    has_table_privilege('authenticated', 'public.tool_email_links', 'SELECT')
      and has_table_privilege('authenticated', 'public.tool_email_links', 'UPDATE')
      and has_table_privilege('authenticated', 'public.tool_link_billing_components', 'SELECT')
      and has_table_privilege('authenticated', 'public.tool_link_billing_components', 'INSERT')
      and has_table_privilege('authenticated', 'public.tool_link_billing_components', 'UPDATE')
      and has_table_privilege('authenticated', 'public.tool_link_billing_components', 'DELETE')
      as authenticated_current_billing_direct_write_contract_present
), existing_0034_objects as (
  select object_name
  from (
    values
      ('table:subscription_billing_events', to_regclass('public.subscription_billing_events') is not null),
      ('column:excluded_by_billing_event_id', exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'billing_renewal_periods'
          and column_name = 'excluded_by_billing_event_id'
      )),
      ('index:billing_renewal_periods_one_reviewable_date_uidx', to_regclass('public.billing_renewal_periods_one_reviewable_date_uidx') is not null),
      ('function:current_billing_canonical_amount', to_regprocedure('public.current_billing_canonical_amount(text)') is not null),
      ('function:current_billing_normalize_snapshot', to_regprocedure('public.current_billing_normalize_snapshot(text,jsonb)') is not null),
      ('function:current_billing_revision', to_regprocedure('public.current_billing_revision(uuid)') is not null),
      ('function:current_billing_diff', to_regprocedure('public.current_billing_diff(jsonb,jsonb,text)') is not null),
      ('rpc:update_current_billing', to_regprocedure('public.update_current_billing(uuid,uuid,date,text,jsonb,text,jsonb,text,date)') is not null)
  ) as object_state(object_name, exists_now)
  where exists_now
), existing_0034_function_names as (
  select procedure.oid
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname in (
      'current_billing_canonical_amount',
      'current_billing_normalize_snapshot',
      'current_billing_revision',
      'current_billing_diff',
      'update_current_billing'
    )
), unsupported_relationships as (
  select link.id
  from public.tool_email_links as link
  where link.status not in ('Active', 'Paused', 'Goodbye')
), multiple_current_primary as (
  select component.tool_email_link_id
  from public.tool_link_billing_components as component
  where component.retired_at is null and component.billing_type <> 'Top-up'
  group by component.tool_email_link_id
  having count(*) > 1
), multiple_current_top_up as (
  select component.tool_email_link_id
  from public.tool_link_billing_components as component
  where component.retired_at is null and component.billing_type = 'Top-up'
  group by component.tool_email_link_id
  having count(*) > 1
), invalid_current_components as (
  select component.id
  from public.tool_link_billing_components as component
  where component.retired_at is null
    and (
      component.billing_type not in ('Monthly', 'Yearly', 'Lifetime', 'One-time', 'Top-up')
      or (nullif(btrim(component.currency), '') is not null
        and upper(btrim(component.currency)) !~ '^[A-Z]{3}$')
      or (nullif(btrim(component.amount), '') is not null
        and public.billing_renewal_snapshot_amount(component.amount) is null)
    )
), current_recurring_consistency as (
  select
    component.id,
    component.tool_email_link_id,
    component.next_renewal_date is not null
      and component.recurrence_anchor_date is null as next_renewal_missing_anchor,
    component.next_renewal_date is not null
      and component.recurrence_anchor_date is not null
      and public.billing_renewal_sequence_index(
        component.recurrence_anchor_date,
        component.billing_type,
        component.next_renewal_date
      ) is null as next_renewal_off_cadence,
    link.status = 'Active'
      and link.unlinked_at is null
      and link.next_charge_date is distinct from component.next_renewal_date
      as active_relationship_next_mismatch,
    component.next_renewal_date is null
      and component.recurrence_anchor_date is not null as anchor_without_next_renewal
  from public.tool_link_billing_components as component
  join public.tool_email_links as link on link.id = component.tool_email_link_id
  where component.retired_at is null
    and component.billing_type in ('Monthly', 'Yearly')
), duplicate_reviewable_dates as (
  select period.tool_email_link_id, period.scheduled_renewal_date
  from public.billing_renewal_periods as period
  where period.resolution is null and period.excluded_at is null
  group by period.tool_email_link_id, period.scheduled_renewal_date
  having count(*) > 1
), invalid_existing_exclusions as (
  select period.id
  from public.billing_renewal_periods as period
  where (period.excluded_at is null) <> (period.excluded_by_lifecycle_event_id is null)
    or (period.resolution is not null and period.excluded_at is not null)
), baseline as (
  select jsonb_build_object(
    'relationship_count', (select count(*) from public.tool_email_links),
    'relationship_fingerprint', (select md5(coalesce(string_agg(to_jsonb(link)::text, '|' order by link.id), '')) from public.tool_email_links as link),
    'component_count', (select count(*) from public.tool_link_billing_components),
    'component_fingerprint', (select md5(coalesce(string_agg(to_jsonb(component)::text, '|' order by component.id), '')) from public.tool_link_billing_components as component),
    'payment_count', (select count(*) from public.billing_transactions),
    'payment_fingerprint', (select md5(coalesce(string_agg(to_jsonb(payment)::text, '|' order by payment.id), '')) from public.billing_transactions as payment),
    'period_count', (select count(*) from public.billing_renewal_periods),
    'period_fingerprint', (select md5(coalesce(string_agg((to_jsonb(period) - 'excluded_by_billing_event_id')::text, '|' order by period.id), '')) from public.billing_renewal_periods as period),
    'renewal_activity_count', (select count(*) from public.billing_renewal_activity),
    'renewal_activity_fingerprint', (select md5(coalesce(string_agg(to_jsonb(activity)::text, '|' order by activity.id), '')) from public.billing_renewal_activity as activity),
    'lifecycle_event_count', (select count(*) from public.subscription_lifecycle_events),
    'lifecycle_event_fingerprint', (select md5(coalesce(string_agg(to_jsonb(event)::text, '|' order by event.id), '')) from public.subscription_lifecycle_events as event)
  ) as value
)
select
  not exists (select 1 from missing_relations)
    and not exists (select 1 from missing_columns)
    and not exists (select 1 from missing_functions)
    and not exists (select 1 from missing_indexes)
    and not exists (select 1 from missing_policies)
    and not exists (select 1 from unsafe_tool_email_link_policies)
    and (select required_rls_enabled from rls_contract) as prerequisites_passed,
  (select count(*) from missing_relations) as missing_relation_count,
  (select count(*) from missing_columns) as missing_column_count,
  (select count(*) from missing_functions) as missing_function_count,
  (select count(*) from missing_indexes) as missing_index_count,
  (select count(*) from missing_policies) as missing_policy_count,
  (select count(*) from unsafe_tool_email_link_policies) as unsafe_tool_email_link_policy_count,
  (select required_rls_enabled from rls_contract) as required_rls_enabled,
  (select authenticated_current_billing_direct_write_contract_present
    from direct_write_contract) as authenticated_direct_write_contract_present,
  (select count(*) from existing_0034_objects) as existing_0034_object_count,
  (select count(*) from existing_0034_function_names) as existing_0034_function_name_count,
  (select count(*) from unsupported_relationships) as unsupported_relationship_status_count,
  (select count(*) from multiple_current_primary) as multiple_current_primary_count,
  (select count(*) from multiple_current_top_up) as multiple_current_top_up_count,
  (select count(*) from invalid_current_components) as invalid_current_component_count,
  (select count(*) from current_recurring_consistency
    where next_renewal_missing_anchor) as next_renewal_missing_anchor_count,
  (select count(*) from current_recurring_consistency
    where next_renewal_off_cadence) as next_renewal_off_cadence_count,
  (select count(*) from current_recurring_consistency
    where active_relationship_next_mismatch) as active_relationship_next_mismatch_count,
  (select count(*) from current_recurring_consistency
    where anchor_without_next_renewal) as anchor_without_next_renewal_count,
  (select count(*) from duplicate_reviewable_dates) as duplicate_reviewable_date_count,
  (select count(*) from invalid_existing_exclusions) as invalid_existing_exclusion_count,
  (select value from baseline) as preservation_baseline,
  not exists (select 1 from missing_relations)
    and not exists (select 1 from missing_columns)
    and not exists (select 1 from missing_functions)
    and not exists (select 1 from missing_indexes)
    and not exists (select 1 from missing_policies)
    and not exists (select 1 from unsafe_tool_email_link_policies)
    and (select required_rls_enabled from rls_contract)
    and (select authenticated_current_billing_direct_write_contract_present
      from direct_write_contract)
    and not exists (select 1 from existing_0034_objects)
    and not exists (select 1 from existing_0034_function_names)
    and not exists (select 1 from unsupported_relationships)
    and not exists (select 1 from multiple_current_primary)
    and not exists (select 1 from multiple_current_top_up)
    and not exists (select 1 from invalid_current_components)
    and not exists (
      select 1 from current_recurring_consistency
      where next_renewal_missing_anchor
        or next_renewal_off_cadence
        or active_relationship_next_mismatch
    )
    and not exists (select 1 from duplicate_reviewable_dates)
    and not exists (select 1 from invalid_existing_exclusions)
    as migration_0034_preflight_passed;
