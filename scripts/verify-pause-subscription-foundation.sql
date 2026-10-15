-- Strictly read-only live post-migration verification for migration 0032.
-- Makes no RPC calls and performs no database writes.
with expected_baseline as (
  select
    51::bigint as relationship_count,
    7::bigint as component_count,
    15::bigint as payment_count,
    10::bigint as renewal_period_count,
    0::bigint as excluded_period_count,
    4::bigint as renewal_activity_count,
    0::bigint as lifecycle_event_count,
    '98b4b03d7c80bce84e59c22ded43b50a'::text as relationship_fingerprint,
    'cb4596e70a202d245296504a75813196'::text as component_fingerprint,
    'e588711bf345b2666ddb831ad4c41265'::text as renewal_period_fingerprint,
    '8b7fdae30260f2b277d26a1a7be667d8'::text as payment_fingerprint,
    '41ee3cb891a835b2b839793a43d82ca6'::text as renewal_activity_fingerprint,
    'd41d8cd98f00b204e9800998ecf8427e'::text as lifecycle_event_fingerprint
),
pause_contract as (
  select
    procedure.oid,
    procedure.proowner as owner_oid,
    procedure.proacl as raw_acl,
    procedure.prosecdef as is_security_definer,
    procedure.proconfig as configuration,
    pg_get_functiondef(procedure.oid) as definition
  from pg_proc as procedure
  where procedure.oid = to_regprocedure(
    'public.pause_subscription(uuid,uuid,date,text,text,date,text,date)'
  )
),
sync_contract as (
  select
    procedure.oid,
    procedure.proowner as owner_oid,
    procedure.proacl as raw_acl,
    procedure.prosecdef as is_security_definer,
    procedure.proconfig as configuration,
    pg_get_functiondef(procedure.oid) as definition
  from pg_proc as procedure
  where procedure.oid = to_regprocedure(
    'public.sync_due_billing_renewal_periods(uuid,uuid,date)'
  )
),
actual_baseline as (
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
data_integrity as (
  select
    not exists (
      select 1 from public.tool_email_links
      where status not in ('Active', 'Paused', 'Goodbye')
    ) as canonical_relationship_states,
    not exists (
      select 1 from public.tool_link_billing_components
      where retired_at is not null and billing_type not in ('Monthly', 'Yearly')
    ) as retirement_domain_valid,
    not exists (
      select 1 from public.billing_renewal_periods
      where (excluded_at is null) <> (excluded_by_lifecycle_event_id is null)
         or (resolution is not null and excluded_at is not null)
    ) as exclusion_contract_valid,
    not exists (
      select 1
      from public.subscription_lifecycle_events as event
      where event.event_kind = 'paused'
        and not (
          event.previous_lifecycle_state = 'Active'
          and event.next_lifecycle_state = 'Paused'
          and event.effective_date is not null
          and event.effective_date_precision in ('exact_date', 'month_only')
          and (event.planned_resume_date is null) = (event.planned_resume_precision is null)
        )
    ) as pause_ledger_rows_valid
),
preservation as (
  select
    actual.relationship_count = expected.relationship_count
      and actual.component_count = expected.component_count
      and actual.payment_count = expected.payment_count
      and actual.renewal_period_count = expected.renewal_period_count
      and actual.excluded_period_count = expected.excluded_period_count
      and actual.renewal_activity_count = expected.renewal_activity_count
      and actual.lifecycle_event_count = expected.lifecycle_event_count
      and actual.relationship_fingerprint = expected.relationship_fingerprint
      and actual.component_fingerprint = expected.component_fingerprint
      and actual.renewal_period_fingerprint = expected.renewal_period_fingerprint
      and actual.payment_fingerprint = expected.payment_fingerprint
      and actual.renewal_activity_fingerprint = expected.renewal_activity_fingerprint
      and actual.lifecycle_event_fingerprint = expected.lifecycle_event_fingerprint
      as baseline_preserved
  from actual_baseline as actual
  cross join expected_baseline as expected
),
checks as (
  select
    exists (select 1 from pause_contract) as pause_rpc_exists,
    coalesce((select is_security_definer from pause_contract), false)
      as pause_rpc_is_security_definer,
    coalesce((select 'search_path=public' = any(configuration) from pause_contract), false)
      as pause_rpc_has_fixed_search_path,
    coalesce((select has_function_privilege('authenticated', oid, 'EXECUTE')
      from pause_contract), false) as authenticated_can_execute_pause,
    coalesce((select not has_function_privilege('anon', oid, 'EXECUTE')
      from pause_contract), false) as anon_cannot_execute_pause,
    not exists (
      select 1
      from pause_contract as contract
      cross join lateral aclexplode(coalesce(
        contract.raw_acl,
        acldefault('f', contract.owner_oid)
      )) as privilege
      where privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
    ) as public_cannot_execute_pause,
    coalesce((select definition ilike '%event.id = p_request_id%'
      and definition ilike '%This Pause request ID is already in use.%'
      from pause_contract), false) as idempotency_contract_present,
    coalesce((select definition ilike '%link.id = p_relationship_id and link.user_id = v_user_id%'
      and definition ilike '%for update%'
      from pause_contract), false) as ownership_and_row_lock_contract_present,
    coalesce((select definition ilike '%pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0))%'
      from pause_contract), false)
      and coalesce((select definition ilike '%pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0))%'
      from sync_contract), false) as pause_sync_serialization_present,
    coalesce((select definition ilike '%period.resolution is null%'
      and definition ilike '%coalesce(period.billing_date, period.scheduled_renewal_date) > p_effective_date%'
      from pause_contract), false) as exclusion_contract_present,
    coalesce((select definition ilike '%set retired_at = v_changed_at%'
      and definition ilike '%set status = ''Paused'', next_charge_date = null%'
      from pause_contract), false) as pause_state_contract_present,
    coalesce((select definition not ilike '%billing_transactions%'
      and definition not ilike '%billing_renewal_activity%'
      from pause_contract), false) as no_payment_or_renewal_activity_writes,
    exists (select 1 from sync_contract) as sync_rpc_exists,
    coalesce((select is_security_definer from sync_contract), false)
      as sync_rpc_is_security_definer,
    coalesce((select 'search_path=public' = any(configuration) from sync_contract), false)
      as sync_rpc_has_fixed_search_path,
    coalesce((select has_function_privilege('authenticated', oid, 'EXECUTE')
      from sync_contract), false) as authenticated_can_execute_sync,
    coalesce((select not has_function_privilege('anon', oid, 'EXECUTE')
      from sync_contract), false) as anon_cannot_execute_sync,
    not exists (
      select 1
      from sync_contract as contract
      cross join lateral aclexplode(coalesce(
        contract.raw_acl,
        acldefault('f', contract.owner_oid)
      )) as privilege
      where privilege.grantee = 0 and privilege.privilege_type = 'EXECUTE'
    ) as public_cannot_execute_sync,
    coalesce((select definition ilike '%component.retired_at is null%'
      and definition ilike '%link.status, ''Active'') = ''Active''%'
      and definition ilike '%link.plan in (''Active'', ''Paid'')%'
      from sync_contract), false) as sync_current_active_contract_preserved,
    data_integrity.*,
    preservation.baseline_preserved
  from data_integrity
  cross join preservation
)
select
  actual_baseline.*,
  checks.*,
  checks.pause_rpc_exists
    and checks.pause_rpc_is_security_definer
    and checks.pause_rpc_has_fixed_search_path
    and checks.authenticated_can_execute_pause
    and checks.anon_cannot_execute_pause
    and checks.public_cannot_execute_pause
    and checks.idempotency_contract_present
    and checks.ownership_and_row_lock_contract_present
    and checks.pause_sync_serialization_present
    and checks.exclusion_contract_present
    and checks.pause_state_contract_present
    and checks.no_payment_or_renewal_activity_writes
    and checks.sync_rpc_exists
    and checks.sync_rpc_is_security_definer
    and checks.sync_rpc_has_fixed_search_path
    and checks.authenticated_can_execute_sync
    and checks.anon_cannot_execute_sync
    and checks.public_cannot_execute_sync
    and checks.sync_current_active_contract_preserved
    and checks.canonical_relationship_states
    and checks.retirement_domain_valid
    and checks.exclusion_contract_valid
    and checks.pause_ledger_rows_valid
    and checks.baseline_preserved
    as migration_0032_postcheck_passed
from actual_baseline
cross join checks;
