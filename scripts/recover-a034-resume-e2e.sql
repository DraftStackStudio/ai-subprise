-- Phase 5: exact-scope recovery for the disposable A034 Resume E2E fixture.
--
-- DANGER: privileged write script. Do not run before a separately approved
-- A034 Resume test or without replacing every placeholder from the reviewed
-- post-0033, pre-Resume Result 2 report.
--
-- The script restores only the A034 primary relationship after one exact
-- Resume request. It preserves the original Pause event, retired component,
-- historical periods, protected payments/activity, and control relationship.
-- Any failed assertion aborts the transaction. COMMIT is reached only after
-- the complete pre-Resume snapshot has been restored exactly.

begin;

create temporary table a034_resume_recovery_context (
  owner_id uuid not null,
  owner_email text not null,
  pause_event_id uuid not null,
  resume_event_id uuid not null,
  new_component_id uuid not null,
  resume_payment_id uuid,
  expected_fixture_baseline jsonb not null,
  expected_non_fixture_baseline jsonb not null,
  expected_global_counts jsonb not null,
  expected_relationships jsonb not null,
  expected_components jsonb not null,
  expected_periods jsonb not null,
  expected_payments jsonb not null,
  expected_events jsonb not null,
  expected_activity jsonb not null
) on commit drop;

-- Paste exact IDs and complete JSON values from the fresh pre-Resume report.
-- Leave resume_payment_id null when no Resume payment was committed.
insert into a034_resume_recovery_context values (
  '00000000-0000-0000-0000-000000000000'::uuid, -- owner_id
  'REPLACE_WITH_A034_OWNER_EMAIL'::text,
  '00000000-0000-0000-0000-000000000000'::uuid, -- Pause event ID
  '00000000-0000-0000-0000-000000000000'::uuid, -- Resume request/event ID
  '00000000-0000-0000-0000-000000000000'::uuid, -- generated component ID
  null::uuid, -- Resume payment ID, or null
  '{"replace_me":"fixture_baseline"}'::jsonb,
  '{"replace_me":"non_fixture_baseline"}'::jsonb,
  '{"replace_me":"global_counts"}'::jsonb,
  '{"replace_me":"a034_relationships"}'::jsonb,
  '{"replace_me":"a034_components"}'::jsonb,
  '{"replace_me":"a034_periods"}'::jsonb,
  '{"replace_me":"a034_payments"}'::jsonb,
  '{"replace_me":"a034_events"}'::jsonb,
  '{"replace_me":"a034_activity"}'::jsonb
);

