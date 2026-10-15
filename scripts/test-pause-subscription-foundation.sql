-- Rollback-only behavioural verification for migration 0032.
-- Run manually only after 0032 has been applied. All a032 fixtures roll back.
begin;

create temporary table pause_0032_context (user_id uuid primary key) on commit drop;
create temporary table pause_0032_baseline on commit drop as
select
  (select count(*) from public.tool_email_links) as relationship_count,
  (select count(*) from public.tool_link_billing_components) as component_count,
  (select count(*) from public.billing_transactions) as payment_count,
  (select count(*) from public.billing_renewal_periods) as period_count,
  (select count(*) from public.billing_renewal_activity) as activity_count,
  (select count(*) from public.subscription_lifecycle_events) as lifecycle_count;

do $setup$
declare v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then raise exception '0032 test requires an authenticated fixture user.'; end if;
  if exists (select 1 from public.ai_tools where id::text like 'a032%')
    or exists (select 1 from public.logins where id::text like 'a032%')
    or exists (select 1 from public.tool_email_links where id::text like 'a032%')
    or exists (select 1 from public.tool_link_billing_components where id::text like 'a032%')
    or exists (select 1 from public.billing_renewal_periods where id::text like 'a032%')
    or exists (select 1 from public.billing_transactions where id::text like 'a032%')
    or exists (select 1 from public.billing_renewal_activity where id::text like 'a032%')
    or exists (select 1 from public.subscription_lifecycle_events where id::text like 'a032%') then
    raise exception 'Safety stop: disposable a032 fixture IDs already exist.';
  end if;
  insert into pause_0032_context values (v_user_id);

  insert into public.logins (id, user_id, email_address, label, colour) values
    ('a0320000-0000-0000-0000-000000000101', v_user_id, 'pause-monthly-0032@ai-subprise.invalid', 'TEST Pause Monthly 0032', '#f59e0b'),
    ('a0320000-0000-0000-0000-000000000102', v_user_id, 'pause-no-component-0032@ai-subprise.invalid', 'TEST Pause No Component 0032', '#10b981'),
    ('a0320000-0000-0000-0000-000000000103', v_user_id, 'pause-trial-0032@ai-subprise.invalid', 'TEST Pause Trial 0032', '#6b7280'),
    ('a0320000-0000-0000-0000-000000000104', v_user_id, 'pause-unlinked-0032@ai-subprise.invalid', 'TEST Pause Unlinked 0032', '#64748b'),
    ('a0320000-0000-0000-0000-000000000105', v_user_id, 'pause-yearly-0032@ai-subprise.invalid', 'TEST Pause Yearly 0032', '#8b5cf6');
  insert into public.ai_tools (id, user_id, name, category, status, is_favourite, is_archived, notes) values
    ('a0320000-0000-0000-0000-000000000201', v_user_id, 'TEST Pause Contract 0032', 'Other', 'Paid', false, false, 'Rollback-only 0032 fixture.');
  insert into public.tool_email_links (
    id, user_id, tool_id, email_account_id, slot_order, plan, plan_name, status,
    billing_type, amount, currency, next_charge_date, trial_resolved, unlinked_at
  ) values
    ('a0320000-0000-0000-0000-000000000301', v_user_id, 'a0320000-0000-0000-0000-000000000201', 'a0320000-0000-0000-0000-000000000101', 1, 'Paid', 'Monthly Plan', 'Active', 'Monthly', '30.84', 'SGD', date '2026-01-31', false, null),
    ('a0320000-0000-0000-0000-000000000302', v_user_id, 'a0320000-0000-0000-0000-000000000201', 'a0320000-0000-0000-0000-000000000102', 2, 'Paid', 'No Component Plan', 'Active', '', '', 'SGD', null, false, null),
    ('a0320000-0000-0000-0000-000000000303', v_user_id, 'a0320000-0000-0000-0000-000000000201', 'a0320000-0000-0000-0000-000000000103', 3, 'Trial', 'Trial Plan', 'Active', 'Monthly', '10.00', 'SGD', date '2026-04-30', false, null),
    ('a0320000-0000-0000-0000-000000000304', v_user_id, 'a0320000-0000-0000-0000-000000000201', 'a0320000-0000-0000-0000-000000000104', 4, 'Paid', 'Unlinked Plan', 'Active', 'Monthly', '5.00', 'SGD', date '2026-04-30', false, clock_timestamp()),
    ('a0320000-0000-0000-0000-000000000305', v_user_id, 'a0320000-0000-0000-0000-000000000201', 'a0320000-0000-0000-0000-000000000105', 5, 'Paid', 'Yearly Plan', 'Active', 'Yearly', '120.00', 'SGD', date '2024-02-29', false, null);
  insert into public.tool_link_billing_components (
    id, tool_email_link_id, billing_type, amount, currency, next_renewal_date,
    recurrence_anchor_date, last_top_up_date, retired_at
  ) values
    ('a0320000-0000-0000-0000-000000000401', 'a0320000-0000-0000-0000-000000000301', 'Monthly', '30.84', 'SGD', date '2026-01-31', date '2026-01-31', null, null),
    ('a0320000-0000-0000-0000-000000000402', 'a0320000-0000-0000-0000-000000000301', 'Top-up', '10.00', 'SGD', null, null, date '2026-02-01', null),
    ('a0320000-0000-0000-0000-000000000403', 'a0320000-0000-0000-0000-000000000305', 'Yearly', '120.00', 'SGD', date '2024-02-29', date '2024-02-29', null, null);
  insert into public.billing_renewal_periods (
    id, user_id, tool_email_link_id, billing_component_id, scheduled_renewal_date,
    billing_date, plan_name_snapshot, billing_type_snapshot, currency_snapshot,
    amount_snapshot, resolution, resolved_at, not_charged_reason_code
  ) values
    ('a0320000-0000-0000-0000-000000000501', v_user_id, 'a0320000-0000-0000-0000-000000000301', 'a0320000-0000-0000-0000-000000000401', date '2026-01-31', date '2026-01-31', 'Monthly Plan', 'Monthly', 'SGD', 30.84, null, null, null),
    ('a0320000-0000-0000-0000-000000000502', v_user_id, 'a0320000-0000-0000-0000-000000000301', 'a0320000-0000-0000-0000-000000000401', date '2026-02-28', date '2026-02-28', 'Monthly Plan', 'Monthly', 'SGD', 30.84, null, null, null),
    ('a0320000-0000-0000-0000-000000000504', v_user_id, 'a0320000-0000-0000-0000-000000000301', 'a0320000-0000-0000-0000-000000000401', date '2026-04-30', date '2026-05-01', 'Monthly Plan', 'Monthly', 'SGD', 30.84, null, null, null),
    ('a0320000-0000-0000-0000-000000000506', v_user_id, 'a0320000-0000-0000-0000-000000000301', 'a0320000-0000-0000-0000-000000000401', date '2026-06-30', date '2026-06-30', 'Monthly Plan', 'Monthly', 'SGD', 30.84, 'not_charged', clock_timestamp(), 'free_or_waived');
