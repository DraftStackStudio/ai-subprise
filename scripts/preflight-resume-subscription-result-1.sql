-- Phase 3: strictly read-only preflight for migration 0033 and the approved
-- a034 Resume fixture. Run the whole file and save both result sets.
-- No application RPC is called and every executable statement is WITH/SELECT.

-- Result 1: catalog-only prerequisites, security, locks, and 0033 state.
-- Catalog-only checks still return normally when application objects are absent.
with required_relations(name) as (select unnest(array[
  'auth.users','public.ai_tools','public.logins','public.tool_email_links',
  'public.tool_link_billing_components','public.billing_transactions',
  'public.billing_renewal_periods','public.billing_renewal_activity',
  'public.subscription_lifecycle_events'])),
relations as (select name,to_regclass(name) oid from required_relations),
required_columns(s,t,c) as (values
  ('auth','users','id'),('auth','users','email_confirmed_at'),
  ('public','ai_tools','id'),('public','ai_tools','user_id'),
  ('public','logins','id'),('public','logins','user_id'),
  ('public','tool_email_links','id'),('public','tool_email_links','user_id'),
  ('public','tool_email_links','plan'),('public','tool_email_links','plan_name'),
  ('public','tool_email_links','status'),('public','tool_email_links','next_charge_date'),
  ('public','tool_email_links','unlinked_at'),
  ('public','tool_link_billing_components','id'),
  ('public','tool_link_billing_components','tool_email_link_id'),
  ('public','tool_link_billing_components','billing_type'),
  ('public','tool_link_billing_components','amount'),
  ('public','tool_link_billing_components','currency'),
  ('public','tool_link_billing_components','retired_at'),
  ('public','billing_transactions','id'),('public','billing_transactions','user_id'),
  ('public','billing_transactions','tool_email_link_id'),
  ('public','billing_transactions','payment_date'),('public','billing_transactions','amount'),
  ('public','billing_transactions','currency'),('public','billing_transactions','source'),
  ('public','billing_transactions','source_key'),
  ('public','billing_renewal_periods','id'),('public','billing_renewal_periods','user_id'),
  ('public','billing_renewal_periods','tool_email_link_id'),
  ('public','billing_renewal_periods','billing_component_id'),
  ('public','billing_renewal_periods','scheduled_renewal_date'),
  ('public','billing_renewal_periods','billing_date'),
  ('public','billing_renewal_periods','plan_name_snapshot'),
  ('public','billing_renewal_periods','billing_type_snapshot'),
  ('public','billing_renewal_periods','currency_snapshot'),
  ('public','billing_renewal_periods','amount_snapshot'),
  ('public','billing_renewal_periods','resolution'),
  ('public','billing_renewal_periods','excluded_at'),
  ('public','billing_renewal_periods','excluded_by_lifecycle_event_id'),
  ('public','billing_renewal_activity','id'),('public','billing_renewal_activity','user_id'),
  ('public','billing_renewal_activity','tool_email_link_id'),
  ('public','billing_renewal_activity','billing_renewal_period_id'),
  ('public','billing_renewal_activity','kind'),
  ('public','billing_renewal_activity','activity_date'),
  ('public','billing_renewal_activity','previous_billing_date'),
  ('public','billing_renewal_activity','billing_date'),
  ('public','billing_renewal_activity','plan_name_snapshot'),
  ('public','billing_renewal_activity','billing_type_snapshot'),
  ('public','billing_renewal_activity','currency_snapshot'),
  ('public','billing_renewal_activity','amount_snapshot'),
  ('public','billing_renewal_activity','note'),
  ('public','subscription_lifecycle_events','id'),
  ('public','subscription_lifecycle_events','user_id'),
  ('public','subscription_lifecycle_events','tool_email_link_id'),
  ('public','subscription_lifecycle_events','event_kind'),
  ('public','subscription_lifecycle_events','previous_lifecycle_state'),
  ('public','subscription_lifecycle_events','next_lifecycle_state'),
  ('public','subscription_lifecycle_events','effective_date'),
  ('public','subscription_lifecycle_events','previous_billing_component_id'),
  ('public','subscription_lifecycle_events','new_billing_component_id'),
  ('public','subscription_lifecycle_events','plan_name_snapshot'),
  ('public','subscription_lifecycle_events','created_at')),
columns as (select required.*,actual.column_name is not null exists_flag,actual.data_type
  from required_columns required left join information_schema.columns actual
  on actual.table_schema=required.s and actual.table_name=required.t
  and actual.column_name=required.c),