create temporary view a034_resume_recovery_snapshot as
with fixture_relationships(id) as (values
  ('a0340000-0000-0000-0000-000000000301'::uuid),
  ('a0340000-0000-0000-0000-000000000302'::uuid)
),
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
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.billing_transactions x where tool_email_link_id='a0340000-0000-0000-0000-000000000302') control_payment_fp
),
non_fixture as (select
  (select count(*) from public.ai_tools x where id<>'a0340000-0000-0000-0000-000000000201') tool_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.ai_tools x where id<>'a0340000-0000-0000-0000-000000000201') tool_fp,
  (select count(*) from public.logins x where id not in ('a0340000-0000-0000-0000-000000000101','a0340000-0000-0000-0000-000000000102')) login_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.logins x where id not in ('a0340000-0000-0000-0000-000000000101','a0340000-0000-0000-0000-000000000102')) login_fp,
  (select count(*) from public.tool_email_links x where x.id not in (select id from fixture_relationships)) relationship_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.tool_email_links x where x.id not in (select id from fixture_relationships)) relationship_fp,
  (select count(*) from public.tool_link_billing_components x where x.tool_email_link_id not in (select id from fixture_relationships)) component_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.tool_link_billing_components x where x.tool_email_link_id not in (select id from fixture_relationships)) component_fp,
  (select count(*) from public.billing_transactions x where x.tool_email_link_id is null or x.tool_email_link_id not in (select id from fixture_relationships)) payment_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.billing_transactions x where x.tool_email_link_id is null or x.tool_email_link_id not in (select id from fixture_relationships)) payment_fp,
  (select count(*) from public.billing_renewal_periods x where x.tool_email_link_id not in (select id from fixture_relationships)) period_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.billing_renewal_periods x where x.tool_email_link_id not in (select id from fixture_relationships)) period_fp,
  (select count(*) from public.billing_renewal_activity x where x.tool_email_link_id not in (select id from fixture_relationships)) activity_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.billing_renewal_activity x where x.tool_email_link_id not in (select id from fixture_relationships)) activity_fp,
  (select count(*) from public.subscription_lifecycle_events x where x.tool_email_link_id not in (select id from fixture_relationships)) event_count,
  (select md5(coalesce(string_agg(to_jsonb(x)::text,'|' order by x.id::text),'')) from public.subscription_lifecycle_events x where x.tool_email_link_id not in (select id from fixture_relationships)) event_fp
),
global_counts as (select
  (select count(*) from public.tool_email_links) relationships,
  (select count(*) from public.tool_link_billing_components) components,
  (select count(*) from public.billing_renewal_periods) periods,
  (select count(*) from public.billing_renewal_periods where excluded_at is not null) excluded_periods,
  (select count(*) from public.billing_transactions) payments,
  (select count(*) from public.billing_renewal_activity) activities,
  (select count(*) from public.subscription_lifecycle_events) events,
  (select count(*) from public.subscription_lifecycle_events where event_kind='resumed') resumed_events
)
select
  to_jsonb(fixture_state.*) fixture_baseline,
  to_jsonb(non_fixture.*) non_fixture_baseline,
  to_jsonb(global_counts.*) global_counts,
  (select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]'::jsonb) from public.tool_email_links x where id in (select id from fixture_relationships)) relationships,
  (select coalesce(jsonb_agg(to_jsonb(x) order by tool_email_link_id,id),'[]'::jsonb) from public.tool_link_billing_components x where tool_email_link_id in (select id from fixture_relationships)) components,
  (select coalesce(jsonb_agg(to_jsonb(x) order by tool_email_link_id,scheduled_renewal_date,id),'[]'::jsonb) from public.billing_renewal_periods x where tool_email_link_id in (select id from fixture_relationships)) periods,
  (select coalesce(jsonb_agg(to_jsonb(x) order by tool_email_link_id,payment_date,id),'[]'::jsonb) from public.billing_transactions x where tool_email_link_id in (select id from fixture_relationships)) payments,
  (select coalesce(jsonb_agg(to_jsonb(x) order by tool_email_link_id,created_at,id),'[]'::jsonb) from public.subscription_lifecycle_events x where tool_email_link_id in (select id from fixture_relationships)) events,
  (select coalesce(jsonb_agg(to_jsonb(x) order by tool_email_link_id,activity_date,id),'[]'::jsonb) from public.billing_renewal_activity x where tool_email_link_id in (select id from fixture_relationships)) activity
from fixture_state cross join non_fixture cross join global_counts;

do $pre_recovery_guard$
declare
  c a034_resume_recovery_context%rowtype;
  s record;
  expected_primary jsonb;
  current_primary jsonb;
  protected_components jsonb;
  protected_payments jsonb;
  protected_events jsonb;
  payment_delta integer;
  deterministic_source_key text;
