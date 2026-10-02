-- Manual rollback-only verification for migration 0030.
-- Run only after 0030 has been applied to the target database.
begin;

create temporary table lifecycle_0030_context (user_id uuid primary key) on commit drop;

do $setup$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then raise exception '0030 test requires an authenticated fixture user.'; end if;
  if exists (select 1 from public.ai_tools where id::text like 'a030%') then
    raise exception 'Safety stop: disposable a030 fixture IDs already exist.';
  end if;
  insert into lifecycle_0030_context values (v_user_id);

  insert into public.logins (id, user_id, email_address, label, colour) values
    ('a0300000-0000-0000-0000-000000000101', v_user_id, 'lifecycle-monthly-0030@ai-subprise.invalid', 'TEST Lifecycle Monthly 0030', '#f59e0b'),
    ('a0300000-0000-0000-0000-000000000102', v_user_id, 'lifecycle-yearly-0030@ai-subprise.invalid', 'TEST Lifecycle Yearly 0030', '#10b981');
  insert into public.ai_tools (id, user_id, name, category, status, is_favourite, is_archived, notes) values
    ('a0300000-0000-0000-0000-000000000201', v_user_id, 'TEST Lifecycle Monthly 0030', 'Other', 'Paid', false, false, 'Rollback-only 0030 fixture.'),
    ('a0300000-0000-0000-0000-000000000202', v_user_id, 'TEST Lifecycle Yearly 0030', 'Other', 'Paid', false, false, 'Rollback-only 0030 fixture.');
  insert into public.tool_email_links (
    id, user_id, tool_id, email_account_id, slot_order, plan, plan_name, status,
    billing_type, amount, currency, next_charge_date, unlinked_at
  ) values
    ('a0300000-0000-0000-0000-000000000301', v_user_id, 'a0300000-0000-0000-0000-000000000201',
     'a0300000-0000-0000-0000-000000000101', 1, 'Paid', 'Current Monthly', 'Active',
     'Monthly', '30.84', 'SGD', date '2024-01-31', null),
    ('a0300000-0000-0000-0000-000000000302', v_user_id, 'a0300000-0000-0000-0000-000000000202',
     'a0300000-0000-0000-0000-000000000102', 1, 'Paid', 'Current Yearly', 'Active',
     'Yearly', '120.00', 'SGD', date '2024-02-29', null);
  insert into public.tool_link_billing_components (
    id, tool_email_link_id, billing_type, amount, currency, next_renewal_date,
    recurrence_anchor_date, retired_at
  ) values
    ('a0300000-0000-0000-0000-000000000401', 'a0300000-0000-0000-0000-000000000301',
     'Monthly', '20.00', 'SGD', date '2024-04-30', date '2024-01-31', clock_timestamp()),
    ('a0300000-0000-0000-0000-000000000402', 'a0300000-0000-0000-0000-000000000301',
     'Monthly', '30.84', 'SGD', date '2024-01-31', date '2024-01-31', null),
    ('a0300000-0000-0000-0000-000000000403', 'a0300000-0000-0000-0000-000000000302',
     'Yearly', '120.00', 'SGD', date '2024-02-29', date '2024-02-29', null);

  insert into public.subscription_lifecycle_events (
    id, user_id, tool_email_link_id, previous_lifecycle_state, next_lifecycle_state,
    event_kind, effective_date, effective_date_precision, previous_billing_component_id,
    plan_name_snapshot, billing_type_snapshot, currency_snapshot, amount_snapshot
  ) values (
    'a0300000-0000-0000-0000-000000000601', v_user_id,
    'a0300000-0000-0000-0000-000000000301', 'Active', 'On a Break', 'paused',
    date '2024-02-29', 'month_only', 'a0300000-0000-0000-0000-000000000401',
    'Historical Monthly', 'Monthly', 'SGD', 20.00
  );

  insert into public.billing_renewal_periods (
    id, user_id, tool_email_link_id, billing_component_id, scheduled_renewal_date,
    billing_date, plan_name_snapshot, billing_type_snapshot, currency_snapshot,
    amount_snapshot, excluded_at, excluded_by_lifecycle_event_id
  ) values
    ('a0300000-0000-0000-0000-000000000501', v_user_id, 'a0300000-0000-0000-0000-000000000301',
     'a0300000-0000-0000-0000-000000000401', date '2024-01-31', date '2024-01-31',
     'Historical Monthly', 'Monthly', 'SGD', null, null, null),
    ('a0300000-0000-0000-0000-000000000502', v_user_id, 'a0300000-0000-0000-0000-000000000301',
     'a0300000-0000-0000-0000-000000000401', date '2024-02-29', date '2024-02-29',
     'Historical Monthly', 'Monthly', 'SGD', 0, null, null),
    ('a0300000-0000-0000-0000-000000000503', v_user_id, 'a0300000-0000-0000-0000-000000000301',
     'a0300000-0000-0000-0000-000000000401', date '2024-03-31', date '2024-03-31',
     'Historical Monthly', 'Monthly', 'SGD', 20.00, clock_timestamp(),
     'a0300000-0000-0000-0000-000000000601');
