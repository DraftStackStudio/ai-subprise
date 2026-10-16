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

-- Result 2: guarded detailed data report. query_to_xml delays parsing the
-- application query until all required tables and columns have been found.
with required_relations(name) as (select unnest(array[
  'auth.users','public.ai_tools','public.logins','public.tool_email_links',
  'public.tool_link_billing_components','public.billing_transactions',
  'public.billing_renewal_periods','public.billing_renewal_activity',
  'public.subscription_lifecycle_events'])),
required_columns(s,t,c) as (values
  ('auth','users','id'),('auth','users','email_confirmed_at'),
  ('public','ai_tools','id'),('public','ai_tools','user_id'),('public','logins','id'),('public','logins','user_id'),
  ('public','tool_email_links','id'),('public','tool_email_links','user_id'),('public','tool_email_links','plan'),('public','tool_email_links','plan_name'),('public','tool_email_links','status'),('public','tool_email_links','next_charge_date'),('public','tool_email_links','unlinked_at'),
  ('public','tool_link_billing_components','id'),('public','tool_link_billing_components','tool_email_link_id'),('public','tool_link_billing_components','billing_type'),('public','tool_link_billing_components','amount'),('public','tool_link_billing_components','currency'),('public','tool_link_billing_components','retired_at'),
  ('public','billing_transactions','id'),('public','billing_transactions','user_id'),('public','billing_transactions','tool_email_link_id'),('public','billing_transactions','payment_date'),('public','billing_transactions','amount'),('public','billing_transactions','currency'),('public','billing_transactions','source'),('public','billing_transactions','source_key'),
  ('public','billing_renewal_periods','id'),('public','billing_renewal_periods','user_id'),('public','billing_renewal_periods','tool_email_link_id'),('public','billing_renewal_periods','billing_component_id'),('public','billing_renewal_periods','scheduled_renewal_date'),('public','billing_renewal_periods','billing_date'),('public','billing_renewal_periods','plan_name_snapshot'),('public','billing_renewal_periods','billing_type_snapshot'),('public','billing_renewal_periods','currency_snapshot'),('public','billing_renewal_periods','amount_snapshot'),('public','billing_renewal_periods','resolution'),('public','billing_renewal_periods','excluded_at'),('public','billing_renewal_periods','excluded_by_lifecycle_event_id'),
  ('public','billing_renewal_activity','id'),('public','billing_renewal_activity','user_id'),('public','billing_renewal_activity','tool_email_link_id'),('public','billing_renewal_activity','billing_renewal_period_id'),('public','billing_renewal_activity','kind'),('public','billing_renewal_activity','activity_date'),('public','billing_renewal_activity','previous_billing_date'),('public','billing_renewal_activity','billing_date'),('public','billing_renewal_activity','plan_name_snapshot'),('public','billing_renewal_activity','billing_type_snapshot'),('public','billing_renewal_activity','currency_snapshot'),('public','billing_renewal_activity','amount_snapshot'),('public','billing_renewal_activity','note'),
  ('public','subscription_lifecycle_events','id'),('public','subscription_lifecycle_events','user_id'),('public','subscription_lifecycle_events','tool_email_link_id'),('public','subscription_lifecycle_events','event_kind'),('public','subscription_lifecycle_events','previous_lifecycle_state'),('public','subscription_lifecycle_events','next_lifecycle_state'),('public','subscription_lifecycle_events','effective_date'),('public','subscription_lifecycle_events','previous_billing_component_id'),('public','subscription_lifecycle_events','new_billing_component_id'),('public','subscription_lifecycle_events','plan_name_snapshot'),('public','subscription_lifecycle_events','created_at')),
guard as (select
  not exists(select 1 from required_relations where to_regclass(name) is null) relations_ok,
  not exists(select 1 from required_columns r left join information_schema.columns a
    on a.table_schema=r.s and a.table_name=r.t and a.column_name=r.c where a.column_name is null) columns_ok)
