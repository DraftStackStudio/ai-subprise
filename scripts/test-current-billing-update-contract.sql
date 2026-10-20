-- Rollback-only behavioural verification for migration 0034.
-- Run manually only after 0034 has been applied. Every a035 fixture rolls back.
-- Before execution, replace both placeholders below with the exact UUID and
-- deliverable email of an explicitly approved, confirmed test Auth user.
-- Never substitute an arbitrary production user.
begin;
set transaction isolation level repeatable read;

create temporary table billing_0034_context (user_id uuid primary key) on commit drop;
create temporary table billing_0034_revision (
  relationship_id uuid primary key,
  revision jsonb not null
) on commit drop;

do $setup$
declare
  v_user_id constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_user_email constant text := 'REPLACE_WITH_DEDICATED_TEST_AUTH_EMAIL';
begin
  if v_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Replace the zero UUID with the explicitly approved 0034 test Auth user ID.';
  end if;
  if lower(v_user_email) = lower('REPLACE_WITH_DEDICATED_TEST_AUTH_EMAIL') then
    raise exception 'Replace the Auth-email placeholder with the explicitly approved 0034 test Auth email.';
  end if;
  if not exists (
    select 1
    from auth.users as fixture_user
    where fixture_user.id = v_user_id
      and lower(fixture_user.email) = lower(v_user_email)
      and fixture_user.email_confirmed_at is not null
  ) then
    raise exception 'The exact confirmed 0034 test Auth user was not found.';
  end if;
  if exists (select 1 from public.ai_tools where id::text like 'a035%')
    or exists (select 1 from public.logins where id::text like 'a035%')
    or exists (select 1 from public.tool_email_links where id::text like 'a035%')
    or exists (select 1 from public.tool_link_billing_components where id::text like 'a035%')
    or exists (select 1 from public.billing_renewal_periods where id::text like 'a035%')
    or exists (select 1 from public.billing_transactions where id::text like 'a035%')
    or exists (select 1 from public.subscription_billing_events where id::text like 'a035%') then
    raise exception 'Safety stop: disposable a035 fixture IDs already exist.';
  end if;
  if exists (
    select 1
    from public.ai_tools as tool
    where tool.user_id = v_user_id
      and tool.deleted_at is null
      and lower(trim(tool.name)) = lower(trim('TEST Current Billing Contract 0034'))
  ) then
    raise exception 'Safety stop: the 0034 fixture AI tool name already exists for the approved test owner.';
  end if;
  if exists (
    select 1
    from public.billing_transactions as payment
    where payment.user_id = v_user_id
      and payment.source = 'manual'
      and payment.source_key = 'a035-protected-payment'
  ) then
    raise exception 'Safety stop: the 0034 fixture Payment source key already exists for the approved test owner.';
  end if;
  if exists (
    select 1
    from public.logins as login
    where login.user_id = v_user_id
      and lower(login.email_address) in (
        'billing-change-0034@ai-subprise.invalid',
        'billing-correction-0034@ai-subprise.invalid',
        'billing-control-0034@ai-subprise.invalid',
        'billing-paused-0034@ai-subprise.invalid',
        'billing-one-time-0034@ai-subprise.invalid',
        'billing-resolved-0034@ai-subprise.invalid'
      )
  ) then
    raise exception 'Safety stop: a 0034 fixture login address already exists for the approved test owner.';
  end if;
  insert into billing_0034_context values (v_user_id);

  insert into public.logins (id, user_id, email_address, label, colour) values
    ('a0350000-0000-0000-0000-000000000101', v_user_id, 'billing-change-0034@ai-subprise.invalid', 'TEST Billing Change 0034', '#f59e0b'),
    ('a0350000-0000-0000-0000-000000000102', v_user_id, 'billing-correction-0034@ai-subprise.invalid', 'TEST Billing Correction 0034', '#10b981'),
    ('a0350000-0000-0000-0000-000000000103', v_user_id, 'billing-control-0034@ai-subprise.invalid', 'TEST Billing Control 0034', '#64748b'),
    ('a0350000-0000-0000-0000-000000000104', v_user_id, 'billing-paused-0034@ai-subprise.invalid', 'TEST Billing Paused 0034', '#8b5cf6'),
    ('a0350000-0000-0000-0000-000000000105', v_user_id, 'billing-one-time-0034@ai-subprise.invalid', 'TEST Billing One-time 0034', '#0ea5e9'),
    ('a0350000-0000-0000-0000-000000000106', v_user_id, 'billing-resolved-0034@ai-subprise.invalid', 'TEST Billing Resolved 0034', '#ef4444');
  insert into public.ai_tools (id, user_id, name, category, status, is_favourite, is_archived, notes) values
    ('a0350000-0000-0000-0000-000000000201', v_user_id, 'TEST Current Billing Contract 0034', 'Other', 'Paid', false, false, 'Rollback-only 0034 fixture.');
  insert into public.tool_email_links (
    id, user_id, tool_id, email_account_id, slot_order, plan, plan_name, status,
    billing_type, amount, currency, next_charge_date, purchase_date, trial_resolved, unlinked_at
  ) values
    ('a0350000-0000-0000-0000-000000000301', v_user_id, 'a0350000-0000-0000-0000-000000000201', 'a0350000-0000-0000-0000-000000000101', 1, 'Paid', 'Standard', 'Active', 'Monthly, Top-up', '30.84', 'SGD', date '2026-10-31', null, false, null),
    ('a0350000-0000-0000-0000-000000000302', v_user_id, 'a0350000-0000-0000-0000-000000000201', 'a0350000-0000-0000-0000-000000000102', 2, 'Paid', 'Correction Plan', 'Active', 'Monthly', '10.00', 'SGD', current_date, null, false, null),
    ('a0350000-0000-0000-0000-000000000303', v_user_id, 'a0350000-0000-0000-0000-000000000201', 'a0350000-0000-0000-0000-000000000103', 3, 'Paid', 'Lifetime Plan', 'Active', 'Lifetime', '99.00', 'USD', null, current_date - 100, false, null),
    ('a0350000-0000-0000-0000-000000000304', v_user_id, 'a0350000-0000-0000-0000-000000000201', 'a0350000-0000-0000-0000-000000000104', 4, 'Paid', 'Paused Plan', 'Paused', 'Monthly', '12.00', 'SGD', null, null, false, null),
    ('a0350000-0000-0000-0000-000000000305', v_user_id, 'a0350000-0000-0000-0000-000000000201', 'a0350000-0000-0000-0000-000000000105', 5, 'Paid', 'One-time Plan', 'Active', 'One-time', null, 'SGD', null, date '2026-01-15', false, null),
    ('a0350000-0000-0000-0000-000000000306', v_user_id, 'a0350000-0000-0000-0000-000000000201', 'a0350000-0000-0000-0000-000000000106', 6, 'Paid', 'Resolved Plan', 'Active', 'Monthly', '20.00', 'SGD', current_date + 30, null, false, null);
  insert into public.tool_link_billing_components (
    id, tool_email_link_id, billing_type, amount, currency, next_renewal_date,
    purchase_date, last_top_up_date, recurrence_anchor_date, retired_at
  ) values
    ('a0350000-0000-0000-0000-000000000401', 'a0350000-0000-0000-0000-000000000301', 'Monthly', '30.84', 'SGD', date '2026-10-31', null, null, date '2026-01-31', null),
    ('a0350000-0000-0000-0000-000000000402', 'a0350000-0000-0000-0000-000000000301', 'Top-up', '5.00', 'SGD', null, null, current_date - 10, null, null),
    ('a0350000-0000-0000-0000-000000000403', 'a0350000-0000-0000-0000-000000000302', 'Monthly', '10.00', 'SGD', current_date, null, null, current_date, null),
    ('a0350000-0000-0000-0000-000000000404', 'a0350000-0000-0000-0000-000000000303', 'Lifetime', '99.00', 'USD', null, current_date - 100, null, null, null),
    ('a0350000-0000-0000-0000-000000000405', 'a0350000-0000-0000-0000-000000000304', 'Monthly', '12.00', 'SGD', current_date + 30, null, null, current_date + 30, clock_timestamp()),
    ('a0350000-0000-0000-0000-000000000406', 'a0350000-0000-0000-0000-000000000305', 'One-time', null, 'SGD', null, date '2026-01-15', null, null, null),
    ('a0350000-0000-0000-0000-000000000407', 'a0350000-0000-0000-0000-000000000306', 'Monthly', '20.00', 'SGD', current_date + 30, null, null, current_date - 1, null);
  insert into public.billing_renewal_periods (
    id, user_id, tool_email_link_id, billing_component_id, scheduled_renewal_date,
    billing_date, plan_name_snapshot, billing_type_snapshot, currency_snapshot,
    amount_snapshot, resolution, resolved_at, not_charged_reason_code
  ) values
    ('a0350000-0000-0000-0000-000000000501', v_user_id, 'a0350000-0000-0000-0000-000000000301', 'a0350000-0000-0000-0000-000000000401', date '2026-01-31', date '2026-01-31', 'Standard', 'Monthly', 'SGD', 30.84, 'not_charged', clock_timestamp(), 'free_or_waived'),
    ('a0350000-0000-0000-0000-000000000503', v_user_id, 'a0350000-0000-0000-0000-000000000301', 'a0350000-0000-0000-0000-000000000401', date '2026-03-31', date '2026-03-31', 'Standard', 'Monthly', 'SGD', 30.84, null, null, null),
    ('a0350000-0000-0000-0000-000000000504', v_user_id, 'a0350000-0000-0000-0000-000000000301', 'a0350000-0000-0000-0000-000000000401', date '2026-04-30', date '2026-04-30', 'Standard', 'Monthly', 'SGD', 30.84, null, null, null),
    ('a0350000-0000-0000-0000-000000000505', v_user_id, 'a0350000-0000-0000-0000-000000000302', 'a0350000-0000-0000-0000-000000000403', current_date, current_date, 'Correction Plan', 'Monthly', 'SGD', 10.00, null, null, null),
    ('a0350000-0000-0000-0000-000000000506', v_user_id, 'a0350000-0000-0000-0000-000000000306', 'a0350000-0000-0000-0000-000000000407', current_date - 1, current_date - 1, 'Resolved Plan', 'Monthly', 'SGD', 20.00, 'not_charged', clock_timestamp(), 'free_or_waived');
  insert into public.billing_transactions (
    id, user_id, tool_email_link_id, tool_id, login_id, payment_date,
    tool_name_snapshot, account_label_snapshot, account_login_snapshot,
    plan_name_snapshot, billing_type_snapshot, amount, currency, status,
    note, source, source_key
  ) values (
    'a0350000-0000-0000-0000-000000000601', v_user_id,
    'a0350000-0000-0000-0000-000000000301', 'a0350000-0000-0000-0000-000000000201',
    'a0350000-0000-0000-0000-000000000101', current_date - 40,
    'TEST Current Billing Contract 0034', 'TEST Billing Change 0034', 'billing-change-0034@ai-subprise.invalid',
    'Standard', 'Monthly', 30.84, 'SGD', 'Paid', 'Protected historical Payment.', 'manual', 'a035-protected-payment'
  );

  insert into billing_0034_revision (relationship_id, revision)
  select link.id, public.current_billing_revision(link.id)
  from public.tool_email_links as link
  where link.id::text like 'a035%' and link.id in (
    'a0350000-0000-0000-0000-000000000301',
    'a0350000-0000-0000-0000-000000000302',
    'a0350000-0000-0000-0000-000000000303',
    'a0350000-0000-0000-0000-000000000304',
    'a0350000-0000-0000-0000-000000000305',
    'a0350000-0000-0000-0000-000000000306'
  );
