-- Database-level behavioural verification for migration 0029.
-- Run manually in Supabase SQL Editor only after migration 0029, the legacy
-- billing-date backfill, and repair-0029-billing-date-contracts.sql.
-- All retained-fixture sync changes and all disposable fixtures are rolled back.

begin;

create temporary table renewal_0029_context (
  user_id uuid not null,
  lifecycle_hash text not null
) on commit drop;

do $setup$
declare
  v_user_id uuid;
  v_dates date[];
begin
  if has_function_privilege(
      'authenticated', 'public.billing_renewal_date_from_anchor(date,text,integer)', 'EXECUTE'
    ) or has_function_privilege(
      'authenticated', 'public.billing_renewal_sequence_index(date,text,date)', 'EXECUTE'
    ) or has_function_privilege(
      'authenticated', 'public.billing_renewal_next_on_or_after(date,text,date)', 'EXECUTE'
    ) then
    raise exception 'Safety stop: an internal renewal cadence helper is unexpectedly client-executable.';
  end if;
  if not has_function_privilege(
      'authenticated', 'public.sync_due_billing_renewal_periods(uuid,uuid,date)', 'EXECUTE'
    ) or not has_function_privilege(
      'authenticated', 'public.confirm_billing_renewal_paid(uuid,uuid)', 'EXECUTE'
    ) or not has_function_privilege(
      'authenticated', 'public.mark_billing_renewal_not_charged(uuid,uuid,text,text,text)', 'EXECUTE'
    ) or not has_function_privilege(
      'authenticated', 'public.undo_billing_renewal_resolution(uuid,uuid)', 'EXECUTE'
    ) or not has_function_privilege(
      'authenticated', 'public.update_billing_renewal_period_snapshot(uuid,uuid,text,text,numeric,date,text,date)', 'EXECUTE'
    ) or not has_function_privilege(
      'authenticated', 'public.update_billing_renewal_payment(uuid,uuid,uuid,date,text,numeric,date)', 'EXECUTE'
    ) then
    raise exception 'Safety stop: an authenticated renewal RPC is not executable.';
  end if;

  if (select count(*) from public.tool_email_links) <> 51
    or (select count(*) from public.tool_link_billing_components) <> 7
    or (select count(*) from public.billing_transactions) <> 15
    or (select count(*) from public.billing_renewal_periods) <> 8 then
    raise exception 'Safety stop: database baseline is not 51 relationships / 7 components / 15 Payments / 8 renewal periods.';
  end if;

  select link.user_id into v_user_id
  from public.tool_email_links as link
  where link.id = 'a0270000-0000-0000-0000-000000000301'::uuid;
  if v_user_id is null then raise exception 'Safety stop: retained TEST relationship is missing.'; end if;

  select array_agg(period.scheduled_renewal_date order by period.scheduled_renewal_date)
  into v_dates
  from public.billing_renewal_periods as period
  where period.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
    and period.resolution is null;
  if v_dates is distinct from array[
    date '2026-01-31', date '2026-02-28', date '2026-03-31', date '2026-04-30',
    date '2026-05-31', date '2026-06-30', date '2026-07-31', date '2026-08-31'
  ] then raise exception 'Safety stop: retained unresolved periods are not the expected Jan-Aug dates.'; end if;
  if exists (
    select 1 from public.billing_renewal_periods as period
    where period.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
      and (period.billing_date is distinct from period.scheduled_renewal_date or period.resolution is not null)
  ) then raise exception 'Safety stop: retained Billing Dates or resolutions changed.'; end if;
  if not exists (
    select 1 from public.tool_link_billing_components as component
    where component.id = 'a0270000-0000-0000-0000-000000000401'::uuid
      and component.billing_type = 'Monthly' and component.currency = 'SGD'
      and component.amount::numeric = 30.84 and component.recurrence_anchor_date = date '2026-01-31'
      and component.next_renewal_date = date '2026-01-31'
  ) then raise exception 'Safety stop: retained Current Billing changed.'; end if;
  if exists (
    select 1 from public.billing_transactions as payment
    where payment.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid and payment.source = 'renewal'
  ) or exists (
    select 1 from public.billing_renewal_activity as activity
    where activity.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
  ) then raise exception 'Safety stop: retained fixture has renewal Payments or activity.'; end if;
  if exists (select 1 from public.logins where id in (
    'a0290000-0000-0000-0000-000000000101'::uuid,
    'a0290000-0000-0000-0000-000000000102'::uuid
  ) or email_address in (
    'test-renewal-monthly-0029@ai-subprise.invalid',
    'test-renewal-leap-0029@ai-subprise.invalid'
  )) or exists (select 1 from public.ai_tools where id in (
    'a0290000-0000-0000-0000-000000000201'::uuid,
    'a0290000-0000-0000-0000-000000000202'::uuid
  ) or lower(trim(name)) in (
    'test - renewal monthly contract 0029',
    'test - renewal leap contract 0029'
  )) or exists (select 1 from public.tool_email_links where id in (
    'a0290000-0000-0000-0000-000000000301'::uuid,
    'a0290000-0000-0000-0000-000000000302'::uuid
  )) or exists (select 1 from public.tool_link_billing_components where id in (
    'a0290000-0000-0000-0000-000000000401'::uuid,
    'a0290000-0000-0000-0000-000000000402'::uuid
  )) or exists (
    select 1 from public.billing_renewal_periods where id::text like 'a029%'
  ) or exists (
    select 1 from public.billing_transactions
    where tool_email_link_id in (
      'a0290000-0000-0000-0000-000000000301'::uuid,
      'a0290000-0000-0000-0000-000000000302'::uuid
    ) or source_key like '%a0290000-0000-0000-0000-%'
  ) or exists (
    select 1 from public.billing_renewal_activity
    where tool_email_link_id in (
      'a0290000-0000-0000-0000-000000000301'::uuid,
      'a0290000-0000-0000-0000-000000000302'::uuid
    ) or billing_renewal_period_id::text like 'a029%'
  ) then raise exception 'Safety stop: disposable a029 fixture IDs already exist.'; end if;

  insert into renewal_0029_context values (
    v_user_id,
    md5(coalesce((select link.billing_history_entries::text from public.tool_email_links as link
      where link.id = 'a0270000-0000-0000-0000-000000000301'::uuid), ''))
  );

  insert into public.logins (id, user_id, email_address, label, colour) values
    ('a0290000-0000-0000-0000-000000000101', v_user_id,
     'test-renewal-monthly-0029@ai-subprise.invalid', 'TEST - Renewal Monthly 0029', '#f59e0b'),
    ('a0290000-0000-0000-0000-000000000102', v_user_id,
     'test-renewal-leap-0029@ai-subprise.invalid', 'TEST - Renewal Leap 0029', '#10b981');
  insert into public.ai_tools (id, user_id, name, category, status, is_favourite, is_archived, notes) values
    ('a0290000-0000-0000-0000-000000000201', v_user_id,
     'TEST - Renewal Monthly Contract 0029', 'Other', 'Paid', false, false,
     'Transaction-scoped Checkpoint 3D monthly verification fixture.'),
    ('a0290000-0000-0000-0000-000000000202', v_user_id,
     'TEST - Renewal Leap Contract 0029', 'Other', 'Paid', false, false,
     'Transaction-scoped Checkpoint 3D leap-year verification fixture.');
  insert into public.tool_email_links (
    id, user_id, tool_id, email_account_id, slot_order, plan, plan_name, status,
    billing_type, amount, currency, next_charge_date, unlinked_at
  ) values
    ('a0290000-0000-0000-0000-000000000301', v_user_id,
     'a0290000-0000-0000-0000-000000000201', 'a0290000-0000-0000-0000-000000000101',
     1, 'Paid', 'Monthly Contract', 'Active', 'Monthly', '30.84', 'SGD', date '2026-01-31', null),
    ('a0290000-0000-0000-0000-000000000302', v_user_id,
     'a0290000-0000-0000-0000-000000000202', 'a0290000-0000-0000-0000-000000000102',
     1, 'Paid', 'Leap Contract', 'Active', 'Yearly', '120.00', 'SGD', date '2024-02-29', null);
  insert into public.tool_link_billing_components (
    id, tool_email_link_id, billing_type, amount, currency, next_renewal_date, recurrence_anchor_date
  ) values
    ('a0290000-0000-0000-0000-000000000401', 'a0290000-0000-0000-0000-000000000301',
     'Monthly', '30.84', 'SGD', date '2026-01-31', date '2026-01-31'),
    ('a0290000-0000-0000-0000-000000000402', 'a0290000-0000-0000-0000-000000000302',
     'Yearly', '120.00', 'SGD', date '2024-02-29', date '2024-02-29');
  insert into public.billing_renewal_periods (
    id, user_id, tool_email_link_id, billing_component_id, scheduled_renewal_date,
    billing_date, plan_name_snapshot, billing_type_snapshot, currency_snapshot, amount_snapshot
  )
  select
    ('a0290000-0000-0000-0000-' || lpad(month_number::text, 12, '0'))::uuid,
    v_user_id, 'a0290000-0000-0000-0000-000000000301'::uuid,
    'a0290000-0000-0000-0000-000000000401'::uuid,
    (array[date '2026-01-31', date '2026-02-28', date '2026-03-31', date '2026-04-30',
      date '2026-05-31', date '2026-06-30', date '2026-07-31', date '2026-08-31'])[month_number],
    (array[date '2026-01-31', date '2026-02-28', date '2026-03-31', date '2026-04-30',
      date '2026-05-31', date '2026-06-30', date '2026-07-31', date '2026-08-31'])[month_number],
    'Monthly Contract', 'Monthly', 'SGD', 30.84
  from generate_series(1, 8) as month_number;