begin
  select * into strict c from a034_resume_recovery_context;
  select * into strict s from a034_resume_recovery_snapshot;
  deterministic_source_key := 'resume-payment:' || c.resume_event_id::text;
  payment_delta := case when c.resume_payment_id is null then 0 else 1 end;

  if c.owner_id='00000000-0000-0000-0000-000000000000'::uuid
    or c.pause_event_id='00000000-0000-0000-0000-000000000000'::uuid
    or c.resume_event_id='00000000-0000-0000-0000-000000000000'::uuid
    or c.new_component_id='00000000-0000-0000-0000-000000000000'::uuid
    or c.owner_email='REPLACE_WITH_A034_OWNER_EMAIL'
    or c.expected_fixture_baseline ? 'replace_me'
    or c.expected_non_fixture_baseline ? 'replace_me'
    or c.expected_global_counts ? 'replace_me'
    or c.expected_relationships ? 'replace_me'
    or c.expected_components ? 'replace_me'
    or c.expected_periods ? 'replace_me'
    or c.expected_payments ? 'replace_me'
    or c.expected_events ? 'replace_me'
    or c.expected_activity ? 'replace_me' then
    raise exception 'Safety stop: replace every recovery placeholder from the reviewed pre-Resume report.';
  end if;
  if c.resume_event_id=c.pause_event_id or c.new_component_id='a0340000-0000-0000-0000-000000000401'::uuid then
    raise exception 'Safety stop: Resume identities conflict with protected Pause identities.';
  end if;
  if jsonb_typeof(c.expected_relationships)<>'array'
    or jsonb_typeof(c.expected_components)<>'array'
    or jsonb_typeof(c.expected_periods)<>'array'
    or jsonb_typeof(c.expected_payments)<>'array'
    or jsonb_typeof(c.expected_events)<>'array'
    or jsonb_typeof(c.expected_activity)<>'array' then
    raise exception 'Safety stop: detailed baseline values must be complete JSON arrays.';
  end if;
  if c.expected_fixture_baseline->>'event_fp'<>'48709263e5a8ae50d4785a3f21bef72c'
    or (c.expected_fixture_baseline->>'tool_count')::bigint<>1
    or (c.expected_fixture_baseline->>'login_count')::bigint<>2
    or (c.expected_fixture_baseline->>'relationship_count')::bigint<>2
    or (c.expected_fixture_baseline->>'component_count')::bigint<>3
    or (c.expected_fixture_baseline->>'period_count')::bigint<>8
    or (c.expected_fixture_baseline->>'payment_count')::bigint<>2
    or (c.expected_fixture_baseline->>'activity_count')::bigint<>1
    or (c.expected_fixture_baseline->>'event_count')::bigint<>1
    or c.expected_global_counts<>jsonb_build_object(
      'relationships',53,'components',10,'periods',19,'excluded_periods',1,
      'payments',17,'activities',5,'events',1,'resumed_events',0) then
    raise exception 'Safety stop: supplied counts or lifecycle fingerprint are not the approved 2026-10-16 baseline.';
  end if;

  select value into strict expected_primary from jsonb_array_elements(c.expected_relationships)
  where value->>'id'='a0340000-0000-0000-0000-000000000301';
  select to_jsonb(link) into strict current_primary from public.tool_email_links link
  where id='a0340000-0000-0000-0000-000000000301';
  if expected_primary->>'user_id'<>c.owner_id::text
    or expected_primary->>'status'<>'Paused'
    or expected_primary->>'plan'<>'Paid'
    or expected_primary->>'plan_name'<>'TEST Monthly Primary'
    or expected_primary->>'next_charge_date' is not null
    or expected_primary->>'unlinked_at' is not null then
    raise exception 'Safety stop: supplied primary baseline is not the approved Paused relationship.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(c.resume_event_id::text,1));
  perform pg_advisory_xact_lock(hashtextextended('a0340000-0000-0000-0000-000000000301',0));
  perform 1 from public.tool_email_links where id='a0340000-0000-0000-0000-000000000301' for update;
  perform 1 from public.subscription_lifecycle_events where id in (c.pause_event_id,c.resume_event_id) order by id for update;
  perform 1 from public.tool_link_billing_components where id in ('a0340000-0000-0000-0000-000000000401'::uuid,c.new_component_id) order by id for update;
  if c.resume_payment_id is not null then perform 1 from public.billing_transactions where id=c.resume_payment_id for update; end if;

  if not exists(select 1 from auth.users where id=c.owner_id and lower(email)=lower(c.owner_email) and email_confirmed_at is not null) then
    raise exception 'Safety stop: exact confirmed A034 Auth owner was not found.';
  end if;
  if exists(select 1 from public.ai_tools where user_id=c.owner_id and id<>'a0340000-0000-0000-0000-000000000201')
    or exists(select 1 from public.logins where user_id=c.owner_id and id not in ('a0340000-0000-0000-0000-000000000101','a0340000-0000-0000-0000-000000000102'))
    or exists(select 1 from public.tool_email_links where user_id=c.owner_id and id not in ('a0340000-0000-0000-0000-000000000301','a0340000-0000-0000-0000-000000000302'))
    or exists(select 1 from public.billing_renewal_periods where user_id=c.owner_id and tool_email_link_id not in ('a0340000-0000-0000-0000-000000000301','a0340000-0000-0000-0000-000000000302'))
    or exists(select 1 from public.billing_renewal_activity where user_id=c.owner_id and tool_email_link_id not in ('a0340000-0000-0000-0000-000000000301','a0340000-0000-0000-0000-000000000302'))
    or exists(select 1 from public.billing_transactions payment where payment.user_id=c.owner_id
      and not exists(select 1 from jsonb_array_elements(c.expected_payments) e where e->>'id'=payment.id::text)
      and (c.resume_payment_id is null or payment.id<>c.resume_payment_id))
    or exists(select 1 from public.subscription_lifecycle_events event where event.user_id=c.owner_id
      and not exists(select 1 from jsonb_array_elements(c.expected_events) e where e->>'id'=event.id::text)
      and event.id<>c.resume_event_id) then
    raise exception 'Safety stop: dedicated A034 owner has an unexpected record.';
  end if;

  if s.non_fixture_baseline<>c.expected_non_fixture_baseline then raise exception 'Safety stop: non-fixture baseline changed.'; end if;
  if (s.global_counts->>'relationships')::bigint<>(c.expected_global_counts->>'relationships')::bigint
    or (s.global_counts->>'components')::bigint<>(c.expected_global_counts->>'components')::bigint+1
    or (s.global_counts->>'periods')::bigint<>(c.expected_global_counts->>'periods')::bigint
    or (s.global_counts->>'excluded_periods')::bigint<>(c.expected_global_counts->>'excluded_periods')::bigint
    or (s.global_counts->>'payments')::bigint<>(c.expected_global_counts->>'payments')::bigint+payment_delta
    or (s.global_counts->>'activities')::bigint<>(c.expected_global_counts->>'activities')::bigint
    or (s.global_counts->>'events')::bigint<>(c.expected_global_counts->>'events')::bigint+1
    or (s.global_counts->>'resumed_events')::bigint<>(c.expected_global_counts->>'resumed_events')::bigint+1 then
    raise exception 'Safety stop: post-Resume global counts do not equal the exact expected delta.';
  end if;
  if s.fixture_baseline->>'tool_count'<>c.expected_fixture_baseline->>'tool_count'
    or s.fixture_baseline->>'tool_fp'<>c.expected_fixture_baseline->>'tool_fp'
    or s.fixture_baseline->>'login_count'<>c.expected_fixture_baseline->>'login_count'
    or s.fixture_baseline->>'login_fp'<>c.expected_fixture_baseline->>'login_fp'
    or s.fixture_baseline->>'relationship_count'<>c.expected_fixture_baseline->>'relationship_count'
    or (s.fixture_baseline->>'component_count')::bigint<>(c.expected_fixture_baseline->>'component_count')::bigint+1
    or s.fixture_baseline->>'period_count'<>c.expected_fixture_baseline->>'period_count'
    or s.fixture_baseline->>'period_fp'<>c.expected_fixture_baseline->>'period_fp'
    or (s.fixture_baseline->>'payment_count')::bigint<>(c.expected_fixture_baseline->>'payment_count')::bigint+payment_delta
    or s.fixture_baseline->>'activity_count'<>c.expected_fixture_baseline->>'activity_count'
    or s.fixture_baseline->>'activity_fp'<>c.expected_fixture_baseline->>'activity_fp'
    or (s.fixture_baseline->>'event_count')::bigint<>(c.expected_fixture_baseline->>'event_count')::bigint+1
    or s.fixture_baseline->>'control_relationship_fp'<>c.expected_fixture_baseline->>'control_relationship_fp'
    or s.fixture_baseline->>'control_component_fp'<>c.expected_fixture_baseline->>'control_component_fp'
    or s.fixture_baseline->>'control_period_fp'<>c.expected_fixture_baseline->>'control_period_fp'
    or s.fixture_baseline->>'control_payment_fp'<>c.expected_fixture_baseline->>'control_payment_fp' then
    raise exception 'Safety stop: protected A034 counts or fingerprints changed.';
  end if;
  if s.periods<>c.expected_periods or s.activity<>c.expected_activity then
    raise exception 'Safety stop: protected A034 periods or activity changed.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.tool_email_link_id,x.id),'[]'::jsonb)
    into protected_components from public.tool_link_billing_components x
    where x.tool_email_link_id in ('a0340000-0000-0000-0000-000000000301','a0340000-0000-0000-0000-000000000302') and x.id<>c.new_component_id;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.tool_email_link_id,x.payment_date,x.id),'[]'::jsonb)
    into protected_payments from public.billing_transactions x
    where x.tool_email_link_id in ('a0340000-0000-0000-0000-000000000301','a0340000-0000-0000-0000-000000000302') and (c.resume_payment_id is null or x.id<>c.resume_payment_id);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.tool_email_link_id,x.created_at,x.id),'[]'::jsonb)
    into protected_events from public.subscription_lifecycle_events x
    where x.tool_email_link_id in ('a0340000-0000-0000-0000-000000000301','a0340000-0000-0000-0000-000000000302') and x.id<>c.resume_event_id;
  if protected_components<>c.expected_components or protected_payments<>c.expected_payments or protected_events<>c.expected_events then
    raise exception 'Safety stop: protected component, payment, or Pause-event history changed.';
  end if;
  if (current_primary-array['status','billing_type','amount','currency','next_charge_date'])
      <>(expected_primary-array['status','billing_type','amount','currency','next_charge_date'])
    or current_primary->>'status'<>'Active' or current_primary->>'plan'<>'Paid'
    or current_primary->>'plan_name'<>'TEST Monthly Primary' or current_primary->>'unlinked_at' is not null then
    raise exception 'Safety stop: A034 primary differs outside exact Resume-owned fields.';
  end if;
  if not exists(select 1 from public.subscription_lifecycle_events e
    where e.id=c.pause_event_id and e.user_id=c.owner_id and e.tool_email_link_id='a0340000-0000-0000-0000-000000000301'
      and e.event_kind='paused' and e.previous_lifecycle_state='Active' and e.next_lifecycle_state='Paused'
      and e.previous_billing_component_id='a0340000-0000-0000-0000-000000000401')
    or not exists(select 1 from jsonb_array_elements(c.expected_events) e where e->>'id'=c.pause_event_id::text) then
    raise exception 'Safety stop: exact protected Pause event is missing or changed.';
  end if;
  if not exists(select 1 from public.subscription_lifecycle_events e
    where e.id=c.resume_event_id and e.user_id=c.owner_id and e.tool_email_link_id='a0340000-0000-0000-0000-000000000301'
      and e.event_kind='resumed' and e.previous_lifecycle_state='Paused' and e.next_lifecycle_state='Active'
      and e.previous_billing_component_id='a0340000-0000-0000-0000-000000000401' and e.new_billing_component_id=c.new_component_id
      and e.plan_name_snapshot='TEST Monthly Primary'
      and not exists(select 1 from public.subscription_lifecycle_events later where later.tool_email_link_id=e.tool_email_link_id
        and later.user_id=e.user_id and (later.created_at,later.id)>(e.created_at,e.id))) then
    raise exception 'Safety stop: exact current Resume event is missing or changed.';
  end if;
  if not exists(select 1 from public.tool_link_billing_components component
    join public.subscription_lifecycle_events event on event.id=c.resume_event_id
    join public.tool_email_links link on link.id=event.tool_email_link_id
    where component.id=c.new_component_id and component.tool_email_link_id='a0340000-0000-0000-0000-000000000301'
      and component.retired_at is null and component.billing_type=event.billing_type_snapshot and component.billing_type=link.billing_type
      and component.currency is not distinct from event.currency_snapshot and component.currency is not distinct from link.currency
      and public.billing_renewal_snapshot_amount(component.amount) is not distinct from event.amount_snapshot
      and component.amount is not distinct from link.amount
      and component.next_renewal_date is not distinct from event.next_renewal_date_snapshot
      and component.next_renewal_date is not distinct from link.next_charge_date
      and component.recurrence_anchor_date is not distinct from component.next_renewal_date)
    or exists(select 1 from public.billing_renewal_periods where billing_component_id=c.new_component_id) then
    raise exception 'Safety stop: generated Resume component is missing, changed, or has renewal periods.';
  end if;
  if c.resume_payment_id is null then
    if exists(select 1 from public.billing_transactions where source_key=deterministic_source_key) then
      raise exception 'Safety stop: Resume payment exists but its exact ID was not supplied.';
    end if;
  elsif not exists(select 1 from public.billing_transactions payment
    where payment.id=c.resume_payment_id and payment.user_id=c.owner_id
      and payment.tool_email_link_id='a0340000-0000-0000-0000-000000000301'
      and payment.source='manual' and payment.source_key=deterministic_source_key and payment.status='Paid')
    or (select count(*) from public.billing_transactions where source_key=deterministic_source_key)<>1 then
    raise exception 'Safety stop: optional Resume payment does not match its exact ID and deterministic source key.';
  end if;
