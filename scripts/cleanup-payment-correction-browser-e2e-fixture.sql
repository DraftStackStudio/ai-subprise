-- Exact-scope A036 browser-test cleanup.
-- Copy the four verified IDs from verify-payment-correction-browser-e2e.sql.
-- Zero UUID placeholders deliberately make the guard fail closed.
-- Preserves the existing A036 Auth user, profile and login.

begin;

create temporary table a036_browser_cleanup_context on commit drop as
select
  login.user_id,
  '00000000-0000-0000-0000-000000000000'::uuid as manual_request_id,
  '00000000-0000-0000-0000-000000000000'::uuid as manual_event_id,
  '00000000-0000-0000-0000-000000000000'::uuid as renewal_request_id,
  '00000000-0000-0000-0000-000000000000'::uuid as renewal_event_id
from public.logins as login
join auth.users as auth_user on auth_user.id = login.user_id
where login.id = 'a0360000-0000-0000-0000-000000000101'
  and login.label = 'TEST Current Billing Browser A036'
  and lower(login.email_address) = lower('billing-browser-a036@ai-subprise.invalid')
  and auth_user.email_confirmed_at is not null;

do $guard$
declare
  v_context a036_browser_cleanup_context%rowtype;
  v_manual_before jsonb;
  v_manual_after jsonb;
  v_renewal_before jsonb;
  v_renewal_after jsonb;