select '02_guarded_data_report' result_set,relations_ok and columns_ok data_report_executed,
  case when relations_ok and columns_ok then query_to_xml($data$
with fixture_relationships(id) as (values
 ('a0340000-0000-0000-0000-000000000301'::uuid),('a0340000-0000-0000-0000-000000000302'::uuid)),
paused as (select id,user_id,nullif(btrim(plan_name),'') plan_name from public.tool_email_links
  where unlinked_at is null and status='Paused' and plan in ('Active','Paid')),
latest as (select paused.id relationship_id,event.* from paused left join lateral
  (select * from public.subscription_lifecycle_events e where e.tool_email_link_id=paused.id
    and e.user_id=paused.user_id order by e.created_at desc,e.id desc limit 1) event on true),
classification as (select paused.id relationship_id,paused.user_id,latest.id event_id,latest.event_kind,
  latest.previous_billing_component_id,case
    when latest.id is null then 'missing_lifecycle_event'
    when latest.event_kind<>'paused' then 'latest_event_not_pause'
    when latest.previous_lifecycle_state<>'Active' or latest.next_lifecycle_state<>'Paused' then 'latest_event_not_active_to_paused'
    when latest.previous_billing_component_id is null then 'pause_has_no_recurring_component'
    when component.id is null then 'retired_component_missing_or_not_recurring'
    when paused.plan_name is distinct from latest.plan_name_snapshot then 'plan_changed_while_paused'
    when exists(select 1 from public.tool_link_billing_components c where c.tool_email_link_id=paused.id
      and c.billing_type in ('Monthly','Yearly') and c.retired_at is null) then 'unexpected_current_recurring_component'
    else 'resume_eligible' end resume_classification
  from paused join latest on latest.relationship_id=paused.id
  left join public.tool_link_billing_components component
    on component.id=latest.previous_billing_component_id and component.tool_email_link_id=paused.id
    and component.billing_type in ('Monthly','Yearly') and component.retired_at is not null),
unexpected as (
  select 'noncanonical_status' issue,id relationship_id,user_id,to_jsonb(link) details
    from public.tool_email_links link where unlinked_at is null and status not in ('Active','Paused','Goodbye')
  union all select 'paused_not_paid',id,user_id,to_jsonb(link) from public.tool_email_links link
    where unlinked_at is null and status='Paused' and plan not in ('Active','Paid')
  union all select 'paid_paused_not_eligible',relationship_id,user_id,to_jsonb(c) from classification c
    where resume_classification<>'resume_eligible'
  union all select 'lifecycle_owner_mismatch',e.tool_email_link_id,e.user_id,to_jsonb(e)
    from public.subscription_lifecycle_events e join public.tool_email_links l on l.id=e.tool_email_link_id
    where e.user_id is distinct from l.user_id),
fixture_owner as (select count(distinct user_id) owner_count,min(user_id::text)::uuid owner_id from (
  select user_id from public.ai_tools where id='a0340000-0000-0000-0000-000000000201'
  union all select user_id from public.logins where id in ('a0340000-0000-0000-0000-000000000101','a0340000-0000-0000-0000-000000000102')
  union all select user_id from public.tool_email_links where id in (select id from fixture_relationships)
  union all select user_id from public.billing_renewal_periods where tool_email_link_id in (select id from fixture_relationships)
  union all select user_id from public.billing_transactions where tool_email_link_id in (select id from fixture_relationships)
  union all select user_id from public.billing_renewal_activity where tool_email_link_id in (select id from fixture_relationships)
  union all select user_id from public.subscription_lifecycle_events where tool_email_link_id in (select id from fixture_relationships)) x),
pause_event as (select * from public.subscription_lifecycle_events
  where tool_email_link_id='a0340000-0000-0000-0000-000000000301' and event_kind='paused'),
a034 as (select fixture_owner.*,
  (select count(*)=1 from public.ai_tools where id::text like 'a034%')
  and (select count(*)=2 from public.logins where id::text like 'a034%')
  and (select count(*)=2 from public.tool_email_links where id::text like 'a034%')
  and (select count(*)=3 from public.tool_link_billing_components where id::text like 'a034%')
  and (select count(*)=5 from public.billing_renewal_periods where id::text like 'a034%')
  and (select count(*)=2 from public.billing_transactions where id::text like 'a034%')
  and (select count(*)=1 from public.billing_renewal_activity where id::text like 'a034%')
  and not exists(select 1 from public.subscription_lifecycle_events where id::text like 'a034%')
  and (select count(*)=2 from public.tool_email_links where id in (select id from fixture_relationships))
  and (select count(*)=3 from public.tool_link_billing_components where tool_email_link_id in (select id from fixture_relationships))
  and (select count(*)>=5 from public.billing_renewal_periods where tool_email_link_id in (select id from fixture_relationships))
  and (select count(*)=2 from public.billing_transactions where tool_email_link_id in (select id from fixture_relationships))
  and (select count(*)=1 from public.billing_renewal_activity where tool_email_link_id in (select id from fixture_relationships))
  and (select count(*)=1 from public.subscription_lifecycle_events where tool_email_link_id in (select id from fixture_relationships))
    manifest_exact,
  owner_count=1 and exists(select 1 from auth.users where id=owner_id and email_confirmed_at is not null) owner_valid,
  not exists(select 1 from public.ai_tools where user_id=owner_id and id<>'a0340000-0000-0000-0000-000000000201')
  and not exists(select 1 from public.logins where user_id=owner_id and id not in ('a0340000-0000-0000-0000-000000000101','a0340000-0000-0000-0000-000000000102'))
  and not exists(select 1 from public.tool_email_links where user_id=owner_id and id not in (select id from fixture_relationships))
  and not exists(select 1 from public.billing_renewal_periods where user_id=owner_id and tool_email_link_id not in (select id from fixture_relationships))
  and not exists(select 1 from public.billing_transactions where user_id=owner_id and id not in ('a0340000-0000-0000-0000-000000000601','a0340000-0000-0000-0000-000000000602'))
  and not exists(select 1 from public.billing_renewal_activity where user_id=owner_id and id<>'a0340000-0000-0000-0000-000000000701')
  and not exists(select 1 from public.subscription_lifecycle_events where user_id=owner_id and tool_email_link_id not in (select id from fixture_relationships))
    owner_scope_isolated,
  exists(select 1 from public.tool_email_links where id='a0340000-0000-0000-0000-000000000301'
    and user_id=owner_id and plan='Paid' and plan_name='TEST Monthly Primary' and status='Paused'
    and next_charge_date is null and unlinked_at is null) primary_paused,
  exists(select 1 from public.tool_email_links where id='a0340000-0000-0000-0000-000000000302'
    and user_id=owner_id and plan='Paid' and plan_name='TEST Monthly Control' and status='Active'
    and next_charge_date is not null and unlinked_at is null) control_active,
  (select count(*) from pause_event)=1 and exists(select 1 from pause_event where user_id=owner_id
    and previous_lifecycle_state='Active' and next_lifecycle_state='Paused'
    and previous_billing_component_id='a0340000-0000-0000-0000-000000000401'
    and new_billing_component_id is null) and not exists(select 1 from public.subscription_lifecycle_events later
      cross join pause_event p where later.tool_email_link_id=p.tool_email_link_id and later.user_id=p.user_id
      and (later.created_at,later.id)>(p.created_at,p.id)) pause_current,
  exists(select 1 from public.tool_link_billing_components c cross join pause_event p
    where c.id='a0340000-0000-0000-0000-000000000401' and c.tool_email_link_id='a0340000-0000-0000-0000-000000000301'
      and c.billing_type='Monthly' and c.amount='30.84' and c.currency='SGD' and c.retired_at=p.created_at)
  and exists(select 1 from public.tool_link_billing_components where id='a0340000-0000-0000-0000-000000000402'
    and tool_email_link_id='a0340000-0000-0000-0000-000000000301' and billing_type='Top-up'
    and amount='10.00' and currency='SGD' and retired_at is null)
  and exists(select 1 from public.tool_link_billing_components where id='a0340000-0000-0000-0000-000000000403'
    and tool_email_link_id='a0340000-0000-0000-0000-000000000302' and billing_type='Monthly'
    and amount='19.00' and currency='USD' and retired_at is null) components_preserved,
  exists(select 1 from public.billing_renewal_periods where id in ('a0340000-0000-0000-0000-000000000501','a0340000-0000-0000-0000-000000000502')
    and tool_email_link_id='a0340000-0000-0000-0000-000000000301' and billing_component_id='a0340000-0000-0000-0000-000000000401'
    and resolution is null and excluded_at is null group by tool_email_link_id having count(*)=2)
  and exists(select 1 from public.billing_renewal_periods r cross join pause_event p
    where r.id='a0340000-0000-0000-0000-000000000503' and r.resolution is null
      and r.excluded_at=p.created_at and r.excluded_by_lifecycle_event_id=p.id)
  and exists(select 1 from public.billing_renewal_periods where id='a0340000-0000-0000-0000-000000000504'
    and resolution='not_charged' and excluded_at is null and excluded_by_lifecycle_event_id is null)
  and exists(select 1 from public.billing_renewal_periods where id='a0340000-0000-0000-0000-000000000505'
    and tool_email_link_id='a0340000-0000-0000-0000-000000000302' and billing_component_id='a0340000-0000-0000-0000-000000000403'
    and resolution is null and excluded_at is null)
  and not exists(select 1 from public.billing_renewal_periods r cross join pause_event p
    where r.tool_email_link_id='a0340000-0000-0000-0000-000000000301' and r.billing_component_id='a0340000-0000-0000-0000-000000000401'
      and r.resolution is null and r.excluded_at is null and coalesce(r.billing_date,r.scheduled_renewal_date)>p.effective_date)
  and not exists(select 1 from public.billing_renewal_periods r
    where r.tool_email_link_id='a0340000-0000-0000-0000-000000000301' and r.billing_component_id='a0340000-0000-0000-0000-000000000401'
      and r.id not in ('a0340000-0000-0000-0000-000000000501','a0340000-0000-0000-0000-000000000502','a0340000-0000-0000-0000-000000000503','a0340000-0000-0000-0000-000000000504')
      and (r.scheduled_renewal_date is distinct from r.billing_date or r.resolution is not null or r.excluded_at is not null
        or r.plan_name_snapshot is distinct from 'TEST Monthly Primary' or r.billing_type_snapshot is distinct from 'Monthly'
        or r.currency_snapshot is distinct from 'SGD' or r.amount_snapshot is distinct from 30.84)) periods_preserved,
  exists(select 1 from public.billing_transactions where id='a0340000-0000-0000-0000-000000000601'
    and user_id=owner_id and tool_email_link_id='a0340000-0000-0000-0000-000000000301' and source='manual'
    and source_key='a034-primary-history' and amount=30.84 and currency='SGD')
  and exists(select 1 from public.billing_transactions where id='a0340000-0000-0000-0000-000000000602'
    and user_id=owner_id and tool_email_link_id='a0340000-0000-0000-0000-000000000302' and source='manual'
    and source_key='a034-control-history' and amount=19.00 and currency='USD') payments_preserved,
  exists(select 1 from public.billing_renewal_activity a join public.billing_renewal_periods r on r.id=a.billing_renewal_period_id
    where a.id='a0340000-0000-0000-0000-000000000701' and a.user_id=owner_id
      and a.tool_email_link_id='a0340000-0000-0000-0000-000000000301' and a.billing_renewal_period_id='a0340000-0000-0000-0000-000000000501'
      and a.kind='billing_period_corrected' and a.activity_date=r.billing_date and a.previous_billing_date=r.billing_date-1
      and a.billing_date=r.billing_date and a.plan_name_snapshot='TEST Monthly Primary' and a.billing_type_snapshot='Monthly'
      and a.currency_snapshot='SGD' and a.amount_snapshot=30.84 and a.note='Protected fixture renewal activity.') activity_preserved,
  exists(select 1 from classification where relationship_id='a0340000-0000-0000-0000-000000000301'
    and resume_classification='resume_eligible') resume_eligible,
  not exists(select 1 from public.subscription_lifecycle_events where tool_email_link_id='a0340000-0000-0000-0000-000000000302')
  and not exists(select 1 from public.tool_link_billing_components where tool_email_link_id='a0340000-0000-0000-0000-000000000302' and id<>'a0340000-0000-0000-0000-000000000403')
  and not exists(select 1 from public.billing_renewal_periods where tool_email_link_id='a0340000-0000-0000-0000-000000000302' and id<>'a0340000-0000-0000-0000-000000000505')
  and not exists(select 1 from public.billing_transactions where tool_email_link_id='a0340000-0000-0000-0000-000000000302' and id<>'a0340000-0000-0000-0000-000000000602')
  and not exists(select 1 from public.billing_renewal_activity where tool_email_link_id='a0340000-0000-0000-0000-000000000302') control_isolated
  from fixture_owner),
a034_final as (select a034.*,
  manifest_exact and owner_valid and owner_scope_isolated
  and primary_paused and control_active and pause_current and components_preserved
  and periods_preserved and payments_preserved and activity_preserved and resume_eligible
  and control_isolated a034_resume_preflight_passed from a034),
fixture_state as (select
  (select count(*) from public.ai_tools where id='a0340000-0000-0000-0000-000000000201') tool_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.ai_tools x where id='a0340000-0000-0000-0000-000000000201') tool_fp,
  (select count(*) from public.logins where id in ('a0340000-0000-0000-0000-000000000101','a0340000-0000-0000-0000-000000000102')) login_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.logins x where id in ('a0340000-0000-0000-0000-000000000101','a0340000-0000-0000-0000-000000000102')) login_fp,
  (select count(*) from public.tool_email_links where id in (select id from fixture_relationships)) relationship_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.tool_email_links x where id in (select id from fixture_relationships)) relationship_fp,
  (select count(*) from public.tool_link_billing_components where tool_email_link_id in (select id from fixture_relationships)) component_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.tool_link_billing_components x where tool_email_link_id in (select id from fixture_relationships)) component_fp,
  (select count(*) from public.billing_renewal_periods where tool_email_link_id in (select id from fixture_relationships)) period_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.billing_renewal_periods x where tool_email_link_id in (select id from fixture_relationships)) period_fp,
  (select count(*) from public.billing_transactions where tool_email_link_id in (select id from fixture_relationships)) payment_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.billing_transactions x where tool_email_link_id in (select id from fixture_relationships)) payment_fp,
  (select count(*) from public.billing_renewal_activity where tool_email_link_id in (select id from fixture_relationships)) activity_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.billing_renewal_activity x where tool_email_link_id in (select id from fixture_relationships)) activity_fp,
  (select count(*) from public.subscription_lifecycle_events where tool_email_link_id in (select id from fixture_relationships)) event_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.subscription_lifecycle_events x where tool_email_link_id in (select id from fixture_relationships)) event_fp,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.tool_email_links x where id='a0340000-0000-0000-0000-000000000302') control_relationship_fp,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.tool_link_billing_components x where tool_email_link_id='a0340000-0000-0000-0000-000000000302') control_component_fp,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.billing_renewal_periods x where tool_email_link_id='a0340000-0000-0000-0000-000000000302') control_period_fp,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.billing_transactions x where tool_email_link_id='a0340000-0000-0000-0000-000000000302') control_payment_fp),