required_constraints(t,c) as (values
  ('tool_email_links','tool_email_links_status_check'),
  ('tool_link_billing_components','tool_link_billing_components_retired_type_check'),
  ('billing_renewal_periods','billing_renewal_periods_exclusion_pair_check'),
  ('billing_renewal_periods','billing_renewal_periods_resolved_not_excluded_check'),
  ('billing_renewal_periods','billing_renewal_periods_excluded_event_fkey'),
  ('subscription_lifecycle_events','subscription_lifecycle_events_previous_state_check'),
  ('subscription_lifecycle_events','subscription_lifecycle_events_next_state_check'),
  ('subscription_lifecycle_events','subscription_lifecycle_events_kind_check'),
  ('subscription_lifecycle_events','subscription_lifecycle_events_transition_check'),
  ('subscription_lifecycle_events','subscription_lifecycle_events_effective_precision_check'),
  ('subscription_lifecycle_events','subscription_lifecycle_events_planned_precision_check'),
  ('subscription_lifecycle_events','subscription_lifecycle_events_planned_pair_check'),
  ('subscription_lifecycle_events','subscription_lifecycle_events_planned_pause_only_check'),
  ('subscription_lifecycle_events','subscription_lifecycle_events_billing_type_check'),
  ('subscription_lifecycle_events','subscription_lifecycle_events_currency_check'),
  ('subscription_lifecycle_events','subscription_lifecycle_events_amount_check')),
constraints as (select required.*,actual.oid is not null exists_flag,
  pg_get_constraintdef(actual.oid) definition from required_constraints required
  left join pg_constraint actual on actual.conrelid=to_regclass('public.'||required.t)
  and actual.conname=required.c),
required_indexes(name) as (select unnest(array[
  'tool_link_billing_components_current_recurring_uidx',
  'tool_link_billing_components_non_recurring_uidx','billing_transactions_source_key_uidx',
  'billing_renewal_periods_reviewable_idx','subscription_lifecycle_events_relationship_date_idx',
  'billing_renewal_activity_relationship_date_idx'])),
indexes as (select required.name,actual.indexname is not null exists_flag,actual.indexdef definition
  from required_indexes required left join pg_indexes actual
  on actual.schemaname='public' and actual.indexname=required.name),
protected(name,block_writes) as (values
  ('ai_tools',false),('logins',false),('tool_email_links',false),
  ('tool_link_billing_components',false),
  ('billing_transactions',false),('billing_renewal_periods',true),
  ('billing_renewal_activity',true),('subscription_lifecycle_events',true)),
security as (select protected.name,relation.oid is not null table_exists,
  coalesce(relation.relrowsecurity,false) rls_enabled,
  exists(select 1 from pg_policies p where p.schemaname='public'
    and p.tablename=protected.name and p.cmd in ('SELECT','ALL')
    and lower(coalesce(p.qual,'')) like '%auth.uid()%') owner_select_policy,
  coalesce(has_table_privilege('authenticated',relation.oid,'SELECT'),false) authenticated_select,
  case when block_writes then relation.oid is not null
    and not has_table_privilege('authenticated',relation.oid,'INS'||'ERT')
    and not has_table_privilege('authenticated',relation.oid,'UP'||'DATE')
    and not has_table_privilege('authenticated',relation.oid,'DEL'||'ETE') else true end writes_blocked
  from protected left join pg_class relation
  on relation.oid=to_regclass('public.'||protected.name)),
pause_fn as (select p.*,pg_get_functiondef(p.oid) definition from pg_proc p
  where p.oid=to_regprocedure('public.pause_subscription(uuid,uuid,date,text,text,date,text,date)')),
sync_fn as (select p.*,pg_get_functiondef(p.oid) definition from pg_proc p
  where p.oid=to_regprocedure('public.sync_due_billing_renewal_periods(uuid,uuid,date)')),
resume_fn as (select p.*,pg_get_functiondef(p.oid) definition from pg_proc p
  where p.oid=to_regprocedure('public.resume_subscription(uuid,uuid,uuid,text,text,text,date,boolean,date)')),
parts as (select
  exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='subscription_lifecycle_events' and column_name='next_renewal_date_snapshot'
    and data_type='date') snapshot_column,
  exists(select 1 from pg_constraint where conrelid=to_regclass('public.subscription_lifecycle_events')
    and conname='subscription_lifecycle_events_next_renewal_event_check'
    and pg_get_constraintdef(oid) ilike '%next_renewal_date_snapshot%'
    and pg_get_constraintdef(oid) ilike '%resumed%'
    and pg_get_constraintdef(oid) ilike '%restarted_plan_changed%') snapshot_constraint,
  exists(select 1 from resume_fn) resume_rpc),