begin
  if (select count(*) from a036_browser_cleanup_context) <> 1 then
    raise exception 'Safety stop: exact confirmed A036 owner not found.';
  end if;
  select * into v_context from a036_browser_cleanup_context;
  if v_context.manual_request_id = '00000000-0000-0000-0000-000000000000'::uuid
    or v_context.manual_event_id = '00000000-0000-0000-0000-000000000000'::uuid
    or v_context.renewal_request_id = '00000000-0000-0000-0000-000000000000'::uuid
    or v_context.renewal_event_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Safety stop: replace all four verified browser correction IDs.';
  end if;

  v_manual_before := jsonb_build_object(
    'transactionId', 'a0360000-0000-0000-0000-000000000601'::uuid,
    'relationshipId', 'a0360000-0000-0000-0000-000000000301'::uuid,
    'source', 'manual', 'sourceKey', 'a036-payment-correction-manual',
    'paymentDate', date '2026-09-30', 'planName', 'A036 Manual Baseline',
    'billingType', 'Monthly', 'currency', 'SGD', 'amount', 10::numeric,
    'status', 'Paid', 'note', 'A036 manual baseline');
  v_manual_after := v_manual_before || jsonb_build_object('planName', 'A036 Manual Corrected');
  v_renewal_before := jsonb_build_object(
    'transactionId', 'a0360000-0000-0000-0000-000000000602'::uuid,
    'relationshipId', 'a0360000-0000-0000-0000-000000000301'::uuid,
    'source', 'renewal', 'sourceKey', 'renewal-period:a0360000-0000-0000-0000-000000000501',
    'paymentDate', date '2026-10-01', 'planName', 'A036 Renewal Baseline',
    'billingType', 'Monthly', 'currency', 'SGD', 'amount', 20::numeric,
    'status', 'Paid', 'note', 'A036 renewal baseline');
  v_renewal_after := v_renewal_before || jsonb_build_object('amount', 21::numeric);

  if (select count(*) from public.profiles where id = v_context.user_id) <> 1
    or (select count(*) from public.logins where user_id = v_context.user_id) <> 1
    or (select count(*) from public.ai_tools where user_id = v_context.user_id
      and id = 'a0360000-0000-0000-0000-000000000201' and name = 'TEST Payment Corrections A036') <> 1
    or (select count(*) from public.tool_email_links where user_id = v_context.user_id
      and id = 'a0360000-0000-0000-0000-000000000301'
      and tool_id = 'a0360000-0000-0000-0000-000000000201'
      and email_account_id = 'a0360000-0000-0000-0000-000000000101'
      and plan_name = 'A036 Fixture' and amount = '30' and unlinked_at is null) <> 1
    or (select count(*) from public.tool_link_billing_components
      where id = 'a0360000-0000-0000-0000-000000000401'
        and tool_email_link_id = 'a0360000-0000-0000-0000-000000000301'
        and billing_type = 'Monthly' and amount = 30 and currency = 'SGD'
        and next_renewal_date = date '2028-01-31' and retired_at is null) <> 1
    or (select count(*) from public.billing_transactions where user_id = v_context.user_id) <> 2
    or (select count(*) from public.billing_renewal_periods where user_id = v_context.user_id) <> 1
    or (select count(*) from public.billing_payment_correction_events where user_id = v_context.user_id) <> 2 then
    raise exception 'Safety stop: exact A036 browser-test manifest not found.';
  end if;

  if not exists (select 1 from public.billing_transactions
      where id = 'a0360000-0000-0000-0000-000000000601' and user_id = v_context.user_id
        and tool_email_link_id = 'a0360000-0000-0000-0000-000000000301'
        and source = 'manual' and source_key = 'a036-payment-correction-manual'
        and payment_date = date '2026-09-30' and plan_name_snapshot = 'A036 Manual Corrected'
        and billing_type_snapshot = 'Monthly' and amount = 10 and currency = 'SGD'
        and status = 'Paid' and note = 'A036 manual baseline')
    or not exists (select 1 from public.billing_transactions
      where id = 'a0360000-0000-0000-0000-000000000602' and user_id = v_context.user_id
        and tool_email_link_id = 'a0360000-0000-0000-0000-000000000301'
        and source = 'renewal'
        and source_key = 'renewal-period:a0360000-0000-0000-0000-000000000501'
        and payment_date = date '2026-10-01' and plan_name_snapshot = 'A036 Renewal Baseline'
        and billing_type_snapshot = 'Monthly' and amount = 21 and currency = 'SGD'
        and status = 'Paid' and note = 'A036 renewal baseline')
    or not exists (select 1 from public.billing_renewal_periods
      where id = 'a0360000-0000-0000-0000-000000000501' and user_id = v_context.user_id
        and tool_email_link_id = 'a0360000-0000-0000-0000-000000000301'
        and billing_component_id = 'a0360000-0000-0000-0000-000000000401'
        and actual_payment_date = date '2026-10-01' and plan_name_snapshot = 'A036 Renewal Baseline'
        and billing_type_snapshot = 'Monthly' and currency_snapshot = 'SGD'
        and amount_snapshot = 21 and resolution = 'paid' and excluded_at is null
        and payment_transaction_id = 'a0360000-0000-0000-0000-000000000602') then
    raise exception 'Safety stop: A036 browser correction values do not match the approved test.';
  end if;

  if not exists (select 1 from public.billing_payment_correction_events
      where id = v_context.manual_event_id and request_id = v_context.manual_request_id
        and user_id = v_context.user_id
        and tool_email_link_id = 'a0360000-0000-0000-0000-000000000301'
        and payment_transaction_id = 'a0360000-0000-0000-0000-000000000601'
        and payment_source = 'manual' and effective_date = date '2026-09-30'
        and changed_fields = array['plan_name']::text[]
        and before_snapshot = v_manual_before and after_snapshot = v_manual_after)
    or not exists (select 1 from public.billing_payment_correction_events
      where id = v_context.renewal_event_id and request_id = v_context.renewal_request_id
        and user_id = v_context.user_id
        and tool_email_link_id = 'a0360000-0000-0000-0000-000000000301'
        and payment_transaction_id = 'a0360000-0000-0000-0000-000000000602'
        and payment_source = 'renewal' and effective_date = date '2026-10-01'
        and changed_fields = array['amount']::text[]
        and before_snapshot = v_renewal_before and after_snapshot = v_renewal_after) then
    raise exception 'Safety stop: exact browser correction events and request IDs do not match.';
  end if;

  if exists (select 1 from public.billing_renewal_activity where user_id = v_context.user_id)
    or exists (select 1 from public.subscription_lifecycle_events where user_id = v_context.user_id)
    or exists (select 1 from public.subscription_billing_events where user_id = v_context.user_id)
    or (select count(*) from public.billing_transactions where user_id <> v_context.user_id) <> 24
    or (select md5(coalesce(string_agg(to_jsonb(payment)::text, '|' order by payment.id::text), ''))
      from public.billing_transactions as payment where payment.user_id <> v_context.user_id)
      <> '5bb5d6d224232b3d8eef3d4c98f27adb'
    or (select count(*) from public.billing_renewal_periods where user_id <> v_context.user_id) <> 20
    or (select md5(coalesce(string_agg(to_jsonb(period)::text, '|' order by period.id::text), ''))
      from public.billing_renewal_periods as period where period.user_id <> v_context.user_id)
      <> '4ddb30e76275be3f52b050772fa6e9f4' then
    raise exception 'Safety stop: unrelated production data or unexpected A036 side effects changed.';
  end if;