end
$setup$;

grant select on pause_0032_context, pause_0032_baseline to authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from pause_0032_context), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object('sub', (select user_id::text from pause_0032_context), 'role', 'authenticated')::text, true);
set local role authenticated;

do $input_guards$
begin
  begin
    perform public.pause_subscription('a0320000-0000-0000-0000-000000000302', 'a0320000-0000-0000-0000-000000000691', date '2026-03-15', 'month_only', null, null, null, current_date);
    raise exception 'Invalid month-only Pause date unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'A month-only Pause date must use the final calendar day of the month.' then
      raise exception 'Invalid month-only guard returned an unexpected error: %', sqlerrm;
    end if;
  end;
  begin
    perform public.pause_subscription('a0320000-0000-0000-0000-000000000302', 'a0320000-0000-0000-0000-000000000692', current_date + 1, 'exact_date', null, null, null, current_date);
    raise exception 'Future Pause date unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'Pause effective date cannot be in the future.' then
      raise exception 'Future-date guard returned an unexpected error: %', sqlerrm;
    end if;
  end;
  begin
    perform public.pause_subscription('a0320000-0000-0000-0000-000000000302', 'a0320000-0000-0000-0000-000000000693', date '2026-03-31', 'month_only', null, date '2026-03-31', 'exact_date', current_date);
    raise exception 'Invalid planned resume date unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'Planned resume date must be later than the Pause effective date.' then
      raise exception 'Planned-resume guard returned an unexpected error: %', sqlerrm;
    end if;
  end;
  begin
    perform public.pause_subscription('a0320000-0000-0000-0000-000000000303', 'a0320000-0000-0000-0000-000000000694', date '2026-03-31', 'month_only', null, null, null, current_date);
    raise exception 'Unresolved Trial pause unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'Resolve the Trial before pausing this relationship.' then
      raise exception 'Unresolved-Trial guard returned an unexpected error: %', sqlerrm;
    end if;
  end;
  begin
    perform public.pause_subscription('a0320000-0000-0000-0000-000000000304', 'a0320000-0000-0000-0000-000000000695', date '2026-03-31', 'month_only', null, null, null, current_date);
    raise exception 'Unlinked relationship pause unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'Historical relationships cannot be paused.' then
      raise exception 'Unlinked-relationship guard returned an unexpected error: %', sqlerrm;
    end if;
  end;
  -- Use the real fixture relationship under a different authenticated subject.
  -- This proves owner isolation instead of merely exercising a missing ID.
  perform set_config('request.jwt.claim.sub', 'b0320000-0000-0000-0000-000000000999', true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', 'b0320000-0000-0000-0000-000000000999',
    'role', 'authenticated'
  )::text, true);
  begin
    perform public.pause_subscription('a0320000-0000-0000-0000-000000000301', 'a0320000-0000-0000-0000-000000000696', date '2026-03-31', 'month_only', null, null, null, current_date);
    raise exception 'Wrong-owner pause unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'The selected relationship is no longer available.' then
      raise exception 'Wrong-owner guard returned an unexpected error: %', sqlerrm;
    end if;
  end;
  perform set_config('request.jwt.claim.sub', (select user_id::text from pause_0032_context), true);
  perform set_config('request.jwt.claims', json_build_object(
    'sub', (select user_id::text from pause_0032_context),
    'role', 'authenticated'
  )::text, true);
