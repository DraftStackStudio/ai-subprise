-- Read-only post-deployment verification for migration 0033. Compare the
-- returned counts with the reviewed preflight output before any Resume call.
with resume_function as (
  select procedure.oid, procedure.prosecdef,
    procedure.proconfig,
    coalesce(procedure.proacl::text, '') as acl
  from pg_proc as procedure
  where procedure.oid = to_regprocedure(
    'public.resume_subscription(uuid,uuid,uuid,text,text,text,date,boolean,date)'
  )
), contract as (
  select
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'subscription_lifecycle_events'
        and column_name = 'next_renewal_date_snapshot' and data_type = 'date'
    ) as snapshot_column_exists,
    exists (
      select 1 from pg_constraint
      where conrelid = 'public.subscription_lifecycle_events'::regclass
        and conname = 'subscription_lifecycle_events_next_renewal_event_check'
    ) as snapshot_constraint_exists
)
select
  contract.snapshot_column_exists
    and contract.snapshot_constraint_exists
    and resume_function.oid is not null
    and resume_function.prosecdef
    and resume_function.proconfig @> array['search_path=public']
    and has_function_privilege('authenticated', resume_function.oid, 'EXECUTE')
    and not has_function_privilege('anon', resume_function.oid, 'EXECUTE')
    as migration_0033_postcheck_passed,
  contract.*,
  resume_function.oid is not null as resume_rpc_exists,
  resume_function.prosecdef as resume_rpc_security_definer,
  resume_function.proconfig @> array['search_path=public'] as resume_rpc_fixed_search_path,
  has_function_privilege('authenticated', resume_function.oid, 'EXECUTE') as authenticated_can_execute,
  not has_function_privilege('anon', resume_function.oid, 'EXECUTE') as anon_cannot_execute,
  (select count(*) from public.subscription_lifecycle_events) as lifecycle_event_count,
  (select count(*) from public.subscription_lifecycle_events where event_kind = 'resumed') as resumed_event_count,
  (select count(*) from public.tool_link_billing_components) as billing_component_count,
  (select count(*) from public.billing_renewal_periods) as renewal_period_count,
  (select count(*) from public.billing_renewal_periods where excluded_at is not null) as excluded_period_count,
  (select count(*) from public.billing_transactions) as payment_count,
  (select count(*) from public.billing_renewal_activity) as renewal_activity_count
from contract left join resume_function on true;