non_fixture as (select
  (select count(*) from public.ai_tools x where id<>'a0340000-0000-0000-0000-000000000201') tool_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.ai_tools x where id<>'a0340000-0000-0000-0000-000000000201') tool_fp,
  (select count(*) from public.logins x where id not in ('a0340000-0000-0000-0000-000000000101','a0340000-0000-0000-0000-000000000102')) login_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.logins x where id not in ('a0340000-0000-0000-0000-000000000101','a0340000-0000-0000-0000-000000000102')) login_fp,
  (select count(*) from public.tool_email_links x where id not in (select id from fixture_relationships)) relationship_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.tool_email_links x where id not in (select id from fixture_relationships)) relationship_fp,
  (select count(*) from public.tool_link_billing_components x where tool_email_link_id not in (select id from fixture_relationships)) component_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.tool_link_billing_components x where tool_email_link_id not in (select id from fixture_relationships)) component_fp,
  (select count(*) from public.billing_transactions x where tool_email_link_id is null or tool_email_link_id not in (select id from fixture_relationships)) payment_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.billing_transactions x where tool_email_link_id is null or tool_email_link_id not in (select id from fixture_relationships)) payment_fp,
  (select count(*) from public.billing_renewal_periods x where tool_email_link_id not in (select id from fixture_relationships)) period_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.billing_renewal_periods x where tool_email_link_id not in (select id from fixture_relationships)) period_fp,
  (select count(*) from public.billing_renewal_activity x where tool_email_link_id not in (select id from fixture_relationships)) activity_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.billing_renewal_activity x where tool_email_link_id not in (select id from fixture_relationships)) activity_fp,
  (select count(*) from public.subscription_lifecycle_events x where tool_email_link_id not in (select id from fixture_relationships)) event_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.subscription_lifecycle_events x where tool_email_link_id not in (select id from fixture_relationships)) event_fp),