end
$input_guards$;

select * from public.pause_subscription(
  'a0320000-0000-0000-0000-000000000301',
  'a0320000-0000-0000-0000-000000000601',
  date '2026-03-31', 'month_only', 'Seasonal pause',
  date '2026-04-30', 'month_only', current_date
);

select * from public.pause_subscription(
  'a0320000-0000-0000-0000-000000000305',
  'a0320000-0000-0000-0000-000000000603',
  date '2026-02-28', 'exact_date', null, null, null, current_date
);

do $yearly_cadence$
declare v_dates date[];
begin
  select array_agg(period.scheduled_renewal_date order by period.scheduled_renewal_date)
  into v_dates
  from public.billing_renewal_periods as period
  where period.tool_email_link_id = 'a0320000-0000-0000-0000-000000000305';
  if v_dates is distinct from array[date '2024-02-29', date '2025-02-28', date '2026-02-28'] then
    raise exception 'Yearly leap-day cadence was not materialised safely through Pause.';
  end if;
end
$yearly_cadence$;

do $pause_contract$
declare baseline pause_0032_baseline%rowtype;
begin
  select * into baseline from pause_0032_baseline;
  if (select status from public.tool_email_links where id = 'a0320000-0000-0000-0000-000000000301') <> 'Paused'
    or (select next_charge_date from public.tool_email_links where id = 'a0320000-0000-0000-0000-000000000301') is not null then
    raise exception 'Relationship was not atomically paused and cleared.';
  end if;
  if not exists (select 1 from public.subscription_lifecycle_events where id = 'a0320000-0000-0000-0000-000000000601' and previous_lifecycle_state = 'Active' and next_lifecycle_state = 'Paused' and event_kind = 'paused' and reason = 'Seasonal pause' and planned_resume_date = date '2026-04-30' and previous_billing_component_id = 'a0320000-0000-0000-0000-000000000401' and plan_name_snapshot = 'Monthly Plan' and billing_type_snapshot = 'Monthly' and currency_snapshot = 'SGD' and amount_snapshot = 30.84) then
    raise exception 'Canonical Pause lifecycle event was not recorded with its snapshots.';
  end if;
  if not exists (select 1 from public.billing_renewal_periods where tool_email_link_id = 'a0320000-0000-0000-0000-000000000301' and scheduled_renewal_date = date '2026-03-31' and resolution is null and excluded_at is null) then
    raise exception 'Missing renewal periods were not materialised through the Pause date.';
  end if;
  if exists (select 1 from public.billing_renewal_periods where tool_email_link_id = 'a0320000-0000-0000-0000-000000000301' and scheduled_renewal_date <= date '2026-03-31' and excluded_at is not null) then
    raise exception 'A renewal period on the Pause date was not kept reviewable.';
  end if;
  if not exists (select 1 from public.billing_renewal_periods where id = 'a0320000-0000-0000-0000-000000000504' and excluded_by_lifecycle_event_id = 'a0320000-0000-0000-0000-000000000601') then
    raise exception 'Future unresolved periods were not excluded using corrected Billing Date.';
  end if;
  if not exists (select 1 from public.billing_renewal_periods where id = 'a0320000-0000-0000-0000-000000000506' and resolution = 'not_charged' and excluded_at is null) then
    raise exception 'A resolved future period was altered or excluded.';
  end if;
  if (select retired_at from public.tool_link_billing_components where id = 'a0320000-0000-0000-0000-000000000401') is null then
    raise exception 'The exact recurring component was not retired.';
  end if;
  if not exists (
    select 1 from public.tool_link_billing_components
    where id = 'a0320000-0000-0000-0000-000000000401'
      and tool_email_link_id = 'a0320000-0000-0000-0000-000000000301'
      and billing_type = 'Monthly' and amount = '30.84' and currency = 'SGD'
      and recurrence_anchor_date = date '2026-01-31'
      and next_renewal_date = date '2026-01-31'
  ) then
    raise exception 'Retiring the recurring component altered its historical billing cadence or values.';
  end if;
  if (select retired_at from public.tool_link_billing_components where id = 'a0320000-0000-0000-0000-000000000402') is not null then
    raise exception 'Non-recurring billing components were changed.';
  end if;
  if (select count(*) from public.billing_transactions) <> baseline.payment_count then
    raise exception 'Pause created or changed a Payment.';
  end if;
  if (select count(*) from public.billing_renewal_activity) <> baseline.activity_count then
    raise exception 'Pause changed renewal correction activity.';
  end if;
  if (select count(*) from public.billing_transactions) <> baseline.payment_count
    or (select count(*) from public.billing_renewal_activity) <> baseline.activity_count then
    raise exception 'Pause altered protected financial or renewal activity history.';
  end if;
