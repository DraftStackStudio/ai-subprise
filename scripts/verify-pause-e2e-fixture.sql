-- Phase 2B2-A5.1: read-only fixture state and preservation report.
-- Run after fixture creation, immediately before Pause, immediately after Pause,
-- and after cleanup. Save every result for comparison.
-- Replace both placeholders with the same dedicated Auth UUID and deliverable
-- email used by the preflight, fixture-creation, and cleanup scripts.

with fixture_relationships(id) as (
  values
    ('a0340000-0000-0000-0000-000000000301'::uuid),
    ('a0340000-0000-0000-0000-000000000302'::uuid)
),
fixture_state as (
  select
    (select md5(coalesce(string_agg(to_jsonb(tool)::text, '|' order by tool.id::text), ''))
      from public.ai_tools as tool where tool.id = 'a0340000-0000-0000-0000-000000000201') as tool_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(login)::text, '|' order by login.id::text), ''))
      from public.logins as login where login.id in ('a0340000-0000-0000-0000-000000000101', 'a0340000-0000-0000-0000-000000000102')) as login_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(link)::text, '|' order by link.id::text), ''))
      from public.tool_email_links as link where link.id in (select id from fixture_relationships)) as relationship_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(component)::text, '|' order by component.id::text), ''))
      from public.tool_link_billing_components as component where component.tool_email_link_id in (select id from fixture_relationships)) as component_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(payment)::text, '|' order by payment.id::text), ''))
      from public.billing_transactions as payment where payment.tool_email_link_id in (select id from fixture_relationships)) as payment_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(activity)::text, '|' order by activity.id::text), ''))
      from public.billing_renewal_activity as activity where activity.tool_email_link_id in (select id from fixture_relationships)) as renewal_activity_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(link)::text, '|' order by link.id::text), ''))
      from public.tool_email_links as link where link.id = 'a0340000-0000-0000-0000-000000000302') as isolation_relationship_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(component)::text, '|' order by component.id::text), ''))
      from public.tool_link_billing_components as component where component.tool_email_link_id = 'a0340000-0000-0000-0000-000000000302') as isolation_component_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(payment)::text, '|' order by payment.id::text), ''))
      from public.billing_transactions as payment where payment.tool_email_link_id = 'a0340000-0000-0000-0000-000000000302') as isolation_payment_fingerprint,
    (select md5(coalesce(string_agg(to_jsonb(period)::text, '|' order by period.id::text), ''))
      from public.billing_renewal_periods as period where period.tool_email_link_id = 'a0340000-0000-0000-0000-000000000302') as isolation_period_fingerprint
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
select 'fixture' as scope, to_jsonb(fixture_state.*) as fingerprints from fixture_state
union all
select 'non_fixture', to_jsonb(non_fixture_state.*) from non_fixture_state;

select id, user_id, tool_id, email_account_id, plan, plan_name, status,
  next_charge_date, unlinked_at, created_at
from public.tool_email_links
where id in (
  'a0340000-0000-0000-0000-000000000301',
  'a0340000-0000-0000-0000-000000000302'
)
order by id;

select id, tool_email_link_id, billing_type, amount, currency,
  next_renewal_date, recurrence_anchor_date, last_top_up_date, retired_at
from public.tool_link_billing_components
where tool_email_link_id in (
  'a0340000-0000-0000-0000-000000000301',
  'a0340000-0000-0000-0000-000000000302'
)
order by tool_email_link_id, id;

select id, tool_email_link_id, billing_component_id, scheduled_renewal_date,
  billing_date, resolution, payment_transaction_id, resolved_at,
  not_charged_reason_code, excluded_at, excluded_by_lifecycle_event_id
from public.billing_renewal_periods
where tool_email_link_id in (
  'a0340000-0000-0000-0000-000000000301',
  'a0340000-0000-0000-0000-000000000302'
)
order by tool_email_link_id, scheduled_renewal_date, id;

select id, tool_email_link_id, payment_date, amount, currency, status,
  source, source_key, note, created_at, updated_at
from public.billing_transactions
where tool_email_link_id in (
  'a0340000-0000-0000-0000-000000000301',
  'a0340000-0000-0000-0000-000000000302'
)
order by tool_email_link_id, payment_date, id;

select id, tool_email_link_id, billing_renewal_period_id, kind,
  activity_date, previous_billing_date, billing_date, note, created_at