end
$setup$;

grant select on renewal_0029_context to authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from renewal_0029_context), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object(
  'sub', (select user_id::text from renewal_0029_context), 'role', 'authenticated')::text, true);
set local role authenticated;

-- Retained sync: old overdue periods remain unresolved, while the operational
-- future Next renewal moves to the first cadence date on/after 30 Sep 2026.
do $retained_sync$
declare v_inserted integer;
begin
  select public.sync_due_billing_renewal_periods(
    'a0270000-0000-0000-0000-000000000301',
    'a0270000-0000-0000-0000-000000000401', date '2026-09-30'
  ) into v_inserted;
  if v_inserted <> 0 then raise exception 'Retained sync unexpectedly created % periods.', v_inserted; end if;
  if not exists (
    select 1 from public.tool_link_billing_components
    where id = 'a0270000-0000-0000-0000-000000000401'::uuid
      and next_renewal_date = date '2026-09-30'
  ) or not exists (
    select 1 from public.tool_email_links
    where id = 'a0270000-0000-0000-0000-000000000301'::uuid
      and next_charge_date = date '2026-09-30'
  ) then raise exception 'Retained sync did not move the future Next renewal to 30 Sep 2026.'; end if;
  if (select count(*) from public.billing_renewal_periods
      where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
        and resolution is null) <> 8
    or exists (
      select 1 from public.billing_renewal_periods
      where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
        and scheduled_renewal_date = date '2026-09-30'
    ) then raise exception 'Retained sync changed Jan-Aug or created September before it became overdue.'; end if;