end
$setup$;

create temporary table billing_0034_baseline on commit drop as
select
  (select md5(to_jsonb(payment)::text) from public.billing_transactions as payment where payment.id = 'a0350000-0000-0000-0000-000000000601') as payment_fingerprint,
  (select md5(to_jsonb(period)::text) from public.billing_renewal_periods as period where period.id = 'a0350000-0000-0000-0000-000000000501') as resolved_period_fingerprint,
  (select md5(to_jsonb(link)::text) from public.tool_email_links as link where link.id = 'a0350000-0000-0000-0000-000000000303') as control_relationship_fingerprint,
  (select md5(to_jsonb(component)::text) from public.tool_link_billing_components as component where component.id = 'a0350000-0000-0000-0000-000000000404') as control_component_fingerprint,
  md5(concat_ws('|',
    (select md5(coalesce(string_agg(to_jsonb(link)::text, '|' order by link.id), '')) from public.tool_email_links as link where link.id::text not like 'a035%'),
    (select md5(coalesce(string_agg(to_jsonb(component)::text, '|' order by component.id), '')) from public.tool_link_billing_components as component where component.tool_email_link_id::text not like 'a035%'),
    (select md5(coalesce(string_agg(to_jsonb(period)::text, '|' order by period.id), '')) from public.billing_renewal_periods as period where period.tool_email_link_id::text not like 'a035%'),
    (select md5(coalesce(string_agg(to_jsonb(payment)::text, '|' order by payment.id), '')) from public.billing_transactions as payment where coalesce(payment.tool_email_link_id::text, '') not like 'a035%'),
    (select md5(coalesce(string_agg(to_jsonb(activity)::text, '|' order by activity.id), '')) from public.billing_renewal_activity as activity where activity.tool_email_link_id::text not like 'a035%'),
    (select md5(coalesce(string_agg(to_jsonb(event)::text, '|' order by event.id), '')) from public.subscription_lifecycle_events as event where event.tool_email_link_id::text not like 'a035%'),
    (select md5(coalesce(string_agg(to_jsonb(event)::text, '|' order by event.id), '')) from public.subscription_billing_events as event where event.tool_email_link_id::text not like 'a035%')
  )) as non_fixture_fingerprint;

