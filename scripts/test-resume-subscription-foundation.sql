-- Rollback-only behavioural verification for migration 0033.
-- Run manually only after 0033 has been applied. All a033 fixtures roll back.
begin;

create temporary table resume_0033_context (user_id uuid primary key) on commit drop;

do $setup$
declare v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then raise exception '0033 test requires an authenticated fixture user.'; end if;
  if exists (select 1 from public.ai_tools where id::text like 'a033%')
    or exists (select 1 from public.logins where id::text like 'a033%')
    or exists (select 1 from public.tool_email_links where id::text like 'a033%')
    or exists (select 1 from public.tool_link_billing_components where id::text like 'a033%')
    or exists (select 1 from public.billing_renewal_periods where id::text like 'a033%')
    or exists (select 1 from public.billing_transactions where id::text like 'a033%')
    or exists (select 1 from public.subscription_lifecycle_events where id::text like 'a033%') then
    raise exception 'Safety stop: disposable a033 fixture IDs already exist.';
  end if;
  insert into resume_0033_context values (v_user_id);

  insert into public.logins (id, user_id, email_address, label, colour) values
    ('a0330000-0000-0000-0000-000000000101', v_user_id, 'resume-known-0033@ai-subprise.invalid', 'TEST Resume Known 0033', '#f59e0b'),
    ('a0330000-0000-0000-0000-000000000102', v_user_id, 'resume-unknown-0033@ai-subprise.invalid', 'TEST Resume Unknown 0033', '#10b981'),
    ('a0330000-0000-0000-0000-000000000103', v_user_id, 'resume-payg-0033@ai-subprise.invalid', 'TEST Resume Pay Per Use 0033', '#64748b');
  insert into public.ai_tools (id, user_id, name, category, status, is_favourite, is_archived, notes) values
    ('a0330000-0000-0000-0000-000000000201', v_user_id, 'TEST Resume Contract 0033', 'Other', 'Paid', false, false, 'Rollback-only 0033 fixture.');
  insert into public.tool_email_links (
    id, user_id, tool_id, email_account_id, slot_order, plan, plan_name, status,
    billing_type, amount, currency, next_charge_date, trial_resolved, unlinked_at
  ) values
    ('a0330000-0000-0000-0000-000000000301', v_user_id, 'a0330000-0000-0000-0000-000000000201', 'a0330000-0000-0000-0000-000000000101', 1, 'Paid', 'Pro Plan', 'Paused', 'Monthly', '30.84', 'SGD', null, false, null),
    ('a0330000-0000-0000-0000-000000000302', v_user_id, 'a0330000-0000-0000-0000-000000000201', 'a0330000-0000-0000-0000-000000000102', 2, 'Paid', 'Annual Plan', 'Paused', 'Yearly', '120.00', 'SGD', null, false, null),
    ('a0330000-0000-0000-0000-000000000303', v_user_id, 'a0330000-0000-0000-0000-000000000201', 'a0330000-0000-0000-0000-000000000103', 3, 'Paid', 'Pay as you go', 'Paused', '', '', 'SGD', null, false, null);
  insert into public.tool_link_billing_components (
    id, tool_email_link_id, billing_type, amount, currency, next_renewal_date,
    recurrence_anchor_date, retired_at
  ) values
    ('a0330000-0000-0000-0000-000000000401', 'a0330000-0000-0000-0000-000000000301', 'Monthly', '30.84', 'SGD', current_date + 10, current_date + 10, clock_timestamp()),
    ('a0330000-0000-0000-0000-000000000402', 'a0330000-0000-0000-0000-000000000302', 'Yearly', '120.00', 'SGD', current_date + 100, current_date + 100, clock_timestamp());
  insert into public.subscription_lifecycle_events (
    id, user_id, tool_email_link_id, previous_lifecycle_state, next_lifecycle_state,
    event_kind, effective_date, effective_date_precision, planned_resume_date,
    planned_resume_precision, previous_billing_component_id, plan_name_snapshot,
    previous_plan_name, billing_type_snapshot, currency_snapshot, amount_snapshot
  ) values
    ('a0330000-0000-0000-0000-000000000501', v_user_id, 'a0330000-0000-0000-0000-000000000301', 'Active', 'Paused', 'paused', current_date - 5, 'exact_date', current_date + 20, 'exact_date', 'a0330000-0000-0000-0000-000000000401', 'Pro Plan', 'Pro Plan', 'Monthly', 'SGD', 30.84),
    ('a0330000-0000-0000-0000-000000000502', v_user_id, 'a0330000-0000-0000-0000-000000000302', 'Active', 'Paused', 'paused', current_date - 10, 'exact_date', null, null, 'a0330000-0000-0000-0000-000000000402', 'Annual Plan', 'Annual Plan', 'Yearly', 'SGD', 120.00),
    ('a0330000-0000-0000-0000-000000000503', v_user_id, 'a0330000-0000-0000-0000-000000000303', 'Active', 'Paused', 'paused', current_date - 2, 'exact_date', null, null, null, 'Pay as you go', 'Pay as you go', null, 'SGD', null);
  insert into public.billing_renewal_periods (
    id, user_id, tool_email_link_id, billing_component_id, scheduled_renewal_date,
    billing_date, plan_name_snapshot, billing_type_snapshot, currency_snapshot,
    amount_snapshot, excluded_at, excluded_by_lifecycle_event_id
  ) values (
    'a0330000-0000-0000-0000-000000000601', v_user_id,
    'a0330000-0000-0000-0000-000000000301', 'a0330000-0000-0000-0000-000000000401',
    current_date + 10, current_date + 10, 'Pro Plan', 'Monthly', 'SGD', 30.84,
    clock_timestamp(), 'a0330000-0000-0000-0000-000000000501'
  );
  insert into public.billing_transactions (
    id, user_id, tool_email_link_id, tool_id, login_id, payment_date,
    tool_name_snapshot, account_label_snapshot, account_login_snapshot,
    plan_name_snapshot, billing_type_snapshot, amount, currency, status,
    note, source, source_key
  ) values (
    'a0330000-0000-0000-0000-000000000701', v_user_id,
    'a0330000-0000-0000-0000-000000000301', 'a0330000-0000-0000-0000-000000000201',
    'a0330000-0000-0000-0000-000000000101', current_date - 40,
    'TEST Resume Contract 0033', 'TEST Resume Known 0033', 'resume-known-0033@ai-subprise.invalid',
    'Pro Plan', 'Monthly', 30.84, 'SGD', 'Paid', 'Protected payment.', 'manual', 'a033-protected-payment'
  );