end
$retained_sync$;

-- Retained sync above verifies the 31-Jan monthly anchor produces the public
-- 30-Sep Next-renewal contract. Yearly sync verifies leap-day generation.
-- Internal cadence helpers are intentionally not directly client-executable.
do $cadence$
declare v_inserted integer;
begin
  select public.sync_due_billing_renewal_periods(
    'a0290000-0000-0000-0000-000000000302',
    'a0290000-0000-0000-0000-000000000402', date '2026-03-01'
  ) into v_inserted;
  if v_inserted <> 3 then raise exception 'Yearly sync expected 3 periods, created %.', v_inserted; end if;
  if (select array_agg(scheduled_renewal_date order by scheduled_renewal_date)
      from public.billing_renewal_periods
      where tool_email_link_id = 'a0290000-0000-0000-0000-000000000302'::uuid)
    is distinct from array[date '2024-02-29', date '2025-02-28', date '2026-02-28']
    or exists (
      select 1 from public.billing_renewal_periods
      where tool_email_link_id = 'a0290000-0000-0000-0000-000000000302'::uuid
        and billing_date is distinct from scheduled_renewal_date
    ) or not exists (
      select 1 from public.tool_link_billing_components
      where id = 'a0290000-0000-0000-0000-000000000402'::uuid
        and recurrence_anchor_date = date '2024-02-29'
        and next_renewal_date = date '2027-02-28'
    ) then raise exception 'Yearly sync cadence, physical Billing Date, or future Next renewal failed.'; end if;
end
$cadence$;