end
$setup$;

grant select on lifecycle_0030_context to authenticated;
select set_config('request.jwt.claim.sub', (select user_id::text from lifecycle_0030_context), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object(
  'sub', (select user_id::text from lifecycle_0030_context), 'role', 'authenticated')::text, true);
set local role authenticated;

do $permissions$
begin
  if has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'INSERT')
    or has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'UPDATE')
    or has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'DELETE') then
    raise exception 'Authenticated lifecycle-event mutation privilege was not revoked.';
  end if;
  if not has_table_privilege('authenticated', 'public.subscription_lifecycle_events', 'SELECT') then
    raise exception 'Authenticated lifecycle-event SELECT privilege is missing.';
  end if;
end
$permissions$;

-- Retired components cannot generate new periods.
do $retired_sync$
begin
  begin
    perform public.sync_due_billing_renewal_periods(
      'a0300000-0000-0000-0000-000000000301',
      'a0300000-0000-0000-0000-000000000401', date '2024-04-01');
    raise exception 'Retired component sync unexpectedly succeeded.';
  exception when others then
    if sqlerrm = 'Retired component sync unexpectedly succeeded.' then raise; end if;
  end;
end
$retired_sync$;

-- Every unresolved decision RPC rejects the excluded exact period.
do $excluded_guards$
begin
  begin
    perform public.confirm_billing_renewal_paid(
      'a0300000-0000-0000-0000-000000000301', 'a0300000-0000-0000-0000-000000000503');
    raise exception 'Confirm paid accepted an excluded period.';
  exception when others then
    if sqlerrm = 'Confirm paid accepted an excluded period.' then raise; end if;
  end;
  begin
    perform public.mark_billing_renewal_not_charged(
      'a0300000-0000-0000-0000-000000000301', 'a0300000-0000-0000-0000-000000000503',
      'paused', null, null);
    raise exception 'Not charged accepted an excluded period.';
  exception when others then
    if sqlerrm = 'Not charged accepted an excluded period.' then raise; end if;
  end;
  begin
    perform public.update_billing_renewal_period_snapshot(
      'a0300000-0000-0000-0000-000000000301', 'a0300000-0000-0000-0000-000000000503',
      'Excluded', 'SGD', 20.00, date '2024-03-31', 'period_only', current_date);
    raise exception 'Billing Date correction accepted an excluded period.';
  exception when others then
    if sqlerrm = 'Billing Date correction accepted an excluded period.' then raise; end if;
  end;
end
$excluded_guards$;

-- Resolving an old period creates the protected Payment with NULL amount but
-- cannot move the current component or relationship schedule.
do $historical_decision$
declare
  v_component_next date;
  v_relationship_next date;
  v_payment_id uuid;
begin
  select next_renewal_date into v_component_next from public.tool_link_billing_components
    where id = 'a0300000-0000-0000-0000-000000000402';
  select next_charge_date into v_relationship_next from public.tool_email_links
    where id = 'a0300000-0000-0000-0000-000000000301';
  select payment_transaction_id into v_payment_id
  from public.confirm_billing_renewal_paid(
    'a0300000-0000-0000-0000-000000000301', 'a0300000-0000-0000-0000-000000000501');
  if (select next_renewal_date from public.tool_link_billing_components
      where id = 'a0300000-0000-0000-0000-000000000402') is distinct from v_component_next
    or (select next_charge_date from public.tool_email_links
      where id = 'a0300000-0000-0000-0000-000000000301') is distinct from v_relationship_next then
    raise exception 'Historical decision overwrote the current cadence.';
  end if;
  if not exists (select 1 from public.billing_transactions
    where id = v_payment_id and amount is null and source = 'renewal'
      and source_key = 'renewal-period:a0300000-0000-0000-0000-000000000501') then
    raise exception 'Historical confirmation did not preserve unknown amount or exact Payment provenance.';
  end if;
end
$historical_decision$;

-- Historical this-and-future correction skips excluded rows and cannot alter
-- either the historical anchor or the current cadence.
do $historical_correction$
declare
  v_old_anchor date;
  v_current_anchor date;
  v_current_next date;
  v_link_next date;