end
$pause_contract$;

do $retired_sync_guard$
begin
  begin
    perform public.sync_due_billing_renewal_periods('a0320000-0000-0000-0000-000000000301', 'a0320000-0000-0000-0000-000000000401', current_date);
    raise exception 'Paused retired component renewal sync unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'This active current recurring relationship is no longer available.' then
      raise exception 'Retired-component sync guard returned an unexpected error: %', sqlerrm;
    end if;
  end;
end
$retired_sync_guard$;

do $idempotency$
declare v_events bigint; v_periods bigint; v_exclusions bigint; v_retry boolean;
begin
  select count(*) into v_events from public.subscription_lifecycle_events where id = 'a0320000-0000-0000-0000-000000000601';
  select count(*) into v_periods from public.billing_renewal_periods where tool_email_link_id = 'a0320000-0000-0000-0000-000000000301';
  select count(*) into v_exclusions from public.billing_renewal_periods where excluded_by_lifecycle_event_id = 'a0320000-0000-0000-0000-000000000601';
  select result.was_already_applied into v_retry
  from public.pause_subscription('a0320000-0000-0000-0000-000000000301', 'a0320000-0000-0000-0000-000000000601', date '2026-03-31', 'month_only', 'Seasonal pause', date '2026-04-30', 'month_only', current_date) as result;
  if not coalesce(v_retry, false) then
    raise exception 'Idempotent retry was not reported as already applied.';
  end if;
  if (select count(*) from public.subscription_lifecycle_events where id = 'a0320000-0000-0000-0000-000000000601') <> v_events
    or (select count(*) from public.billing_renewal_periods where tool_email_link_id = 'a0320000-0000-0000-0000-000000000301') <> v_periods
    or (select count(*) from public.billing_renewal_periods where excluded_by_lifecycle_event_id = 'a0320000-0000-0000-0000-000000000601') <> v_exclusions then
    raise exception 'Idempotent retry duplicated the Pause operation.';
  end if;
  begin
    perform public.pause_subscription(
      'a0320000-0000-0000-0000-000000000301',
      'a0320000-0000-0000-0000-000000000601',
      date '2026-03-31', 'month_only', 'Different retry payload',
      date '2026-04-30', 'month_only', current_date
    );
    raise exception 'Conflicting idempotency payload unexpectedly succeeded.';
  exception when others then
    if sqlerrm <> 'This Pause request ID is already in use.' then
      raise exception 'Conflicting-idempotency guard returned an unexpected error: %', sqlerrm;
    end if;
  end;
end
$idempotency$;

select * from public.pause_subscription(
  'a0320000-0000-0000-0000-000000000302',
  'a0320000-0000-0000-0000-000000000602',
  date '2024-02-29', 'month_only', null, null, null, current_date
);

do $no_component$
begin
  if (select status from public.tool_email_links where id = 'a0320000-0000-0000-0000-000000000302') <> 'Paused'
    or not exists (select 1 from public.subscription_lifecycle_events where id = 'a0320000-0000-0000-0000-000000000602' and previous_billing_component_id is null) then
    raise exception 'Active paid relationship without recurring billing could not be paused safely.';
  end if;
end
$no_component$;

select
  'PASS: 0032 atomic Pause Subscription, cadence materialisation, exclusion, retirement, idempotency, and isolation contracts verified; all disposable changes will now roll back.' as result,
  (select count(*) from public.tool_email_links where id::text like 'a032%') as fixture_relationships,
  (select count(*) from public.subscription_lifecycle_events where id::text like 'a032%') as fixture_lifecycle_events;

rollback;