-- period_only changes only the exact selected snapshot and creates one
-- billing_period_corrected activity record.
select * from public.update_billing_renewal_period_snapshot(
  'a0290000-0000-0000-0000-000000000301', 'a0290000-0000-0000-0000-000000000001',
  'Corrected January', 'SGD', 30.84, date '2026-01-30', 'period_only', date '2026-09-30'
);
do $period_only$
begin
  if not exists (
    select 1 from public.billing_renewal_periods
    where id = 'a0290000-0000-0000-0000-000000000001'::uuid
      and scheduled_renewal_date = date '2026-01-31' and billing_date = date '2026-01-30'
      and plan_name_snapshot = 'Corrected January'
  ) or exists (
    select 1 from public.billing_renewal_periods
    where tool_email_link_id = 'a0290000-0000-0000-0000-000000000301'::uuid
      and id <> 'a0290000-0000-0000-0000-000000000001'::uuid
      and billing_date is distinct from scheduled_renewal_date
  ) then raise exception 'period_only changed the wrong period.'; end if;
  if not exists (
    select 1 from public.billing_renewal_activity
    where billing_renewal_period_id = 'a0290000-0000-0000-0000-000000000001'::uuid
      and kind = 'billing_period_corrected' and previous_billing_date = date '2026-01-31'
      and billing_date = date '2026-01-30'
  ) then raise exception 'period_only activity is missing or incorrect.'; end if;
end
$period_only$;

-- Confirm paid uses the corrected Billing Date. Its Account Activity claim is
-- derived from the resolved period; Undo removes that claim and exact Payment.
do $paid_and_undo$
declare v_payment_id uuid; v_retry_id uuid; v_rows integer;
begin
  select payment_transaction_id into v_payment_id from public.confirm_billing_renewal_paid(
    'a0290000-0000-0000-0000-000000000301', 'a0290000-0000-0000-0000-000000000001');
  select payment_transaction_id into v_retry_id from public.confirm_billing_renewal_paid(
    'a0290000-0000-0000-0000-000000000301', 'a0290000-0000-0000-0000-000000000001');
  if v_payment_id is null or v_retry_id is distinct from v_payment_id
    or (select count(*) from public.billing_transactions
        where source = 'renewal' and source_key = 'renewal-period:a0290000-0000-0000-0000-000000000001') <> 1
    or not exists (
      select 1 from public.billing_transactions
      where id = v_payment_id and payment_date = date '2026-01-30'
        and amount = 30.84 and currency = 'SGD' and plan_name_snapshot = 'Corrected January'
    ) or not exists (
      select 1 from public.billing_renewal_periods
      where id = 'a0290000-0000-0000-0000-000000000001'::uuid
        and resolution = 'paid' and resolved_at is not null and payment_transaction_id = v_payment_id
    ) then raise exception 'Confirm paid did not create the exact corrected-date Payment/activity claim.'; end if;
  begin
    delete from public.billing_transactions where id = v_payment_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then raise exception 'Protected renewal Payment was directly deletable.'; end if;
  exception when insufficient_privilege then null;
  end;
  if not exists (
    select 1 from public.billing_transactions
    where id = v_payment_id and payment_date = date '2026-01-30'
      and amount = 30.84 and currency = 'SGD'
  ) then raise exception 'Direct DELETE changed the protected renewal Payment.'; end if;
  begin
    update public.billing_transactions
    set payment_date = date '2026-01-29', currency = 'USD', amount = 999
    where id = v_payment_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then raise exception 'Protected renewal Payment was directly editable.'; end if;
  exception when insufficient_privilege then null;
  end;
  if not exists (
    select 1 from public.billing_transactions
    where id = v_payment_id and payment_date = date '2026-01-30'
      and amount = 30.84 and currency = 'SGD'
  ) then raise exception 'Direct UPDATE changed the protected renewal Payment.'; end if;
  begin
    perform * from public.update_billing_renewal_payment(
      'a0290000-0000-0000-0000-000000000301',
      'a0290000-0000-0000-0000-000000000001',
      'b0290000-0000-0000-0000-000000000999', date '2026-01-30', 'SGD', 30.84, date '2026-09-30');
    raise exception 'Wrong transaction ID was accepted.';
  exception when others then
    if sqlerrm = 'Wrong transaction ID was accepted.' then raise; end if;
  end;
  perform * from public.undo_billing_renewal_resolution(
    'a0290000-0000-0000-0000-000000000301', 'a0290000-0000-0000-0000-000000000001');
  if exists (select 1 from public.billing_transactions where id = v_payment_id)
    or not exists (
      select 1 from public.billing_renewal_periods
      where id = 'a0290000-0000-0000-0000-000000000001'::uuid
        and resolution is null and resolved_at is null and payment_transaction_id is null
    ) then raise exception 'Paid Undo did not remove its exact Payment/activity claim.'; end if;