begin
  select recurrence_anchor_date into v_old_anchor from public.tool_link_billing_components
    where id = 'a0300000-0000-0000-0000-000000000401';
  select recurrence_anchor_date, next_renewal_date into v_current_anchor, v_current_next
    from public.tool_link_billing_components where id = 'a0300000-0000-0000-0000-000000000402';
  select next_charge_date into v_link_next from public.tool_email_links
    where id = 'a0300000-0000-0000-0000-000000000301';
  perform public.update_billing_renewal_period_snapshot(
    'a0300000-0000-0000-0000-000000000301', 'a0300000-0000-0000-0000-000000000502',
    'Historical Monthly', 'SGD', 0, date '2024-02-28', 'this_and_future', current_date);
  if (select recurrence_anchor_date from public.tool_link_billing_components
      where id = 'a0300000-0000-0000-0000-000000000401') is distinct from v_old_anchor
    or (select recurrence_anchor_date from public.tool_link_billing_components
      where id = 'a0300000-0000-0000-0000-000000000402') is distinct from v_current_anchor
    or (select next_renewal_date from public.tool_link_billing_components
      where id = 'a0300000-0000-0000-0000-000000000402') is distinct from v_current_next
    or (select next_charge_date from public.tool_email_links
      where id = 'a0300000-0000-0000-0000-000000000301') is distinct from v_link_next then
    raise exception 'Historical correction rewrote a component or relationship cadence.';
  end if;
  if (select billing_date from public.billing_renewal_periods
      where id = 'a0300000-0000-0000-0000-000000000503') <> date '2024-03-31' then
    raise exception 'Historical correction changed an excluded period.';
  end if;
  if (select amount_snapshot from public.billing_renewal_periods
      where id = 'a0300000-0000-0000-0000-000000000502') <> 0 then
    raise exception 'Historical correction did not preserve explicit zero.';
  end if;
end
$historical_correction$;

-- Current components retain month-end and leap-year cadence generation.
do $current_sync$
begin
  perform public.sync_due_billing_renewal_periods(
    'a0300000-0000-0000-0000-000000000301',
    'a0300000-0000-0000-0000-000000000402', date '2024-04-01');
  if not exists (select 1 from public.billing_renewal_periods
    where billing_component_id = 'a0300000-0000-0000-0000-000000000402'
      and scheduled_renewal_date = date '2024-02-29')
    or not exists (select 1 from public.billing_renewal_periods
    where billing_component_id = 'a0300000-0000-0000-0000-000000000402'
      and scheduled_renewal_date = date '2024-03-31') then
    raise exception 'Current monthly component did not preserve month-end cadence.';
  end if;
  perform public.sync_due_billing_renewal_periods(
    'a0300000-0000-0000-0000-000000000302',
    'a0300000-0000-0000-0000-000000000403', date '2025-03-01');
  if not exists (select 1 from public.billing_renewal_periods
    where billing_component_id = 'a0300000-0000-0000-0000-000000000403'
      and scheduled_renewal_date = date '2025-02-28') then
    raise exception 'Current yearly component did not preserve leap-year cadence.';
  end if;
end
$current_sync$;

reset role;

do $constraints$
begin
  begin
    insert into public.subscription_lifecycle_events (
      user_id, tool_email_link_id, previous_lifecycle_state, next_lifecycle_state,
      event_kind, effective_date, effective_date_precision
    ) values ((select user_id from lifecycle_0030_context),
      'a0300000-0000-0000-0000-000000000301', 'Active', 'Goodbye', 'resumed',
      current_date, 'exact_date');
    raise exception 'Invalid lifecycle transition was accepted.';
  exception when check_violation then null; end;

  begin
    update public.billing_renewal_periods set excluded_at = clock_timestamp()
    where id = 'a0300000-0000-0000-0000-000000000502';
    raise exception 'Unpaired exclusion metadata was accepted.';
  exception when check_violation then null; end;

  begin
    update public.billing_renewal_periods
    set excluded_at = clock_timestamp(), excluded_by_lifecycle_event_id = 'a0300000-0000-0000-0000-000000000601'
    where id = 'a0300000-0000-0000-0000-000000000501';
    raise exception 'Resolved period exclusion was accepted.';
  exception when check_violation then null; end;

  begin
    insert into public.tool_link_billing_components (
      tool_email_link_id, billing_type, amount, currency, next_renewal_date, recurrence_anchor_date
    ) values ('a0300000-0000-0000-0000-000000000301', 'Yearly', '1', 'SGD', current_date, current_date);
    raise exception 'Second current recurring component was accepted.';
  exception when unique_violation then null; end;

  insert into public.tool_link_billing_components (
    tool_email_link_id, billing_type, amount, currency, next_renewal_date, recurrence_anchor_date, retired_at
  ) values ('a0300000-0000-0000-0000-000000000301', 'Yearly', '1', 'SGD', current_date, current_date, clock_timestamp());

  insert into public.tool_link_billing_components (
    tool_email_link_id, billing_type, amount, currency, purchase_date
  ) values ('a0300000-0000-0000-0000-000000000301', 'Lifetime', '1', 'SGD', current_date);
  begin
    insert into public.tool_link_billing_components (
      tool_email_link_id, billing_type, amount, currency, purchase_date
    ) values ('a0300000-0000-0000-0000-000000000301', 'Lifetime', '2', 'SGD', current_date);
    raise exception 'Duplicate non-recurring component was accepted.';
  exception when unique_violation then null; end;
end
$constraints$;

select
  'PASS: 0030 lifecycle foundation rollback verification' as result,
  (select count(*) from public.subscription_lifecycle_events where id::text like 'a030%') as lifecycle_events_inside_transaction,
  (select count(*) from public.billing_renewal_periods where id::text like 'a030%') as renewal_periods_inside_transaction;

rollback;