grant select on billing_0034_context, billing_0034_revision, billing_0034_baseline to authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from billing_0034_context), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object('sub', (select user_id::text from billing_0034_context), 'role', 'authenticated')::text, true);
set local role authenticated;

-- A genuine multi-field change is one event and one recurring boundary.
select * from public.update_current_billing(
  'a0350000-0000-0000-0000-000000000301',
  'a0350000-0000-0000-0000-000000000701',
  date '2026-03-31',
  'change',
  (select revision from billing_0034_revision where relationship_id = 'a0350000-0000-0000-0000-000000000301'),
  'Premium',
  jsonb_build_array(
    jsonb_build_object('billingType', 'Yearly', 'amount', null, 'currency', 'usd', 'nextRenewalDate', date '2027-02-28'),
    jsonb_build_object('billingType', 'Top-up', 'amount', '10.00', 'currency', 'sgd', 'lastTopUpDate', date '2026-03-15')
  ),
  'Provider plan changed',
  current_date
);

-- Exact retry must not create another event/component/exclusion.
select * from public.update_current_billing(
  'a0350000-0000-0000-0000-000000000301',
  'a0350000-0000-0000-0000-000000000701',
  date '2026-03-31', 'change',
  (select revision from billing_0034_revision where relationship_id = 'a0350000-0000-0000-0000-000000000301'),
  'Premium',
  jsonb_build_array(
    jsonb_build_object('billingType', 'Yearly', 'amount', null, 'currency', 'usd', 'nextRenewalDate', date '2027-02-28'),
    jsonb_build_object('billingType', 'Top-up', 'amount', '10.00', 'currency', 'sgd', 'lastTopUpDate', date '2026-03-15')
  ),
  'Provider plan changed', current_date
);