end
$paid_and_undo$;

-- Not charged creates no Payment. Its derived activity claim contains the
-- reason metadata and disappears when Undo clears the resolution.
do $not_charged_and_undo$
declare v_before integer;
begin
  select count(*) into v_before from public.billing_transactions;
  perform * from public.mark_billing_renewal_not_charged(
    'a0290000-0000-0000-0000-000000000301',
    'a0290000-0000-0000-0000-000000000002',
    'payment_failed', null, 'TEST optional note');
  if (select count(*) from public.billing_transactions) <> v_before or not exists (
    select 1 from public.billing_renewal_periods
    where id = 'a0290000-0000-0000-0000-000000000002'::uuid
      and resolution = 'not_charged' and resolved_at is not null
      and not_charged_reason_code = 'payment_failed' and not_charged_note = 'TEST optional note'
      and payment_transaction_id is null
  ) then raise exception 'Not charged created a Payment or exposed incorrect activity metadata.'; end if;
  perform * from public.undo_billing_renewal_resolution(
    'a0290000-0000-0000-0000-000000000301', 'a0290000-0000-0000-0000-000000000002');
  if not exists (
    select 1 from public.billing_renewal_periods
    where id = 'a0290000-0000-0000-0000-000000000002'::uuid
      and resolution is null and resolved_at is null and not_charged_reason_code is null
      and not_charged_reason_text is null and not_charged_note is null
  ) then raise exception 'Not charged Undo left its activity claim behind.'; end if;
end
$not_charged_and_undo$;

-- A resolved future period blocks a schedule rewrite. Its exact financial
-- history is unchanged, then Undo permits the explicit future schedule edit.
do $future_guard$
declare v_payment_id uuid; v_before text; v_blocked boolean := false;
begin
  select payment_transaction_id into v_payment_id from public.confirm_billing_renewal_paid(
    'a0290000-0000-0000-0000-000000000301', 'a0290000-0000-0000-0000-000000000007');
  select md5(to_jsonb(payment)::text) into v_before from public.billing_transactions as payment where payment.id = v_payment_id;
  begin
    perform * from public.update_billing_renewal_period_snapshot(
      'a0290000-0000-0000-0000-000000000301', 'a0290000-0000-0000-0000-000000000003',
      'March schedule', 'SGD', 30.84, date '2026-03-29', 'this_and_future', date '2026-09-30');
  exception when others then
    if position('cannot rewrite an already resolved billing period' in sqlerrm) = 0 then raise; end if;
    v_blocked := true;
  end;
  if not v_blocked or (select md5(to_jsonb(payment)::text) from public.billing_transactions as payment where payment.id = v_payment_id) is distinct from v_before
  then raise exception 'Resolved financial-history guard failed.'; end if;
  perform * from public.undo_billing_renewal_resolution(
    'a0290000-0000-0000-0000-000000000301', 'a0290000-0000-0000-0000-000000000007');
end
$future_guard$;

select * from public.update_billing_renewal_period_snapshot(
  'a0290000-0000-0000-0000-000000000301', 'a0290000-0000-0000-0000-000000000003',
  'March schedule', 'SGD', 30.84, date '2026-03-29', 'this_and_future', date '2026-09-30'
);
do $future_schedule$
begin
  if (select array_agg(billing_date order by scheduled_renewal_date)
      from public.billing_renewal_periods
      where tool_email_link_id = 'a0290000-0000-0000-0000-000000000301'::uuid
        and scheduled_renewal_date >= date '2026-03-31')
    is distinct from array[
      date '2026-03-29', date '2026-04-29', date '2026-05-29',
      date '2026-06-29', date '2026-07-29', date '2026-08-29'
    ] then raise exception 'this_and_future did not apply the corrected cadence.'; end if;
  if not exists (
    select 1 from public.tool_link_billing_components
    where id = 'a0290000-0000-0000-0000-000000000401'::uuid
      and recurrence_anchor_date = date '2026-03-29' and next_renewal_date = date '2026-10-29'
  ) or not exists (
    select 1 from public.billing_renewal_activity
    where billing_renewal_period_id = 'a0290000-0000-0000-0000-000000000003'::uuid
      and kind = 'billing_schedule_changed' and previous_billing_date = date '2026-03-31'
      and billing_date = date '2026-03-29'
  ) then raise exception 'Schedule anchor/Next renewal/activity contract failed.'; end if;
  if exists (
    select 1 from public.billing_renewal_periods
    where tool_email_link_id = 'a0290000-0000-0000-0000-000000000301'::uuid
      and scheduled_renewal_date not in (
        date '2026-01-31', date '2026-02-28', date '2026-03-31', date '2026-04-30',
        date '2026-05-31', date '2026-06-30', date '2026-07-31', date '2026-08-31')
  ) then raise exception 'Schedule correction rewrote immutable scheduled dates.'; end if;