end
$setup$;

create temporary table resume_0033_baseline on commit drop as
select
  (select count(*) from public.billing_transactions) as payment_count,
  (select count(*) from public.billing_renewal_periods) as period_count,
  (select count(*) from public.billing_renewal_activity) as activity_count,
  (select count(*) from public.subscription_lifecycle_events) as lifecycle_count,
  (select count(*) from public.tool_link_billing_components) as component_count;

grant select on resume_0033_context, resume_0033_baseline to authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from resume_0033_context), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object('sub', (select user_id::text from resume_0033_context), 'role', 'authenticated')::text, true);
set local role authenticated;

select * from public.resume_subscription(
  'a0330000-0000-0000-0000-000000000301',
  'a0330000-0000-0000-0000-000000000801',
  'a0330000-0000-0000-0000-000000000501',
  'Yearly', 'usd', ' 45.50 ', current_date + 365, false, current_date
);

select * from public.resume_subscription(
  'a0330000-0000-0000-0000-000000000302',
  'a0330000-0000-0000-0000-000000000802',
  'a0330000-0000-0000-0000-000000000502',
  'Monthly', 'SGD', null, null, true, current_date
);

do $resume_contract$
declare baseline resume_0033_baseline%rowtype;
begin
  select * into baseline from resume_0033_baseline;
  if not exists (
    select 1 from public.tool_email_links
    where id = 'a0330000-0000-0000-0000-000000000301'
      and status = 'Active' and plan_name = 'Pro Plan'
      and billing_type = 'Yearly' and amount = '45.50' and currency = 'USD'
      and next_charge_date = current_date + 365
  ) then raise exception 'Known-date Resume did not update the exact relationship.'; end if;
  if not exists (
    select 1 from public.subscription_lifecycle_events
    where id = 'a0330000-0000-0000-0000-000000000801'
      and event_kind = 'resumed' and previous_lifecycle_state = 'Paused'
      and next_lifecycle_state = 'Active' and effective_date = current_date
      and effective_date_precision = 'exact_date'
      and previous_billing_component_id = 'a0330000-0000-0000-0000-000000000401'
      and new_billing_component_id is not null and plan_name_snapshot = 'Pro Plan'
      and billing_type_snapshot = 'Yearly' and currency_snapshot = 'USD'
      and amount_snapshot = 45.50 and next_renewal_date_snapshot = current_date + 365
  ) then raise exception 'Resume lifecycle event snapshots are incomplete.'; end if;
  if not exists (
    select 1 from public.tool_link_billing_components
    where id = (select new_billing_component_id from public.subscription_lifecycle_events where id = 'a0330000-0000-0000-0000-000000000801')
      and tool_email_link_id = 'a0330000-0000-0000-0000-000000000301'
      and billing_type = 'Yearly' and amount = '45.50' and currency = 'USD'
      and next_renewal_date = current_date + 365
      and recurrence_anchor_date = current_date + 365 and retired_at is null
  ) then raise exception 'Resume did not create the expected new recurring component.'; end if;
  if not exists (
    select 1 from public.tool_link_billing_components
    where id = 'a0330000-0000-0000-0000-000000000401'
      and billing_type = 'Monthly' and amount = '30.84' and currency = 'SGD'
      and retired_at is not null
  ) or not exists (
    select 1 from public.billing_renewal_periods
    where id = 'a0330000-0000-0000-0000-000000000601'
      and excluded_by_lifecycle_event_id = 'a0330000-0000-0000-0000-000000000501'
      and excluded_at is not null and resolution is null
  ) or not exists (
    select 1 from public.subscription_lifecycle_events
    where id = 'a0330000-0000-0000-0000-000000000501'
      and event_kind = 'paused' and planned_resume_date = current_date + 20
  ) then raise exception 'Resume changed protected historical records.'; end if;
  if (select count(*) from public.billing_transactions) <> baseline.payment_count then
    raise exception 'Resume created or changed a Payment.';
  end if;
  if (select count(*) from public.billing_renewal_periods) <> baseline.period_count
    or (select count(*) from public.billing_renewal_activity) <> baseline.activity_count then
    raise exception 'Resume changed protected historical records.';
  end if;
  if not exists (
    select 1 from public.tool_link_billing_components
    where id = (select new_billing_component_id from public.subscription_lifecycle_events where id = 'a0330000-0000-0000-0000-000000000802')
      and billing_type = 'Monthly' and amount is null and currency = 'SGD'
      and next_renewal_date is null and recurrence_anchor_date is null
  ) or not exists (
    select 1 from public.tool_email_links
    where id = 'a0330000-0000-0000-0000-000000000302'
      and status = 'Active' and next_charge_date is null
  ) then raise exception 'Unknown next renewal was not preserved safely.'; end if;