end
$pre_recovery_guard$;

do $recover_exact_resume$
declare
  c a034_resume_recovery_context%rowtype;
  expected_primary jsonb;
  changed_rows integer;
begin
  select * into strict c from a034_resume_recovery_context;
  select value into strict expected_primary from jsonb_array_elements(c.expected_relationships)
  where value->>'id'='a0340000-0000-0000-0000-000000000301';

  if c.resume_payment_id is not null then
    delete from public.billing_transactions
    where id=c.resume_payment_id and user_id=c.owner_id
      and tool_email_link_id='a0340000-0000-0000-0000-000000000301'
      and source='manual' and source_key='resume-payment:'||c.resume_event_id::text;
    get diagnostics changed_rows=row_count;
    if changed_rows<>1 then raise exception 'Recovery stopped: exact Resume payment was not deleted.'; end if;
  end if;

  update public.tool_email_links
  set status=expected_primary->>'status', billing_type=expected_primary->>'billing_type',
      amount=expected_primary->>'amount', currency=expected_primary->>'currency',
      next_charge_date=(expected_primary->>'next_charge_date')::date
  where id='a0340000-0000-0000-0000-000000000301' and user_id=c.owner_id and status='Active' and unlinked_at is null;
  get diagnostics changed_rows=row_count;
  if changed_rows<>1 then raise exception 'Recovery stopped: exact A034 primary was not restored.'; end if;

  delete from public.subscription_lifecycle_events
  where id=c.resume_event_id and user_id=c.owner_id and tool_email_link_id='a0340000-0000-0000-0000-000000000301'
    and event_kind='resumed' and new_billing_component_id=c.new_component_id;
  get diagnostics changed_rows=row_count;
  if changed_rows<>1 then raise exception 'Recovery stopped: exact Resume event was not deleted.'; end if;

  delete from public.tool_link_billing_components
  where id=c.new_component_id and tool_email_link_id='a0340000-0000-0000-0000-000000000301' and retired_at is null;
  get diagnostics changed_rows=row_count;
  if changed_rows<>1 then raise exception 'Recovery stopped: exact generated component was not deleted.'; end if;