end
$future_schedule$;

-- Exact relationship/period/component/owner isolation and protected direct
-- period mutation remain enforced.
do $isolation$
declare v_original_sub text := current_setting('request.jwt.claim.sub'); v_rejected boolean; v_rows integer;
begin
  begin
    update public.billing_renewal_periods set amount_snapshot = 999
    where id = 'a0290000-0000-0000-0000-000000000004'::uuid;
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then raise exception 'Direct renewal-period mutation was allowed.'; end if;
  exception when insufficient_privilege then null;
  end;
  if not exists (
    select 1 from public.billing_renewal_periods
    where id = 'a0290000-0000-0000-0000-000000000004'::uuid
      and amount_snapshot = 30.84
  ) then raise exception 'Direct UPDATE changed the protected renewal period.'; end if;
  v_rejected := false;
  begin
    perform * from public.confirm_billing_renewal_paid(
      'a0290000-0000-0000-0000-000000000302', 'a0290000-0000-0000-0000-000000000004');
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Wrong relationship/period pairing was accepted.'; end if;
  v_rejected := false;
  begin
    perform public.sync_due_billing_renewal_periods(
      'a0290000-0000-0000-0000-000000000301', 'a0290000-0000-0000-0000-000000000402', date '2026-09-30');
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Wrong relationship/component pairing was accepted.'; end if;
  perform set_config('request.jwt.claim.sub', 'b0290000-0000-0000-0000-000000000999', true);
  perform set_config('request.jwt.claims', json_build_object('sub','b0290000-0000-0000-0000-000000000999','role','authenticated')::text, true);
  v_rejected := false;
  begin
    perform public.sync_due_billing_renewal_periods(
      'a0290000-0000-0000-0000-000000000301', 'a0290000-0000-0000-0000-000000000401', date '2026-09-30');
  exception when others then v_rejected := true;
  end;
  perform set_config('request.jwt.claim.sub', v_original_sub, true);
  perform set_config('request.jwt.claims', json_build_object('sub',v_original_sub,'role','authenticated')::text, true);
  if not v_rejected then raise exception 'Wrong owner was accepted.'; end if;
end
$isolation$;

reset role;

-- Renewal/schedule operations never infer cancellation or restart. Those are
-- explicit application lifecycle events, and 0029 RPCs do not write lifecycle JSON.
do $lifecycle_and_retained$
declare v_hash text;
begin
  select md5(coalesce(link.billing_history_entries::text, '')) into v_hash
  from public.tool_email_links as link
  where link.id = 'a0270000-0000-0000-0000-000000000301'::uuid;
  if v_hash is distinct from (select lifecycle_hash from renewal_0029_context)
    or exists (
      select 1 from pg_proc as proc
      join pg_namespace as namespace on namespace.oid = proc.pronamespace
      where namespace.nspname = 'public'
        and proc.proname in ('sync_due_billing_renewal_periods','update_billing_renewal_period_snapshot')
        and lower(pg_get_functiondef(proc.oid)) like '%billing_history_entries%'
    ) then raise exception 'A date operation inferred or wrote lifecycle history.'; end if;
  if (select count(*) from public.billing_renewal_periods
      where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
        and resolution is null) <> 8
    or exists (
      select 1 from public.billing_renewal_periods
      where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
        and scheduled_renewal_date = date '2026-09-30'
    )
    or exists (
      select 1 from public.billing_transactions
      where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid and source = 'renewal'
    ) then raise exception 'Retained fixture changed beyond the transaction-scoped Next renewal sync.'; end if;
end
$lifecycle_and_retained$;

select 'PASS: 0029 renewal schedule, Billing Date, activity, Undo, cadence, and isolation contracts verified; retained sync and all disposable changes will now roll back.' as result;

rollback;
