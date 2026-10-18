-- Strictly read-only, migration-only postcheck for migration 0034.
-- Before running, replace the empty object below with preservation_baseline
-- returned by scripts/preflight-current-billing-update.sql.
with expected_baseline(value) as (
  values ('{}'::jsonb)
), actual_baseline as (
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
), rpc as (
  select procedure.oid, procedure.proowner, procedure.prosecdef, procedure.proconfig,
    pg_get_functiondef(procedure.oid) as definition
  from pg_proc as procedure
  where procedure.oid = to_regprocedure(
    'public.update_current_billing(uuid,uuid,date,text,jsonb,text,jsonb,text,date)'
  )
), renewal_sync as (
  select procedure.oid, procedure.prosecdef, procedure.proconfig,
    pg_get_functiondef(procedure.oid) as definition
  from pg_proc as procedure
  where procedure.oid = to_regprocedure(
    'public.sync_due_billing_renewal_periods(uuid,uuid,date)'
  )
), expected_columns(column_name) as (
  values
    ('id'), ('user_id'), ('tool_email_link_id'), ('mode'),
    ('effective_date'), ('reason'), ('before_snapshot'), ('after_snapshot'),
    ('changed_fields'), ('classifications'),
    ('previous_recurring_component_id'), ('new_recurring_component_id'), ('created_at')
), missing_columns as (
  select expected.column_name
  from expected_columns as expected
  where not exists (
    select 1 from information_schema.columns as installed
    where installed.table_schema = 'public'
      and installed.table_name = 'subscription_billing_events'
      and installed.column_name = expected.column_name
  )
), structural_contract as (
  select
    to_regclass('public.subscription_billing_events') is not null as event_table_exists,
    to_regclass('public.subscription_billing_events_relationship_date_idx') is not null as event_index_exists,
    (select count(*) = 1 from pg_constraint
      where conrelid = 'public.subscription_billing_events'::regclass and contype = 'p') as event_primary_key_exists,
    (select count(*) = 4 from pg_constraint
      where conrelid = 'public.subscription_billing_events'::regclass and contype = 'f') as event_foreign_keys_exist,
    (select count(*) = 5 from pg_constraint
      where conrelid = 'public.subscription_billing_events'::regclass and contype = 'c'
        and conname in (
          'subscription_billing_events_mode_check',
          'subscription_billing_events_snapshot_check',
          'subscription_billing_events_changed_fields_check',
          'subscription_billing_events_classifications_check',
          'subscription_billing_events_correction_classification_check'
        )) as event_checks_exist,
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'billing_renewal_periods'
        and column_name = 'excluded_by_billing_event_id'
    ) as exclusion_provenance_column_exists,
    to_regclass('public.billing_renewal_periods_billing_event_idx') is not null as exclusion_index_exists,
    to_regclass('public.billing_renewal_periods_one_reviewable_date_uidx') is not null as reviewable_unique_index_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.billing_renewal_periods'::regclass
        and conname = 'billing_renewal_periods_excluded_billing_event_fkey'
        and condeferrable and condeferred
        and confdeltype = 'a'
    ) as exclusion_fk_is_deferred,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.billing_renewal_periods'::regclass
        and conname = 'billing_renewal_periods_exclusion_pair_check'
        and pg_get_constraintdef(oid) ilike '%num_nonnulls%'
        and pg_get_constraintdef(oid) ilike '%excluded_by_billing_event_id%'
    ) as exclusion_pair_constraint_exists
), permission_contract as (
  select
    (select relrowsecurity from pg_class where oid = 'public.subscription_billing_events'::regclass) as event_rls_enabled,
    exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'subscription_billing_events'
        and policyname = 'subscription_billing_events_owner_select'
        and cmd = 'SELECT' and qual ilike '%auth.uid()%user_id%'
    ) as owner_select_policy_exists,
    has_table_privilege('authenticated', 'public.subscription_billing_events', 'SELECT') as authenticated_can_read,
    not has_table_privilege('authenticated', 'public.subscription_billing_events', 'INSERT')
      and not has_table_privilege('authenticated', 'public.subscription_billing_events', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.subscription_billing_events', 'DELETE') as authenticated_cannot_write,
    not has_table_privilege('anon', 'public.subscription_billing_events', 'SELECT')
      and not has_table_privilege('anon', 'public.subscription_billing_events', 'INSERT')
      and not has_table_privilege('anon', 'public.subscription_billing_events', 'UPDATE')
      and not has_table_privilege('anon', 'public.subscription_billing_events', 'DELETE') as anon_has_no_access
), helper_permissions as (
  select count(*) = 4
      and bool_and(not has_function_privilege('authenticated', procedure.oid, 'EXECUTE'))
      and bool_and(not has_function_privilege('anon', procedure.oid, 'EXECUTE'))
      and bool_and(not exists (
        select 1
        from aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) as privilege
        where privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
      ))
    as private_helpers_not_client_executable
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname in (
      'current_billing_canonical_amount',
      'current_billing_normalize_snapshot',
      'current_billing_revision',
      'current_billing_diff'
    )
), rpc_contract as (
  select
    rpc.oid is not null as rpc_exists,
    coalesce(rpc.prosecdef, false) as rpc_security_definer,
    coalesce(rpc.proconfig @> array['search_path=public'], false) as rpc_fixed_search_path,
    coalesce(rpc.proowner = (select relowner from pg_class where oid = 'public.subscription_billing_events'::regclass), false) as rpc_owner_matches_event_table,
    coalesce(has_function_privilege('authenticated', rpc.oid, 'EXECUTE'), false) as authenticated_can_execute,
    coalesce(not has_function_privilege('anon', rpc.oid, 'EXECUTE'), false) as anon_cannot_execute,
    coalesce(rpc.definition ilike '%pg_advisory_xact_lock(hashtextextended(p_request_id::text, 1))%', false)
      and coalesce(rpc.definition ilike '%pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0))%', false) as lock_contract_present,
    coalesce(rpc.definition ilike '%period.resolution is not null%coalesce(period.billing_date, period.scheduled_renewal_date) >= p_effective_date%', false) as resolved_boundary_guard_present,
    coalesce(rpc.definition ilike '%period.resolution is null%period.excluded_at is null%coalesce(period.billing_date, period.scheduled_renewal_date) >= p_effective_date%', false) as exclusion_boundary_present,
    coalesce(rpc.definition ilike '%insert into public.subscription_billing_events%', false) as event_write_present,
    coalesce(rpc.definition not ilike '%insert into public.billing_transactions%'
      and rpc.definition not ilike '%update public.billing_transactions%'
      and rpc.definition not ilike '%delete from public.billing_transactions%', false) as payment_writes_absent
  from (values (1)) as seed(value)
  left join rpc on true
), renewal_sync_contract as (
  select
    sync.oid is not null as sync_exists,
    coalesce(sync.prosecdef, false) as sync_security_definer,
    coalesce(sync.proconfig @> array['search_path=public'], false) as sync_fixed_search_path,
    coalesce(has_function_privilege('authenticated', sync.oid, 'EXECUTE'), false) as authenticated_can_execute_sync,
    coalesce(not has_function_privilege('anon', sync.oid, 'EXECUTE'), false) as anon_cannot_execute_sync,
    coalesce(sync.definition ilike '%pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0))%', false) as sync_relationship_lock_present,
    coalesce(sync.definition ilike '%on conflict do nothing%', false) as sync_cross_version_conflict_safe
  from (values (1)) as seed(value)
  left join renewal_sync as sync on true
), data_integrity as (
  select
    not exists (
      select 1 from public.tool_link_billing_components as component
      where component.retired_at is null and component.billing_type <> 'Top-up'
      group by component.tool_email_link_id having count(*) > 1
    ) as current_primary_unique,
    not exists (
      select 1 from public.tool_link_billing_components as component
      where component.retired_at is null and component.billing_type = 'Top-up'
      group by component.tool_email_link_id having count(*) > 1
    ) as current_top_up_unique,
    not exists (
      select 1 from public.billing_renewal_periods as period
      where period.resolution is null and period.excluded_at is null
      group by period.tool_email_link_id, period.scheduled_renewal_date having count(*) > 1
    ) as reviewable_period_dates_unique,
    not exists (
      select 1 from public.billing_renewal_periods as period
      where (period.excluded_at is null) <> (
        num_nonnulls(period.excluded_by_lifecycle_event_id, period.excluded_by_billing_event_id) = 0
      )
        or (period.excluded_at is not null
          and num_nonnulls(period.excluded_by_lifecycle_event_id, period.excluded_by_billing_event_id) <> 1)
        or (period.resolution is not null and period.excluded_at is not null)
    ) as exclusion_integrity_valid
)
select
  expected.value = actual.value as baseline_preserved,
  expected.value as expected_baseline,
  actual.value as actual_baseline,
  structural.*,
  not exists (select 1 from missing_columns) as all_event_columns_exist,
  permission.*,
  helper_access.*,
  rpc_check.*,
  sync_check.*,
  integrity.*,
  (select count(*) from public.subscription_billing_events) as billing_event_count,
  (select count(*) from public.billing_renewal_periods where excluded_by_billing_event_id is not null) as billing_event_excluded_period_count,
  expected.value <> '{}'::jsonb
    and expected.value = actual.value
    and structural.event_table_exists
    and structural.event_index_exists
    and structural.event_primary_key_exists
    and structural.event_foreign_keys_exist
    and structural.event_checks_exist
    and structural.exclusion_provenance_column_exists
    and structural.exclusion_index_exists
    and structural.reviewable_unique_index_exists
    and structural.exclusion_fk_is_deferred
    and structural.exclusion_pair_constraint_exists
    and not exists (select 1 from missing_columns)
    and permission.event_rls_enabled
    and permission.owner_select_policy_exists
    and permission.authenticated_can_read
    and permission.authenticated_cannot_write
    and permission.anon_has_no_access
    and helper_access.private_helpers_not_client_executable
    and rpc_check.rpc_exists
    and rpc_check.rpc_security_definer
    and rpc_check.rpc_fixed_search_path
    and rpc_check.rpc_owner_matches_event_table
    and rpc_check.authenticated_can_execute
    and rpc_check.anon_cannot_execute
    and rpc_check.lock_contract_present
    and rpc_check.resolved_boundary_guard_present
    and rpc_check.exclusion_boundary_present
    and rpc_check.event_write_present
    and rpc_check.payment_writes_absent
    and sync_check.sync_exists
    and sync_check.sync_security_definer
    and sync_check.sync_fixed_search_path
    and sync_check.authenticated_can_execute_sync
    and sync_check.anon_cannot_execute_sync
    and sync_check.sync_relationship_lock_present
    and sync_check.sync_cross_version_conflict_safe
    and integrity.current_primary_unique
    and integrity.current_top_up_unique
    and integrity.reviewable_period_dates_unique
    and integrity.exclusion_integrity_valid
    and (select count(*) from public.subscription_billing_events) = 0
    and (select count(*) from public.billing_renewal_periods where excluded_by_billing_event_id is not null) = 0
    as migration_0034_postcheck_passed
from expected_baseline as expected
cross join actual_baseline as actual
cross join structural_contract as structural
cross join permission_contract as permission
cross join helper_permissions as helper_access
cross join rpc_contract as rpc_check
cross join renewal_sync_contract as sync_check
cross join data_integrity as integrity;