end
$resume_contract$;

do $idempotency$
declare before_events bigint; before_components bigint; retried boolean;
begin
  select count(*) into before_events from public.subscription_lifecycle_events;
  select count(*) into before_components from public.tool_link_billing_components;
  select result.was_already_applied into retried
  from public.resume_subscription(
    'a0330000-0000-0000-0000-000000000301',
    'a0330000-0000-0000-0000-000000000801',
    'a0330000-0000-0000-0000-000000000501',
    'Yearly', 'USD', '45.50', current_date + 365, false, current_date
  ) as result;
  if not coalesce(retried, false)
    or (select count(*) from public.subscription_lifecycle_events) <> before_events
    or (select count(*) from public.tool_link_billing_components) <> before_components then
    raise exception 'Idempotent retry duplicated Resume.';
  end if;
  begin
    perform public.resume_subscription(
      'a0330000-0000-0000-0000-000000000301',
      'a0330000-0000-0000-0000-000000000801',
      'a0330000-0000-0000-0000-000000000501',
      'Monthly', 'USD', '45.50', current_date + 30, false, current_date
    );
    raise exception 'Conflicting idempotency payload unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'This Resume request ID is already in use.' then raise; end if;
  end;
end
$idempotency$;

do $eligibility_and_owner$
begin
  begin
    perform public.resume_subscription(
      'a0330000-0000-0000-0000-000000000303',
      'a0330000-0000-0000-0000-000000000803',
      'a0330000-0000-0000-0000-000000000503',
      'Monthly', 'SGD', null, null, true, current_date
    );
    raise exception 'Pay-per-use-style Pause unexpectedly resumed.';
  exception when others then
    if sqlerrm <> 'The current recurring Pause event is no longer available.' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', 'b0330000-0000-0000-0000-000000000999', true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', 'b0330000-0000-0000-0000-000000000999', 'role', 'authenticated'
  )::text, true);
  begin
    perform public.resume_subscription(
      'a0330000-0000-0000-0000-000000000303',
      'a0330000-0000-0000-0000-000000000804',
      'a0330000-0000-0000-0000-000000000503',
      'Monthly', 'SGD', null, null, true, current_date
    );
    raise exception 'Wrong-owner Resume unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'The selected relationship is no longer available.' then raise; end if;
  end;
end
$eligibility_and_owner$;

select
  'PASS: 0033 atomic Resume, new-component versioning, unknown date, idempotency, isolation, and history preservation verified; all disposable changes will now roll back.' as result;

rollback;
