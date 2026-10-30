-- A036 payment-correction browser verification. SELECT only.
-- Browser sequence expected before running this script:
--   1. Manual payment: Plan Name only, A036 Manual Baseline -> A036 Manual Corrected.
--   2. Renewal payment: Amount only, 20 -> 21.
-- First run: copy the four observed IDs from observed_correction_events below.
-- Replace all four zero UUIDs, rerun, and require browser_verification_passed = true.

with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as manual_request_id,
    '00000000-0000-0000-0000-000000000000'::uuid as manual_event_id,
    '00000000-0000-0000-0000-000000000000'::uuid as renewal_request_id,
    '00000000-0000-0000-0000-000000000000'::uuid as renewal_event_id
), owner as (
  select login.user_id
  from public.logins as login
  join auth.users as auth_user on auth_user.id = login.user_id
  where login.id = 'a0360000-0000-0000-0000-000000000101'
    and login.label = 'TEST Current Billing Browser A036'
    and lower(login.email_address) = lower('billing-browser-a036@ai-subprise.invalid')
    and auth_user.email_confirmed_at is not null
), expected_snapshots as (
  select
    jsonb_build_object(
      'transactionId', 'a0360000-0000-0000-0000-000000000601'::uuid,
      'relationshipId', 'a0360000-0000-0000-0000-000000000301'::uuid,
      'source', 'manual', 'sourceKey', 'a036-payment-correction-manual',
      'paymentDate', date '2026-09-30', 'planName', 'A036 Manual Baseline',
      'billingType', 'Monthly', 'currency', 'SGD', 'amount', 10::numeric,
      'status', 'Paid', 'note', 'A036 manual baseline'
    ) as manual_before,
    jsonb_build_object(
      'transactionId', 'a0360000-0000-0000-0000-000000000601'::uuid,
      'relationshipId', 'a0360000-0000-0000-0000-000000000301'::uuid,
      'source', 'manual', 'sourceKey', 'a036-payment-correction-manual',
      'paymentDate', date '2026-09-30', 'planName', 'A036 Manual Corrected',
      'billingType', 'Monthly', 'currency', 'SGD', 'amount', 10::numeric,
      'status', 'Paid', 'note', 'A036 manual baseline'
    ) as manual_after,
    jsonb_build_object(
      'transactionId', 'a0360000-0000-0000-0000-000000000602'::uuid,
      'relationshipId', 'a0360000-0000-0000-0000-000000000301'::uuid,
      'source', 'renewal', 'sourceKey', 'renewal-period:a0360000-0000-0000-0000-000000000501',
      'paymentDate', date '2026-10-01', 'planName', 'A036 Renewal Baseline',
      'billingType', 'Monthly', 'currency', 'SGD', 'amount', 20::numeric,
      'status', 'Paid', 'note', 'A036 renewal baseline'
    ) as renewal_before,
    jsonb_build_object(
      'transactionId', 'a0360000-0000-0000-0000-000000000602'::uuid,
      'relationshipId', 'a0360000-0000-0000-0000-000000000301'::uuid,
      'source', 'renewal', 'sourceKey', 'renewal-period:a0360000-0000-0000-0000-000000000501',
      'paymentDate', date '2026-10-01', 'planName', 'A036 Renewal Baseline',
      'billingType', 'Monthly', 'currency', 'SGD', 'amount', 21::numeric,
      'status', 'Paid', 'note', 'A036 renewal baseline'
    ) as renewal_after
), fixture as (
  select
    (select count(*) from owner) = 1
      and (select count(*) from public.profiles where id = (select user_id from owner)) = 1
      and (select count(*) from public.logins where user_id = (select user_id from owner)) = 1
      as exact_owner,
    exists (
      select 1 from public.ai_tools
      where id = 'a0360000-0000-0000-0000-000000000201'
        and user_id = (select user_id from owner)
        and name = 'TEST Payment Corrections A036'
    ) as exact_tool,
    exists (
      select 1 from public.tool_email_links
      where id = 'a0360000-0000-0000-0000-000000000301'
        and user_id = (select user_id from owner)
        and tool_id = 'a0360000-0000-0000-0000-000000000201'
        and email_account_id = 'a0360000-0000-0000-0000-000000000101'
        and plan_name = 'A036 Fixture' and amount = '30' and unlinked_at is null
    ) as exact_relationship,
    exists (
      select 1 from public.tool_link_billing_components
      where id = 'a0360000-0000-0000-0000-000000000401'
        and tool_email_link_id = 'a0360000-0000-0000-0000-000000000301'
        and billing_type = 'Monthly' and amount = 30 and currency = 'SGD'
        and next_renewal_date = date '2028-01-31' and retired_at is null
    ) as current_billing_unchanged,
    exists (
      select 1 from public.billing_transactions
      where id = 'a0360000-0000-0000-0000-000000000601'
        and user_id = (select user_id from owner)
        and tool_email_link_id = 'a0360000-0000-0000-0000-000000000301'
        and source = 'manual' and source_key = 'a036-payment-correction-manual'
        and payment_date = date '2026-09-30' and plan_name_snapshot = 'A036 Manual Corrected'
        and billing_type_snapshot = 'Monthly' and amount = 10 and currency = 'SGD'
        and status = 'Paid' and note = 'A036 manual baseline'
    ) as manual_payment_corrected,
    exists (
      select 1 from public.billing_transactions
      where id = 'a0360000-0000-0000-0000-000000000602'
        and user_id = (select user_id from owner)
        and tool_email_link_id = 'a0360000-0000-0000-0000-000000000301'
        and source = 'renewal'
        and source_key = 'renewal-period:a0360000-0000-0000-0000-000000000501'
        and payment_date = date '2026-10-01' and plan_name_snapshot = 'A036 Renewal Baseline'
        and billing_type_snapshot = 'Monthly' and amount = 21 and currency = 'SGD'
        and status = 'Paid' and note = 'A036 renewal baseline'
    ) as renewal_payment_corrected,
    exists (
      select 1 from public.billing_renewal_periods
      where id = 'a0360000-0000-0000-0000-000000000501'
        and user_id = (select user_id from owner)
        and tool_email_link_id = 'a0360000-0000-0000-0000-000000000301'
        and billing_component_id = 'a0360000-0000-0000-0000-000000000401'
        and actual_payment_date = date '2026-10-01'
        and plan_name_snapshot = 'A036 Renewal Baseline'
        and billing_type_snapshot = 'Monthly' and currency_snapshot = 'SGD'
        and amount_snapshot = 21 and resolution = 'paid' and excluded_at is null
        and payment_transaction_id = 'a0360000-0000-0000-0000-000000000602'
    ) as renewal_period_corrected
), events as (
  select
    count(*) = 2 as exact_event_count,
    count(*) filter (
      where event.id = params.manual_event_id and event.request_id = params.manual_request_id
        and event.user_id = owner.user_id
        and event.tool_email_link_id = 'a0360000-0000-0000-0000-000000000301'
        and event.payment_transaction_id = 'a0360000-0000-0000-0000-000000000601'
        and event.payment_source = 'manual' and event.effective_date = date '2026-09-30'
        and event.changed_fields = array['plan_name']::text[]
        and event.before_snapshot = snapshots.manual_before
        and event.after_snapshot = snapshots.manual_after
    ) = 1 as exact_manual_event,
    count(*) filter (
      where event.id = params.renewal_event_id and event.request_id = params.renewal_request_id
        and event.user_id = owner.user_id
        and event.tool_email_link_id = 'a0360000-0000-0000-0000-000000000301'
        and event.payment_transaction_id = 'a0360000-0000-0000-0000-000000000602'
        and event.payment_source = 'renewal' and event.effective_date = date '2026-10-01'
        and event.changed_fields = array['amount']::text[]
        and event.before_snapshot = snapshots.renewal_before
        and event.after_snapshot = snapshots.renewal_after
    ) = 1 as exact_renewal_event,
    coalesce(jsonb_agg(jsonb_build_object(
      'eventId', event.id, 'requestId', event.request_id,
      'paymentSource', event.payment_source, 'changedFields', event.changed_fields,
      'beforeSnapshot', event.before_snapshot, 'afterSnapshot', event.after_snapshot
    ) order by event.payment_source), '[]'::jsonb) as observed_correction_events
  from owner
  cross join params
  cross join expected_snapshots as snapshots
  left join public.billing_payment_correction_events as event on event.user_id = owner.user_id
), isolation as (
  select
    (select count(*) from public.ai_tools where user_id = owner.user_id) = 1
      and (select count(*) from public.tool_email_links where user_id = owner.user_id) = 1
      and (select count(*) from public.billing_transactions where user_id = owner.user_id) = 2
      and (select count(*) from public.billing_renewal_periods where user_id = owner.user_id) = 1
      and (select count(*) from public.billing_renewal_activity where user_id = owner.user_id) = 0
      and (select count(*) from public.subscription_lifecycle_events where user_id = owner.user_id) = 0
      and (select count(*) from public.subscription_billing_events where user_id = owner.user_id) = 0
      as exact_a036_scope,
    (select count(*) from public.billing_transactions where user_id <> owner.user_id) = 24
      and (select md5(coalesce(string_agg(to_jsonb(payment)::text, '|' order by payment.id::text), ''))
        from public.billing_transactions as payment where payment.user_id <> owner.user_id)
        = '5bb5d6d224232b3d8eef3d4c98f27adb'
      as non_a036_payments_unchanged,
    (select count(*) from public.billing_renewal_periods where user_id <> owner.user_id) = 20
      and (select md5(coalesce(string_agg(to_jsonb(period)::text, '|' order by period.id::text), ''))
        from public.billing_renewal_periods as period where period.user_id <> owner.user_id)
        = '4ddb30e76275be3f52b050772fa6e9f4'
      as non_a036_periods_unchanged
  from owner
)
select
  fixture.*, events.exact_event_count, events.exact_manual_event, events.exact_renewal_event,
  isolation.*, events.observed_correction_events,
  params.manual_request_id <> '00000000-0000-0000-0000-000000000000'::uuid
    and params.manual_event_id <> '00000000-0000-0000-0000-000000000000'::uuid
    and params.renewal_request_id <> '00000000-0000-0000-0000-000000000000'::uuid
    and params.renewal_event_id <> '00000000-0000-0000-0000-000000000000'::uuid
    and fixture.exact_owner and fixture.exact_tool and fixture.exact_relationship
    and fixture.current_billing_unchanged and fixture.manual_payment_corrected
    and fixture.renewal_payment_corrected and fixture.renewal_period_corrected
    and events.exact_event_count and events.exact_manual_event and events.exact_renewal_event
    and isolation.exact_a036_scope and isolation.non_a036_payments_unchanged
    and isolation.non_a036_periods_unchanged
    as browser_verification_passed
from params cross join fixture cross join events cross join isolation;