from public.billing_renewal_activity
where tool_email_link_id in (
  'a0340000-0000-0000-0000-000000000301',
  'a0340000-0000-0000-0000-000000000302'
)
order by tool_email_link_id, activity_date, id;

select id, user_id, tool_email_link_id, event_kind, effective_date,
  effective_date_precision, reason, planned_resume_date,
  planned_resume_precision, previous_lifecycle_state, next_lifecycle_state,
  previous_billing_component_id, new_billing_component_id,
  plan_name_snapshot, previous_plan_name, billing_type_snapshot,
  currency_snapshot, amount_snapshot, created_at
from public.subscription_lifecycle_events
where tool_email_link_id in (
  'a0340000-0000-0000-0000-000000000301',
  'a0340000-0000-0000-0000-000000000302'
)
order by effective_date, created_at, id;

-- Phase-aware fixture contract. This remains read-only and is valid before
-- setup, after setup, after Pause, and after cleanup.
with auth_params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as test_user_id,
    'REPLACE_WITH_DELIVERABLE_AUTH_EMAIL'::text as test_email
),
fixture_counts as (
  select
    (select count(*) from public.ai_tools where id = 'a0340000-0000-0000-0000-000000000201') as tool_count,
    (select count(*) from public.logins where id in ('a0340000-0000-0000-0000-000000000101', 'a0340000-0000-0000-0000-000000000102')) as login_count,
    (select count(*) from public.tool_email_links where id in ('a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000302')) as relationship_count,
    (select count(*) from public.tool_link_billing_components where tool_email_link_id in ('a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000302')) as component_count,
    (select count(*) from public.billing_renewal_periods where tool_email_link_id in ('a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000302')) as period_count,
    (select count(*) from public.billing_transactions where id in ('a0340000-0000-0000-0000-000000000601', 'a0340000-0000-0000-0000-000000000602') or tool_email_link_id in ('a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000302')) as payment_count,
    (select count(*) from public.billing_renewal_activity where id = 'a0340000-0000-0000-0000-000000000701' or tool_email_link_id in ('a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000302')) as renewal_activity_count,
    (select count(*) from public.subscription_lifecycle_events where tool_email_link_id in ('a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000302')) as lifecycle_event_count
),
ownership as (
  select count(distinct owned.user_id) as distinct_owner_count,
    min(owned.user_id::text)::uuid as owner_id
  from (
    select user_id from public.ai_tools where id = 'a0340000-0000-0000-0000-000000000201'
    union all select user_id from public.logins where id in ('a0340000-0000-0000-0000-000000000101', 'a0340000-0000-0000-0000-000000000102')
    union all select user_id from public.tool_email_links where id in ('a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000302')
    union all select user_id from public.billing_renewal_periods where tool_email_link_id in ('a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000302')
    union all select user_id from public.billing_transactions where id in ('a0340000-0000-0000-0000-000000000601', 'a0340000-0000-0000-0000-000000000602')
    union all select user_id from public.billing_renewal_activity where id = 'a0340000-0000-0000-0000-000000000701'
    union all select user_id from public.subscription_lifecycle_events where tool_email_link_id in ('a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000302')
  ) as owned
),
pause_event as (
  select event.*
  from public.subscription_lifecycle_events as event
  where event.tool_email_link_id = 'a0340000-0000-0000-0000-000000000301'
    and event.event_kind = 'paused'
),
checks as (
  select counts.*,
    ownership.distinct_owner_count,
    ownership.owner_id,
    auth_params.test_user_id <>
      ('00000000' || '-0000-0000-0000-' || '000000000000')::uuid
      as test_user_id_replaced,
    position('@' in auth_params.test_email) > 1
      and auth_params.test_email not like 'REPLACE_WITH_%'
      as test_email_replaced,
    exists (
      select 1 from auth.users as user_record
      where user_record.id = auth_params.test_user_id
        and lower(user_record.email) = lower(auth_params.test_email)
        and user_record.email_confirmed_at is not null
    ) as dedicated_confirmed_auth_user_exists,
    case
      when counts.tool_count = 0 and counts.login_count = 0
        and counts.relationship_count = 0 and counts.component_count = 0
        and counts.period_count = 0 and counts.payment_count = 0
        and counts.renewal_activity_count = 0 and counts.lifecycle_event_count = 0
        then 'absent'
      when counts.tool_count = 1 and counts.login_count = 2
        and counts.relationship_count = 2 and counts.component_count = 3
        and counts.period_count = 5 and counts.payment_count = 2
        and counts.renewal_activity_count = 1 and counts.lifecycle_event_count = 0
        then 'ready'
      when counts.tool_count = 1 and counts.login_count = 2
        and counts.relationship_count = 2 and counts.component_count = 3
        and counts.period_count >= 5 and counts.payment_count = 2
        and counts.renewal_activity_count = 1 and counts.lifecycle_event_count = 1
        then 'paused'
      else 'unexpected'
    end as fixture_stage,
    counts.tool_count = 0
      or (
        ownership.distinct_owner_count = 1
        and ownership.owner_id = auth_params.test_user_id
        and exists (
          select 1 from auth.users as user_record
          where user_record.id = ownership.owner_id
            and lower(user_record.email) = lower(auth_params.test_email)
        )
      ) as dedicated_owner_is_consistent,
    exists (
      select 1 from public.tool_email_links as primary_link
      where primary_link.id = 'a0340000-0000-0000-0000-000000000301'
        and primary_link.status = 'Active' and primary_link.plan = 'Paid'
        and primary_link.next_charge_date is not null and primary_link.unlinked_at is null
    )
    and exists (
      select 1 from public.tool_email_links as control_link
      where control_link.id = 'a0340000-0000-0000-0000-000000000302'
        and control_link.status = 'Active' and control_link.plan = 'Paid'
        and control_link.next_charge_date is not null and control_link.unlinked_at is null
    )
    and not exists (
      select 1 from public.tool_link_billing_components as component
      where component.id in ('a0340000-0000-0000-0000-000000000401', 'a0340000-0000-0000-0000-000000000402', 'a0340000-0000-0000-0000-000000000403')
        and component.retired_at is not null
    )
    and exists (
      select 1 from public.billing_renewal_periods as period
      where period.id = 'a0340000-0000-0000-0000-000000000501'
        and period.resolution is null and period.excluded_at is null
    )
    and exists (
      select 1 from public.billing_renewal_periods as period
      where period.id = 'a0340000-0000-0000-0000-000000000502'
        and period.resolution is null and period.excluded_at is null
    )
    and exists (
      select 1 from public.billing_renewal_periods as period
      where period.id = 'a0340000-0000-0000-0000-000000000503'
        and period.resolution is null and period.excluded_at is null
    )
    and exists (
      select 1 from public.billing_renewal_periods as period
      where period.id = 'a0340000-0000-0000-0000-000000000504'
        and period.resolution = 'not_charged' and period.excluded_at is null
    )
    and exists (
      select 1 from public.billing_renewal_periods as period
      where period.id = 'a0340000-0000-0000-0000-000000000505'
        and period.tool_email_link_id = 'a0340000-0000-0000-0000-000000000302'
        and period.resolution is null and period.excluded_at is null
    ) as ready_state_contract,
    exists (
      select 1
      from public.tool_email_links as primary_link
      cross join pause_event as event
      where primary_link.id = 'a0340000-0000-0000-0000-000000000301'
        and primary_link.status = 'Paused' and primary_link.next_charge_date is null
        and event.previous_lifecycle_state = 'Active'
        and event.next_lifecycle_state = 'Paused'
        and event.previous_billing_component_id = 'a0340000-0000-0000-0000-000000000401'
    )
    and exists (
      select 1 from public.tool_email_links as control_link
      where control_link.id = 'a0340000-0000-0000-0000-000000000302'
        and control_link.status = 'Active' and control_link.next_charge_date is not null
    )
    and exists (
      select 1
      from public.tool_link_billing_components as component
      cross join pause_event as event
      where component.id = 'a0340000-0000-0000-0000-000000000401'
        and component.retired_at = event.created_at
    )
    and not exists (
      select 1 from public.tool_link_billing_components as component
      where component.id in ('a0340000-0000-0000-0000-000000000402', 'a0340000-0000-0000-0000-000000000403')
        and component.retired_at is not null
    )
    and exists (
      select 1 from public.billing_renewal_periods as period
      where period.id in ('a0340000-0000-0000-0000-000000000501', 'a0340000-0000-0000-0000-000000000502')
        and period.resolution is null and period.excluded_at is null
      group by period.tool_email_link_id
      having count(*) = 2
    )
    and exists (
      select 1
      from public.billing_renewal_periods as period
      cross join pause_event as event
      where period.id = 'a0340000-0000-0000-0000-000000000503'
        and period.resolution is null
        and period.excluded_at = event.created_at
        and period.excluded_by_lifecycle_event_id = event.id
    )
    and exists (
      select 1 from public.billing_renewal_periods as period
      where period.id = 'a0340000-0000-0000-0000-000000000504'
        and period.resolution = 'not_charged'
        and period.excluded_at is null and period.excluded_by_lifecycle_event_id is null
    )
    and exists (
      select 1 from public.billing_renewal_periods as period
      where period.id = 'a0340000-0000-0000-0000-000000000505'
        and period.tool_email_link_id = 'a0340000-0000-0000-0000-000000000302'
        and period.resolution is null and period.excluded_at is null
    )
    and not exists (
      select 1
      from public.billing_renewal_periods as period
      cross join pause_event as event
      where period.tool_email_link_id = 'a0340000-0000-0000-0000-000000000301'
        and period.billing_component_id = 'a0340000-0000-0000-0000-000000000401'
        and period.resolution is null and period.excluded_at is null
        and coalesce(period.billing_date, period.scheduled_renewal_date) > event.effective_date
    )
    and not exists (
      select 1 from public.billing_renewal_periods as period
      where period.tool_email_link_id = 'a0340000-0000-0000-0000-000000000301'
        and period.billing_component_id = 'a0340000-0000-0000-0000-000000000401'
        and period.id not in (
          'a0340000-0000-0000-0000-000000000501',
          'a0340000-0000-0000-0000-000000000502',
          'a0340000-0000-0000-0000-000000000503',
          'a0340000-0000-0000-0000-000000000504'
        )
        and (
          period.scheduled_renewal_date is distinct from period.billing_date
          or period.resolution is not null
          or period.excluded_at is not null
          or period.plan_name_snapshot is distinct from 'TEST Monthly Primary'
          or period.billing_type_snapshot is distinct from 'Monthly'
          or period.currency_snapshot is distinct from 'SGD'
          or period.amount_snapshot is distinct from 30.84
        )
    ) as paused_state_contract,
    exists (
      select 1 from public.billing_transactions
      where id = 'a0340000-0000-0000-0000-000000000601'
        and tool_email_link_id = 'a0340000-0000-0000-0000-000000000301'
        and source = 'manual' and amount = 30.84 and currency = 'SGD'
    )
    and exists (
      select 1 from public.billing_transactions
      where id = 'a0340000-0000-0000-0000-000000000602'
        and tool_email_link_id = 'a0340000-0000-0000-0000-000000000302'
        and source = 'manual' and amount = 19.00 and currency = 'USD'
    )
    and exists (
      select 1
      from public.billing_renewal_activity as activity
      join public.billing_renewal_periods as period
        on period.id = activity.billing_renewal_period_id
      where activity.id = 'a0340000-0000-0000-0000-000000000701'
        and activity.tool_email_link_id = 'a0340000-0000-0000-0000-000000000301'
        and activity.billing_renewal_period_id = 'a0340000-0000-0000-0000-000000000501'
        and activity.user_id = period.user_id
        and activity.kind = 'billing_period_corrected'
        and activity.activity_date = period.billing_date
        and activity.previous_billing_date = period.billing_date - 1
        and activity.billing_date = period.billing_date
        and activity.plan_name_snapshot = 'TEST Monthly Primary'
        and activity.billing_type_snapshot = 'Monthly'
        and activity.currency_snapshot = 'SGD'
        and activity.amount_snapshot = 30.84
        and activity.note = 'Protected fixture renewal activity.'
    ) as protected_history_is_preserved
  from fixture_counts as counts
  cross join ownership
  cross join auth_params
)
select *,
  test_user_id_replaced
  and test_email_replaced
  and dedicated_confirmed_auth_user_exists
  and fixture_stage <> 'unexpected'
  and dedicated_owner_is_consistent
  and (
    fixture_stage = 'absent'
    or (fixture_stage = 'ready' and ready_state_contract and protected_history_is_preserved)
    or (fixture_stage = 'paused' and paused_state_contract and protected_history_is_preserved)
  ) as pause_e2e_fixture_state_passed
from checks;