-- A correction updates the current row on the save date and does not rewrite
-- or exclude its historical renewal period.
select * from public.update_current_billing(
  'a0350000-0000-0000-0000-000000000302',
  'a0350000-0000-0000-0000-000000000702',
  current_date, 'correction',
  (select revision from billing_0034_revision where relationship_id = 'a0350000-0000-0000-0000-000000000302'),
  'Correction Plan',
  jsonb_build_array(jsonb_build_object(
    'billingType', 'Yearly', 'amount', '0', 'currency', 'SGD',
    'nextRenewalDate', current_date
  )),
  'Corrected an entry mistake', current_date
);

-- Existing unresolved history wins the relationship/date collision. Syncing
-- the corrected current component must skip a duplicate replacement and still
-- advance the corrected Yearly cadence.
select public.sync_due_billing_renewal_periods(
  'a0350000-0000-0000-0000-000000000302',
  (select id from public.tool_link_billing_components
    where tool_email_link_id = 'a0350000-0000-0000-0000-000000000302'
      and billing_type = 'Yearly' and retired_at is null),
  current_date + 1
);

-- An unchanged save is a no-op: no durable event or component write.
select * from public.update_current_billing(
  'a0350000-0000-0000-0000-000000000303',
  'a0350000-0000-0000-0000-000000000703',
  current_date, 'correction',
  (select revision from billing_0034_revision where relationship_id = 'a0350000-0000-0000-0000-000000000303'),
  'Lifetime Plan',
  jsonb_build_array(jsonb_build_object(
    'billingType', 'Lifetime', 'amount', '99', 'currency', 'USD',
    'purchaseDate', current_date - 100
  )),
  null, current_date
);