end
$recover_exact_resume$;

do $post_recovery_guard$
declare c a034_resume_recovery_context%rowtype; s record;
begin
  select * into strict c from a034_resume_recovery_context;
  select * into strict s from a034_resume_recovery_snapshot;
  if s.fixture_baseline<>c.expected_fixture_baseline or s.non_fixture_baseline<>c.expected_non_fixture_baseline
    or s.global_counts<>c.expected_global_counts or s.relationships<>c.expected_relationships
    or s.components<>c.expected_components or s.periods<>c.expected_periods
    or s.payments<>c.expected_payments or s.events<>c.expected_events or s.activity<>c.expected_activity then
    raise exception 'Recovery rolled back: complete pre-Resume baseline was not restored exactly.';
  end if;
  if exists(select 1 from public.subscription_lifecycle_events where id=c.resume_event_id)
    or exists(select 1 from public.tool_link_billing_components where id=c.new_component_id)
    or exists(select 1 from public.billing_transactions where source_key='resume-payment:'||c.resume_event_id::text) then
    raise exception 'Recovery rolled back: a Resume-owned row remains.';
  end if;
end
$post_recovery_guard$;

select 'PASS: exact A034 Resume recovery restored the complete reviewed pre-Resume baseline.' result,
  fixture_baseline,non_fixture_baseline,global_counts
from a034_resume_recovery_snapshot;

commit;
