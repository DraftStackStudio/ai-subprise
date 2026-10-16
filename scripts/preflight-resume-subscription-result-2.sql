-- Phase 6: strictly read-only A034 Resume pre-submission data report.
-- Extracted unchanged from scripts/preflight-resume-subscription.sql.
-- No application RPC is called; the executable statement is WITH/SELECT.

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
