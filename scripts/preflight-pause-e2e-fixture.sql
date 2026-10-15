-- Phase 2B2-A5.1: strictly read-only preflight for the committed a034 browser fixture.
-- Replace both placeholders only after a dedicated, confirmed Auth user has been created.
-- This script creates no fixture and calls no RPC.

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as test_user_id,
    'REPLACE_WITH_DELIVERABLE_AUTH_EMAIL'::text as test_email
),
reserved_conflicts as (
  select 'ai_tools' as table_name, id from public.ai_tools where id::text like 'a034%'
  union all select 'logins', id from public.logins where id::text like 'a034%'
  union all select 'tool_email_links', id from public.tool_email_links where id::text like 'a034%'
  union all select 'tool_link_billing_components', id from public.tool_link_billing_components where id::text like 'a034%'
  union all select 'billing_renewal_periods', id from public.billing_renewal_periods where id::text like 'a034%'
  union all select 'billing_transactions', id from public.billing_transactions where id::text like 'a034%'
  union all select 'billing_renewal_activity', id from public.billing_renewal_activity where id::text like 'a034%'
  union all select 'subscription_lifecycle_events', id from public.subscription_lifecycle_events where id::text like 'a034%'
),
owned_rows as (
  select 'ai_tools' as table_name, count(*)::bigint as row_count from public.ai_tools, params where user_id = params.test_user_id
  union all select 'logins', count(*) from public.logins, params where user_id = params.test_user_id
  union all select 'tool_email_links', count(*) from public.tool_email_links, params where user_id = params.test_user_id
  union all select 'billing_renewal_periods', count(*) from public.billing_renewal_periods, params where user_id = params.test_user_id
  union all select 'billing_transactions', count(*) from public.billing_transactions, params where user_id = params.test_user_id
  union all select 'billing_renewal_activity', count(*) from public.billing_renewal_activity, params where user_id = params.test_user_id
  union all select 'subscription_lifecycle_events', count(*) from public.subscription_lifecycle_events, params where user_id = params.test_user_id
),
pause_contract as (
  select procedure.oid, procedure.proowner, procedure.proacl,
    procedure.prosecdef, procedure.proconfig, pg_get_functiondef(procedure.oid) as definition
  from pg_proc as procedure
  where procedure.oid = to_regprocedure(
    'public.pause_subscription(uuid,uuid,date,text,text,date,text,date)'
  )
),
sync_contract as (
  select pg_get_functiondef(procedure.oid) as definition
  from pg_proc as procedure
  where procedure.oid = to_regprocedure(
    'public.sync_due_billing_renewal_periods(uuid,uuid,date)'
  )
),
checks as (
  select
    (select test_user_id <> '00000000-0000-0000-0000-000000000000'::uuid from params)
      as test_user_id_replaced,
    (select test_email <> 'REPLACE_WITH_DELIVERABLE_AUTH_EMAIL' from params)
      as test_email_replaced,
    exists (
      select 1 from auth.users as user_record, params
      where user_record.id = params.test_user_id
        and lower(user_record.email) = lower(params.test_email)
        and user_record.email_confirmed_at is not null
    ) as dedicated_confirmed_auth_user_exists,
    not exists (select 1 from reserved_conflicts) as reserved_a034_ids_are_unused,
    not exists (select 1 from owned_rows where row_count <> 0) as test_user_has_no_public_data,
    exists (select 1 from pause_contract) as pause_rpc_exists,
    coalesce((select prosecdef from pause_contract), false) as pause_rpc_is_security_definer,
    coalesce((select 'search_path=public' = any(proconfig) from pause_contract), false)
      as pause_rpc_has_fixed_search_path,
    coalesce((select has_function_privilege('authenticated', oid, 'EXECUTE') from pause_contract), false)
      as authenticated_can_execute_pause,
    coalesce((select not has_function_privilege('anon', oid, 'EXECUTE') from pause_contract), false)
      as anon_cannot_execute_pause,
    not exists (
      select 1
      from pause_contract as contract
      cross join lateral aclexplode(coalesce(contract.proacl, acldefault('f', contract.proowner))) as privilege
      where privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
    ) as public_cannot_execute_pause,
    coalesce((select definition ilike '%link.id = p_relationship_id and link.user_id = v_user_id%'
      and definition ilike '%period.user_id = v_user_id%'
      and definition not ilike '%billing_transactions%'
      and definition not ilike '%billing_renewal_activity%'
      from pause_contract), false) as exact_owner_scope_and_no_money_activity_writes,
    coalesce((select definition ilike '%pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0))%'
      from pause_contract), false)
      and coalesce((select definition ilike '%pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0))%'
      from sync_contract), false) as pause_and_sync_share_relationship_lock,
    (
      select count(relation.oid) = 8
        and bool_and(coalesce(relation.relrowsecurity, false))
      from unnest(array[
        'public.ai_tools',
        'public.logins',
        'public.tool_email_links',
        'public.tool_link_billing_components',
        'public.billing_transactions',
        'public.billing_renewal_periods',
        'public.billing_renewal_activity',
        'public.subscription_lifecycle_events'
      ]) as expected(table_name)
      left join pg_class as relation on relation.oid = to_regclass(expected.table_name)
    ) as all_fixture_tables_have_rls_enabled,
    (
      select count(distinct policy.tablename) = 8
      from pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename in (
          'ai_tools', 'logins', 'tool_email_links',
          'tool_link_billing_components', 'billing_transactions',
          'billing_renewal_periods', 'billing_renewal_activity',
          'subscription_lifecycle_events'
        )
        and policy.cmd in ('SELECT', 'ALL')
        and lower(coalesce(policy.qual, '')) like '%auth.uid()%'
    ) as all_fixture_tables_have_owner_select_policies,
    has_table_privilege('authenticated', 'public.ai_tools', 'SELECT')
      and has_table_privilege('authenticated', 'public.logins', 'SELECT')
      and has_table_privilege('authenticated', 'public.tool_email_links', 'SELECT')
      and has_table_privilege('authenticated', 'public.tool_link_billing_components', 'SELECT')
      and has_table_privilege('authenticated', 'public.billing_transactions', 'SELECT')
      and has_table_privilege('authenticated', 'public.billing_renewal_periods', 'SELECT')
      and has_table_privilege('authenticated', 'public.billing_renewal_activity', 'SELECT')
      and has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'SELECT')
      as authenticated_can_read_all_fixture_tables,
    not has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'INSERT')
      and not has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'DELETE')
      as lifecycle_ledger_client_writes_blocked,
    not has_table_privilege('authenticated', 'public.billing_renewal_periods', 'INSERT')
      and not has_table_privilege('authenticated', 'public.billing_renewal_periods', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.billing_renewal_periods', 'DELETE')
      as renewal_period_client_writes_blocked,
    not has_table_privilege('authenticated', 'public.billing_renewal_activity', 'INSERT')
      and not has_table_privilege('authenticated', 'public.billing_renewal_activity', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.billing_renewal_activity', 'DELETE')
      as renewal_activity_client_writes_blocked
)
select *,
  test_user_id_replaced
  and test_email_replaced
  and dedicated_confirmed_auth_user_exists
  and reserved_a034_ids_are_unused
  and test_user_has_no_public_data
  and pause_rpc_exists
  and pause_rpc_is_security_definer
  and pause_rpc_has_fixed_search_path
  and authenticated_can_execute_pause
  and anon_cannot_execute_pause
  and public_cannot_execute_pause
  and exact_owner_scope_and_no_money_activity_writes
  and pause_and_sync_share_relationship_lock
  and all_fixture_tables_have_rls_enabled
  and all_fixture_tables_have_owner_select_policies
  and authenticated_can_read_all_fixture_tables
  and lifecycle_ledger_client_writes_blocked
  and renewal_period_client_writes_blocked
  and renewal_activity_client_writes_blocked
  as pause_e2e_fixture_preflight_passed
from checks;

select conrelid::regclass as child_table, conname,
  confrelid::regclass as parent_table, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f'
  and (
    conrelid in (
      'public.tool_email_links'::regclass,
      'public.tool_link_billing_components'::regclass,
      'public.billing_renewal_periods'::regclass,
      'public.billing_transactions'::regclass,
      'public.billing_renewal_activity'::regclass,
      'public.subscription_lifecycle_events'::regclass
    )
    or confrelid in (
      'public.tool_email_links'::regclass,
      'public.tool_link_billing_components'::regclass,
      'public.billing_renewal_periods'::regclass,
      'public.billing_transactions'::regclass,
      'public.subscription_lifecycle_events'::regclass
    )
  )
order by conrelid::regclass::text, conname;