-- One-time remains non-recurring, while unknown and explicit zero stay distinct.
select * from public.update_current_billing(
  'a0350000-0000-0000-0000-000000000305',
  'a0350000-0000-0000-0000-000000000706',
  current_date, 'change',
  (select revision from billing_0034_revision where relationship_id = 'a0350000-0000-0000-0000-000000000305'),
  'One-time Plan',
  jsonb_build_array(jsonb_build_object(
    'billingType', 'One-time', 'amount', '0.00', 'currency', 'SGD',
    'purchaseDate', date '2026-01-15'
  )),
  null, current_date
);

do $negative_guards$
begin
  begin
    perform public.update_current_billing(
      'a0350000-0000-0000-0000-000000000301',
      'a0350000-0000-0000-0000-000000000701',
      date '2026-03-31', 'change', '{}'::jsonb, 'Different payload',
      jsonb_build_array(jsonb_build_object('billingType', 'Monthly', 'amount', '1', 'currency', 'SGD', 'nextRenewalDate', current_date + 30)),
      null, current_date
    );
    raise exception 'Conflicting idempotency payload unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'This Current Billing request ID is already in use.' then raise; end if;
  end;

  begin
    perform public.update_current_billing(
      'a0350000-0000-0000-0000-000000000306',
      'a0350000-0000-0000-0000-000000000707',
      current_date - 1, 'change',
      (select revision from billing_0034_revision where relationship_id = 'a0350000-0000-0000-0000-000000000306'),
      'Resolved Plan Plus',
      jsonb_build_array(jsonb_build_object('billingType', 'Monthly', 'amount', '25', 'currency', 'SGD', 'nextRenewalDate', current_date + 30)),
      null, current_date
    );
    raise exception 'Backdated change across a resolved period unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'The effective date conflicts with a resolved renewal period.' then raise; end if;
  end;

  begin
    perform public.update_current_billing(
      'a0350000-0000-0000-0000-000000000302',
      'a0350000-0000-0000-0000-000000000708',
      current_date, 'correction',
      (select revision from billing_0034_revision where relationship_id = 'a0350000-0000-0000-0000-000000000302'),
      'Correction Plan',
      jsonb_build_array(jsonb_build_object('billingType', 'Yearly', 'amount', '1', 'currency', 'SGD', 'nextRenewalDate', current_date)),
      null, current_date
    );
    raise exception 'Stale Current Billing revision unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'Current Billing changed. Reopen the editor before saving.' then raise; end if;
  end;

  begin
    perform public.update_current_billing(
      'a0350000-0000-0000-0000-000000000304',
      'a0350000-0000-0000-0000-000000000704',
      current_date, 'correction',
      (select revision from billing_0034_revision where relationship_id = 'a0350000-0000-0000-0000-000000000304'),
      'Paused Plan',
      jsonb_build_array(jsonb_build_object('billingType', 'Monthly', 'amount', '13', 'currency', 'SGD', 'nextRenewalDate', current_date + 30)),
      null, current_date
    );
    raise exception 'Paused relationship update unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'Only an Active paid relationship can update Current Billing.' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', 'b0350000-0000-0000-0000-000000000999', true);
  perform set_config('request.jwt.claims', json_build_object('sub', 'b0350000-0000-0000-0000-000000000999', 'role', 'authenticated')::text, true);
  begin
    perform public.update_current_billing(
      'a0350000-0000-0000-0000-000000000303',
      'a0350000-0000-0000-0000-000000000705',
      current_date, 'correction', '{}'::jsonb, 'Lifetime Plan',
      jsonb_build_array(jsonb_build_object('billingType', 'Lifetime', 'amount', '100', 'currency', 'USD', 'purchaseDate', current_date - 100)),
      null, current_date
    );
    raise exception 'Wrong-owner Current Billing update unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'The selected relationship is no longer available.' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', (select user_id::text from billing_0034_context), true);
  perform set_config('request.jwt.claims', json_build_object('sub', (select user_id::text from billing_0034_context), 'role', 'authenticated')::text, true);