global_counts as (select
  (select count(*) from public.tool_email_links) relationships,
  (select count(*) from public.tool_link_billing_components) components,
  (select count(*) from public.billing_renewal_periods) periods,
  (select count(*) from public.billing_renewal_periods where excluded_at is not null) excluded_periods,
  (select count(*) from public.billing_transactions) payments,
  (select count(*) from public.billing_renewal_activity) activities,
  (select count(*) from public.subscription_lifecycle_events) events,
  (select count(*) from public.subscription_lifecycle_events where event_kind='resumed') resumed_events)
select current_date database_date,to_jsonb(global_counts.*) global_counts,
  (select coalesce(jsonb_object_agg(status_value,n),'{}') from
    (select coalesce(status,'<null>') status_value,count(*) n from public.tool_email_links
      where unlinked_at is null group by coalesce(status,'<null>'))x) linked_status_counts,
  (select coalesce(jsonb_object_agg(resume_classification,n),'{}') from
    (select resume_classification,count(*) n from classification group by resume_classification)x) classifications,
  (select coalesce(jsonb_agg(to_jsonb(x) order by relationship_id),'[]') from classification x) candidates,
  (select coalesce(jsonb_agg(to_jsonb(x) order by issue,relationship_id),'[]') from unexpected x) unexpected_states,
  to_jsonb(a034_final.*) a034_checks,to_jsonb(fixture_state.*) fixture_baseline,
  to_jsonb(non_fixture.*) non_fixture_baseline,
  (select jsonb_agg(to_jsonb(x) order by id) from public.tool_email_links x where id in (select id from fixture_relationships)) a034_relationships,
  (select jsonb_agg(to_jsonb(x) order by tool_email_link_id,id) from public.tool_link_billing_components x where tool_email_link_id in (select id from fixture_relationships)) a034_components,
  (select jsonb_agg(to_jsonb(x) order by tool_email_link_id,scheduled_renewal_date,id) from public.billing_renewal_periods x where tool_email_link_id in (select id from fixture_relationships)) a034_periods,
  (select jsonb_agg(to_jsonb(x) order by tool_email_link_id,payment_date,id) from public.billing_transactions x where tool_email_link_id in (select id from fixture_relationships)) a034_payments,
  (select jsonb_agg(to_jsonb(x) order by tool_email_link_id,created_at,id) from public.subscription_lifecycle_events x where tool_email_link_id in (select id from fixture_relationships)) a034_events,
  (select jsonb_agg(to_jsonb(x) order by tool_email_link_id,activity_date,id) from public.billing_renewal_activity x where tool_email_link_id in (select id from fixture_relationships)) a034_activity
from global_counts cross join a034_final cross join fixture_state cross join non_fixture
$data$,true,false,'') else null::xml end report,
  case when relations_ok and columns_ok then 'Executed guarded SELECT; save the complete XML.'
    else 'Skipped safely; review missing prerequisites in Result 1.' end status
from guard;