end $guard$;

delete from public.billing_payment_correction_events
where user_id = (select user_id from a036_browser_cleanup_context)
  and id in (
    (select manual_event_id from a036_browser_cleanup_context),
    (select renewal_event_id from a036_browser_cleanup_context)
  )
  and request_id in (
    (select manual_request_id from a036_browser_cleanup_context),
    (select renewal_request_id from a036_browser_cleanup_context)
  );
delete from public.billing_renewal_periods
where id = 'a0360000-0000-0000-0000-000000000501'
  and user_id = (select user_id from a036_browser_cleanup_context);
delete from public.billing_transactions
where id in ('a0360000-0000-0000-0000-000000000601', 'a0360000-0000-0000-0000-000000000602')
  and user_id = (select user_id from a036_browser_cleanup_context);
delete from public.tool_link_billing_components
where id = 'a0360000-0000-0000-0000-000000000401'
  and tool_email_link_id = 'a0360000-0000-0000-0000-000000000301';
delete from public.tool_email_links
where id = 'a0360000-0000-0000-0000-000000000301'
  and user_id = (select user_id from a036_browser_cleanup_context);
delete from public.ai_tools
where id = 'a0360000-0000-0000-0000-000000000201'
  and user_id = (select user_id from a036_browser_cleanup_context);

do $postcondition$
declare v_user_id uuid := (select user_id from a036_browser_cleanup_context);
begin
  if (select count(*) from public.profiles where id = v_user_id) <> 1
    or (select count(*) from public.logins where user_id = v_user_id
      and id = 'a0360000-0000-0000-0000-000000000101') <> 1
    or exists (select 1 from public.ai_tools where user_id = v_user_id)
    or exists (select 1 from public.tool_email_links where user_id = v_user_id)
    or exists (select 1 from public.billing_transactions where user_id = v_user_id)
    or exists (select 1 from public.billing_renewal_periods where user_id = v_user_id)
    or exists (select 1 from public.billing_payment_correction_events where user_id = v_user_id)
    or exists (select 1 from public.tool_link_billing_components
      where tool_email_link_id = 'a0360000-0000-0000-0000-000000000301')
    or (select count(*) from public.billing_transactions) <> 24
    or (select md5(coalesce(string_agg(to_jsonb(payment)::text, '|' order by payment.id::text), ''))
      from public.billing_transactions as payment) <> '5bb5d6d224232b3d8eef3d4c98f27adb'
    or (select count(*) from public.billing_renewal_periods) <> 20
    or (select md5(coalesce(string_agg(to_jsonb(period)::text, '|' order by period.id::text), ''))
      from public.billing_renewal_periods as period) <> '4ddb30e76275be3f52b050772fa6e9f4' then
    raise exception 'Cleanup postcondition failed; transaction will roll back.';
  end if;
end $postcondition$;

select 'PASS: exact A036 browser fixture and its two verified correction events removed; Auth user, profile and login preserved.' as result;
commit;