checks as (select
  exists(select 1 from pause_fn) pause_rpc,
  coalesce((select prosecdef from pause_fn),false) pause_security_definer,
  coalesce((select 'search_path=public'=any(proconfig) from pause_fn),false) pause_search_path,
  coalesce((select has_function_privilege('authenticated',oid,'EXECUTE') from pause_fn),false) pause_authenticated_execute,
  coalesce((select not has_function_privilege('anon',oid,'EXECUTE') from pause_fn),false) pause_anon_blocked,
  not exists(select 1 from pause_fn f cross join lateral
    aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a
    where a.grantee=0 and a.privilege_type='EXECUTE') pause_public_blocked,
  exists(select 1 from sync_fn) sync_rpc,
  coalesce((select prosecdef from sync_fn),false) sync_security_definer,
  coalesce((select 'search_path=public'=any(proconfig) from sync_fn),false) sync_search_path,
  coalesce((select has_function_privilege('authenticated',oid,'EXECUTE') from sync_fn),false) sync_authenticated_execute,
  coalesce((select not has_function_privilege('anon',oid,'EXECUTE') from sync_fn),false) sync_anon_blocked,
  not exists(select 1 from sync_fn f cross join lateral
    aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a
    where a.grantee=0 and a.privilege_type='EXECUTE') sync_public_blocked,
  to_regprocedure('public.billing_renewal_snapshot_amount(text)') is not null amount_helper,
  coalesce((select definition ilike '%pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0))%' from pause_fn),false)
  and coalesce((select definition ilike '%pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0))%' from sync_fn),false) shared_lock),
resume_contract as (select case when not parts.resume_rpc then true else coalesce((select
  prosecdef and 'search_path=public'=any(proconfig)
  and has_function_privilege('authenticated',oid,'EXECUTE')
  and not has_function_privilege('anon',oid,'EXECUTE')
  and definition ilike '%pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0))%'
  and definition ilike '%link.id = p_relationship_id and link.user_id = v_user_id%'
  and definition not ilike '%billing_transactions%'
  and definition not ilike '%billing_renewal_periods%'
  and definition not ilike '%billing_renewal_activity%' from resume_fn),false)
  and not exists(select 1 from resume_fn f cross join lateral
    aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a
    where a.grantee=0 and a.privilege_type='EXECUTE') end valid
  from parts),
summary as (select
  not exists(select 1 from relations where oid is null) relations_ok,
  not exists(select 1 from columns where not exists_flag) columns_ok,
  not exists(select 1 from constraints where not exists_flag)
    and exists(select 1 from constraints where c='tool_email_links_status_check'
      and definition ilike '%Active%' and definition ilike '%Paused%' and definition ilike '%Goodbye%')
    and exists(select 1 from constraints where c='subscription_lifecycle_events_transition_check'
      and definition ilike '%paused%' and definition ilike '%resumed%'
      and definition ilike '%restarted_plan_changed%') constraints_ok,
  not exists(select 1 from indexes where not exists_flag)
    and exists(select 1 from indexes where name='tool_link_billing_components_current_recurring_uidx'
      and definition ilike '%unique%' and definition ilike '%Monthly%'
      and definition ilike '%Yearly%' and definition ilike '%retired_at is null%')
    and exists(select 1 from indexes where name='billing_transactions_source_key_uidx'
      and definition ilike '%unique%' and definition ilike '%source_key%')
    and exists(select 1 from indexes where name='billing_renewal_periods_reviewable_idx'
      and definition ilike '%resolution is null%' and definition ilike '%excluded_at is null%') indexes_ok,
  not exists(select 1 from security where not table_exists or not rls_enabled
    or not owner_select_policy or not authenticated_select or not writes_blocked) security_ok,
  case when not snapshot_column and not snapshot_constraint and not resume_rpc then 'not_applied'
    when snapshot_column and snapshot_constraint and resume_rpc and resume_contract.valid then 'fully_applied'
    else 'partial_or_inconsistent' end migration_0033_state,
  parts.*,checks.*,resume_contract.valid resume_contract_valid
  from parts cross join checks cross join resume_contract)
select '01_structure_and_migration_state' result_set,summary.*,
  relations_ok and columns_ok and constraints_ok and indexes_ok and security_ok
  and pause_rpc and pause_security_definer and pause_search_path
  and pause_authenticated_execute and pause_anon_blocked and pause_public_blocked
  and sync_rpc and sync_security_definer and sync_search_path
  and sync_authenticated_execute and sync_anon_blocked and sync_public_blocked
  and amount_helper and shared_lock
  and migration_0033_state='not_applied' migration_0033_preflight_passed,
  (select coalesce(jsonb_agg(name order by name),'[]') from relations where oid is null) missing_relations,
  (select coalesce(jsonb_agg(s||'.'||t||'.'||c order by s,t,c),'[]') from columns where not exists_flag) missing_columns,
  (select coalesce(jsonb_agg(t||'.'||c order by t,c),'[]') from constraints where not exists_flag) missing_constraints,
  (select coalesce(jsonb_agg(name order by name),'[]') from indexes where not exists_flag) missing_indexes,
  (select jsonb_agg(to_jsonb(security) order by name) from security) security_details,
  (select jsonb_agg(to_jsonb(constraints) order by t,c) from constraints) constraint_details,
  (select jsonb_agg(to_jsonb(indexes) order by name) from indexes) index_details
from summary;