end
$negative_guards$;

reset role;

do $contract_assertions$
declare baseline billing_0034_baseline%rowtype;
begin
  select * into baseline from billing_0034_baseline;
  if (select count(*) from public.subscription_billing_events where tool_email_link_id = 'a0350000-0000-0000-0000-000000000301') <> 1 then
    raise exception 'Genuine multi-field update did not create exactly one event.';
  end if;
  if not exists (
    select 1 from public.subscription_billing_events
    where id = 'a0350000-0000-0000-0000-000000000701'
      and mode = 'change' and effective_date = date '2026-03-31'
      and changed_fields @> array['plan_name', 'billing_type', 'amount', 'currency', 'next_renewal_date', 'last_top_up_date']
      and classifications @> array['plan_changed', 'billing_cycle_changed', 'currency_changed', 'amount_cleared', 'renewal_date_changed']
  ) then raise exception 'Genuine change event did not preserve its combined structured diff.'; end if;
  if not exists (
    select 1 from public.tool_link_billing_components
    where id = 'a0350000-0000-0000-0000-000000000401' and retired_at is not null
  ) or not exists (
    select 1 from public.tool_link_billing_components
    where tool_email_link_id = 'a0350000-0000-0000-0000-000000000301'
      and billing_type = 'Yearly' and retired_at is null
      and amount is null and currency = 'USD'
      and next_renewal_date = date '2027-02-28'
      and recurrence_anchor_date = date '2027-02-28'
  ) then raise exception 'Genuine recurring update did not create the expected version boundary.'; end if;
  if not exists (
    select 1 from public.tool_email_links
    where id = 'a0350000-0000-0000-0000-000000000301'
      and amount is null and currency = 'USD'
  ) then raise exception 'Unknown primary amount incorrectly fell back to the Top-up amount.'; end if;
  if not exists (
    select 1 from public.billing_renewal_periods
    where tool_email_link_id = 'a0350000-0000-0000-0000-000000000301'
      and billing_component_id = 'a0350000-0000-0000-0000-000000000401'
      and scheduled_renewal_date = date '2026-02-28'
      and billing_date = date '2026-02-28'
      and resolution is null and excluded_at is null
  ) then raise exception 'Missing old month-end renewal was not materialized before the effective date.'; end if;
  if (select count(*) from public.billing_renewal_periods
      where id in ('a0350000-0000-0000-0000-000000000503', 'a0350000-0000-0000-0000-000000000504')
        and excluded_by_billing_event_id = 'a0350000-0000-0000-0000-000000000701') <> 2 then
    raise exception 'Renewals on/after the effective date were not excluded with exact provenance.';
  end if;
  if (select md5(to_jsonb(period)::text) from public.billing_renewal_periods as period where period.id = 'a0350000-0000-0000-0000-000000000501') <> baseline.resolved_period_fingerprint then
    raise exception 'A resolved historical renewal period changed.';
  end if;
  if (select md5(to_jsonb(payment)::text) from public.billing_transactions as payment where payment.id = 'a0350000-0000-0000-0000-000000000601') <> baseline.payment_fingerprint then
    raise exception 'A historical Payment changed.';
  end if;
  if not exists (
    select 1 from public.subscription_billing_events
    where id = 'a0350000-0000-0000-0000-000000000702'
      and mode = 'correction' and effective_date = current_date
      and cardinality(classifications) = 0
  ) or not exists (
    select 1 from public.tool_link_billing_components
    where tool_email_link_id = 'a0350000-0000-0000-0000-000000000302'
      and billing_type = 'Yearly' and amount = '0' and retired_at is null
      and recurrence_anchor_date = current_date
      and next_renewal_date = (current_date + interval '1 year')::date
  ) then raise exception 'Correction did not establish the corrected current setup with correction-only audit semantics.'; end if;
  if not exists (
    select 1 from public.tool_link_billing_components
    where id = 'a0350000-0000-0000-0000-000000000403' and retired_at is not null
  ) then raise exception 'Correction did not preserve the previous recurring component version.'; end if;
  if exists (
    select 1 from public.billing_renewal_periods
    where id = 'a0350000-0000-0000-0000-000000000505'
      and (excluded_at is not null or billing_date <> current_date or amount_snapshot <> 10.00
        or billing_component_id <> 'a0350000-0000-0000-0000-000000000403')
  ) then raise exception 'Correction rewrote or excluded historical renewal data.'; end if;
  if (select count(*) from public.billing_renewal_periods
      where tool_email_link_id = 'a0350000-0000-0000-0000-000000000302'
        and scheduled_renewal_date = current_date) <> 1 then
    raise exception 'Correction sync created a duplicate replacement renewal period.';
  end if;
  if exists (select 1 from public.subscription_billing_events where id = 'a0350000-0000-0000-0000-000000000703') then
    raise exception 'No-op save created an event.';
  end if;
  if not exists (
    select 1 from public.subscription_billing_events
    where id = 'a0350000-0000-0000-0000-000000000706'
      and mode = 'change' and classifications @> array['amount_recorded']
  ) or not exists (
    select 1 from public.tool_link_billing_components
    where id = 'a0350000-0000-0000-0000-000000000406'
      and billing_type = 'One-time' and amount = '0' and retired_at is null
  ) then raise exception 'Unknown-to-zero One-time change was not preserved distinctly.'; end if;
  if exists (select 1 from public.subscription_billing_events where id = 'a0350000-0000-0000-0000-000000000707')
    or not exists (
      select 1 from public.tool_link_billing_components
      where id = 'a0350000-0000-0000-0000-000000000407' and retired_at is null
    ) then raise exception 'Rejected resolved-period change left partial writes.'; end if;
  if (select md5(to_jsonb(link)::text) from public.tool_email_links as link where link.id = 'a0350000-0000-0000-0000-000000000303') <> baseline.control_relationship_fingerprint
    or (select md5(to_jsonb(component)::text) from public.tool_link_billing_components as component where component.id = 'a0350000-0000-0000-0000-000000000404') <> baseline.control_component_fingerprint then
    raise exception 'No-op or cross-account processing changed the control relationship.';
  end if;
  if (select count(*) from public.billing_transactions where id::text like 'a035%') <> 1 then
    raise exception 'Current Billing update created or deleted a Payment.';
  end if;
  if md5(concat_ws('|',
    (select md5(coalesce(string_agg(to_jsonb(link)::text, '|' order by link.id), '')) from public.tool_email_links as link where link.id::text not like 'a035%'),
    (select md5(coalesce(string_agg(to_jsonb(component)::text, '|' order by component.id), '')) from public.tool_link_billing_components as component where component.tool_email_link_id::text not like 'a035%'),
    (select md5(coalesce(string_agg(to_jsonb(period)::text, '|' order by period.id), '')) from public.billing_renewal_periods as period where period.tool_email_link_id::text not like 'a035%'),
    (select md5(coalesce(string_agg(to_jsonb(payment)::text, '|' order by payment.id), '')) from public.billing_transactions as payment where coalesce(payment.tool_email_link_id::text, '') not like 'a035%'),
    (select md5(coalesce(string_agg(to_jsonb(activity)::text, '|' order by activity.id), '')) from public.billing_renewal_activity as activity where activity.tool_email_link_id::text not like 'a035%'),
    (select md5(coalesce(string_agg(to_jsonb(event)::text, '|' order by event.id), '')) from public.subscription_lifecycle_events as event where event.tool_email_link_id::text not like 'a035%'),
    (select md5(coalesce(string_agg(to_jsonb(event)::text, '|' order by event.id), '')) from public.subscription_billing_events as event where event.tool_email_link_id::text not like 'a035%')
  )) <> baseline.non_fixture_fingerprint then
    raise exception 'Current Billing update changed non-fixture data.';
  end if;
end
$contract_assertions$;

select 'PASS: 0034 Current Billing change/correction, effective boundary, audit, idempotency, and isolation contracts verified; all disposable changes will now roll back.' as result;
rollback;
