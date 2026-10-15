-- Phase 2B2-A5.2: standalone, strictly read-only non-fixture baseline capture.
-- Run before creating the a034 fixture and save the complete result row.

with fixture_relationships(id) as (
  values
    ('a0340000-0000-0000-0000-000000000301'::uuid),
    ('a0340000-0000-0000-0000-000000000302'::uuid)
),
non_fixture_state as (
  select
    (select count(*) from public.ai_tools as tool where tool.id <> 'a0340000-0000-0000-0000-000000000201') as tool_count,
    (select md5(coalesce(string_agg(to_jsonb(tool)::text, '|' order by tool.id::text), ''))
      from public.ai_tools as tool where tool.id <> 'a0340000-0000-0000-0000-000000000201') as tool_fingerprint,
    (select count(*) from public.logins as login where login.id not in ('a0340000-0000-0000-0000-000000000101', 'a0340000-0000-0000-0000-000000000102')) as login_count,
    (select md5(coalesce(string_agg(to_jsonb(login)::text, '|' order by login.id::text), ''))
      from public.logins as login where login.id not in ('a0340000-0000-0000-0000-000000000101', 'a0340000-0000-0000-0000-000000000102')) as login_fingerprint,
    (select count(*) from public.tool_email_links as link where link.id not in (select id from fixture_relationships)) as relationship_count,
    (select md5(coalesce(string_agg(to_jsonb(link)::text, '|' order by link.id::text), ''))
      from public.tool_email_links as link where link.id not in (select id from fixture_relationships)) as relationship_fingerprint,
    (select count(*) from public.tool_link_billing_components as component where component.tool_email_link_id not in (select id from fixture_relationships)) as component_count,
    (select md5(coalesce(string_agg(to_jsonb(component)::text, '|' order by component.id::text), ''))
      from public.tool_link_billing_components as component where component.tool_email_link_id not in (select id from fixture_relationships)) as component_fingerprint,
    (select count(*) from public.billing_transactions as payment where payment.tool_email_link_id is null or payment.tool_email_link_id not in (select id from fixture_relationships)) as payment_count,
    (select md5(coalesce(string_agg(to_jsonb(payment)::text, '|' order by payment.id::text), ''))
      from public.billing_transactions as payment where payment.tool_email_link_id is null or payment.tool_email_link_id not in (select id from fixture_relationships)) as payment_fingerprint,
    (select count(*) from public.billing_renewal_periods as period where period.tool_email_link_id not in (select id from fixture_relationships)) as period_count,
    (select md5(coalesce(string_agg(to_jsonb(period)::text, '|' order by period.id::text), ''))
      from public.billing_renewal_periods as period where period.tool_email_link_id not in (select id from fixture_relationships)) as period_fingerprint,
    (select count(*) from public.billing_renewal_activity as activity where activity.tool_email_link_id not in (select id from fixture_relationships)) as renewal_activity_count,
    (select md5(coalesce(string_agg(to_jsonb(activity)::text, '|' order by activity.id::text), ''))
      from public.billing_renewal_activity as activity where activity.tool_email_link_id not in (select id from fixture_relationships)) as renewal_activity_fingerprint,
    (select count(*) from public.subscription_lifecycle_events as event where event.tool_email_link_id not in (select id from fixture_relationships)) as lifecycle_event_count,
    (select md5(coalesce(string_agg(to_jsonb(event)::text, '|' order by event.id::text), ''))
      from public.subscription_lifecycle_events as event where event.tool_email_link_id not in (select id from fixture_relationships)) as lifecycle_event_fingerprint
)
select 'non_fixture'::text as scope,
  to_jsonb(non_fixture_state.*) as fingerprints
from non_fixture_state;
