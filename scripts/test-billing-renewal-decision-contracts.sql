-- Database-level verification for migration 0028.
-- Run manually in the Supabase SQL Editor only after 0028 has been applied.
--
-- Safety:
-- - Requires the retained TEST - Renewal Monthly fixture and never targets it.
-- - Creates only fixed a028... records inside this transaction.
-- - Verifies the retained fixture is byte-for-byte unchanged.
-- - Always rolls back, including after a successful test run.

begin;

create temporary table renewal_0028_context (
  user_id uuid not null,
  relationship_id uuid not null,
  component_id uuid not null,
  retained_hash text not null
) on commit drop;

do $setup$
declare
  v_user_id uuid;
  v_retained_hash text;
  v_retained_unresolved_dates date[];
begin
  select link.user_id
  into v_user_id
  from public.tool_email_links as link
  where link.id = 'a0270000-0000-0000-0000-000000000301'::uuid;

  if v_user_id is null then
    raise exception 'Safety stop: retained TEST - Renewal Monthly relationship was not found.';
  end if;

  select array_agg(period.scheduled_renewal_date order by period.scheduled_renewal_date)
  into v_retained_unresolved_dates
  from public.billing_renewal_periods as period
  where period.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
    and period.resolution is null;

  if v_retained_unresolved_dates is distinct from array[
    date '2026-01-31', date '2026-02-28', date '2026-03-31', date '2026-04-30',
    date '2026-05-31', date '2026-06-30', date '2026-07-31', date '2026-08-31'
  ] then
    raise exception 'Safety stop: retained TEST - Renewal Monthly must still have the eight expected unresolved periods from January through August 2026.';
  end if;

  if exists (
    select 1
    from public.billing_transactions as payment
    where payment.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
      and payment.source = 'renewal'
  ) then
    raise exception 'Safety stop: retained TEST - Renewal Monthly must still have zero renewal-generated Payments.';
  end if;

  select md5(
    coalesce((select to_jsonb(link)::text from public.tool_email_links as link where link.id = 'a0270000-0000-0000-0000-000000000301'::uuid), '')
    || coalesce((select to_jsonb(component)::text from public.tool_link_billing_components as component where component.id = 'a0270000-0000-0000-0000-000000000401'::uuid), '')
    || coalesce((
      select string_agg(to_jsonb(period)::text, '|' order by period.id::text)
      from public.billing_renewal_periods as period
      where period.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
    ), '')
    || coalesce((
      select string_agg(to_jsonb(payment)::text, '|' order by payment.id::text)
      from public.billing_transactions as payment
      where payment.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
    ), '')
  ) into v_retained_hash;

  if exists (
    select 1 from public.logins where id = 'a0280000-0000-0000-0000-000000000101'::uuid
  ) or exists (
    select 1 from public.ai_tools where id = 'a0280000-0000-0000-0000-000000000201'::uuid
  ) or exists (
    select 1 from public.tool_email_links where id = 'a0280000-0000-0000-0000-000000000301'::uuid
  ) then
    raise exception 'Safety stop: disposable 0028 verification IDs already exist.';
  end if;

  insert into renewal_0028_context values (
    v_user_id,
    'a0280000-0000-0000-0000-000000000301',
    'a0280000-0000-0000-0000-000000000401',
    v_retained_hash
  );

  insert into public.logins (id, user_id, email_address, label, colour)
  values (
    'a0280000-0000-0000-0000-000000000101',
    v_user_id,
    'test-renewal-contract@ai-subprise.invalid',
    'TEST - Renewal Contract 0028',
    '#f59e0b'
  );

  insert into public.ai_tools (
    id, user_id, name, category, status, is_favourite, is_archived, notes
  ) values (
    'a0280000-0000-0000-0000-000000000201',
    v_user_id,
    'TEST - Renewal Contract 0028',
    'Other',
    'Paid',
    false,
    false,
    'Transaction-scoped Checkpoint 3B verification fixture.'
  );

  insert into public.tool_email_links (
    id, user_id, tool_id, email_account_id, slot_order,
    plan, plan_name, status, billing_type, amount, currency,
    next_charge_date, unlinked_at
  ) values (
    'a0280000-0000-0000-0000-000000000301',
    v_user_id,
    'a0280000-0000-0000-0000-000000000201',
    'a0280000-0000-0000-0000-000000000101',
    1,
    'Paid',
    'TEST Contract Plan',
    'Active',
    'Monthly',
    '45.00',
    'SGD',
    date '2026-01-06',
    null
  );

  insert into public.tool_link_billing_components (
    id, tool_email_link_id, billing_type, amount, currency,
    next_renewal_date, recurrence_anchor_date
  ) values (
    'a0280000-0000-0000-0000-000000000401',
    'a0280000-0000-0000-0000-000000000301',
    'Monthly',
    '45.00',
    'SGD',
    date '2026-01-06',
    date '2026-01-06'
  );

  insert into public.billing_renewal_periods (
    id, user_id, tool_email_link_id, billing_component_id,
    scheduled_renewal_date, plan_name_snapshot, billing_type_snapshot,
    currency_snapshot, amount_snapshot
  )
  select
    ('a0280000-0000-0000-0000-' || lpad(month_number::text, 12, '0'))::uuid,
    v_user_id,
    'a0280000-0000-0000-0000-000000000301'::uuid,
    'a0280000-0000-0000-0000-000000000401'::uuid,
    make_date(2026, month_number, 6),
    'Snapshot ' || month_number,
    'Monthly',
    'SGD',
    case when month_number = 1 then null else month_number * 10 end
  from generate_series(1, 8) as month_number;
end
$setup$;

grant select on renewal_0028_context to authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from renewal_0028_context),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id::text from renewal_0028_context),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

-- Unresolved snapshot edits are exact and cannot address Billing Type or the
-- scheduled date because neither is part of the RPC signature.
select *
from public.update_billing_renewal_period_snapshot(
  'a0280000-0000-0000-0000-000000000301',
  'a0280000-0000-0000-0000-000000000001',
  'Edited January snapshot',
  'usd',
  null
);

do $assert_snapshot$
begin
  if not exists (
    select 1
    from public.billing_renewal_periods
    where id = 'a0280000-0000-0000-0000-000000000001'::uuid
      and plan_name_snapshot = 'Edited January snapshot'
      and currency_snapshot = 'USD'
      and amount_snapshot is null
      and billing_type_snapshot = 'Monthly'
      and scheduled_renewal_date = date '2026-01-06'
  ) then
    raise exception 'Snapshot edit did not preserve null Amount, Billing Type, or Scheduled Renewal Date.';
  end if;
  if not exists (
    select 1
    from public.billing_renewal_periods
    where id = 'a0280000-0000-0000-0000-000000000002'::uuid
      and plan_name_snapshot = 'Snapshot 2'
      and currency_snapshot = 'SGD'
      and amount_snapshot = 20
  ) then
    raise exception 'Snapshot edit changed another renewal period.';
  end if;
end
$assert_snapshot$;

-- Every predefined reason is accepted, optional notes are preserved, and Undo
-- clears all decision metadata before the next iteration.
do $reason_codes$
declare
  v_reason text;
  v_note text;
begin
  foreach v_reason in array array[
    'cancelled_subscription', 'payment_failed', 'paused', 'free_or_waived'
  ] loop
    v_note := case when v_reason = 'payment_failed' then 'Optional retry note' else null end;
    perform * from public.mark_billing_renewal_not_charged(
      'a0280000-0000-0000-0000-000000000301',
      'a0280000-0000-0000-0000-000000000003',
      v_reason,
      null,
      v_note
    );
    if not exists (
      select 1 from public.billing_renewal_periods
      where id = 'a0280000-0000-0000-0000-000000000003'::uuid
        and resolution = 'not_charged'
        and not_charged_reason_code = v_reason
        and not_charged_reason_text is null
        and not_charged_note is not distinct from v_note
        and payment_transaction_id is null
    ) then
      raise exception 'Not charged reason % was not stored exactly.', v_reason;
    end if;
    perform * from public.undo_billing_renewal_resolution(
      'a0280000-0000-0000-0000-000000000301',
      'a0280000-0000-0000-0000-000000000003'
    );
    if not exists (
      select 1 from public.billing_renewal_periods
      where id = 'a0280000-0000-0000-0000-000000000003'::uuid
        and resolution is null
        and not_charged_reason_code is null
        and not_charged_reason_text is null
        and not_charged_note is null
    ) then
      raise exception 'Undo did not clear Not charged metadata for %.', v_reason;
    end if;
  end loop;
end
$reason_codes$;

do $other_reason$
begin
  begin
    perform * from public.mark_billing_renewal_not_charged(
      'a0280000-0000-0000-0000-000000000301',
      'a0280000-0000-0000-0000-000000000003',
      'other',
      '   ',
      null
    );
    raise exception 'Other unexpectedly accepted a blank custom reason.';
  exception
    when others then
      if sqlerrm = 'Other unexpectedly accepted a blank custom reason.' then raise; end if;
      if position('Enter a reason when Other is selected.' in sqlerrm) = 0 then raise; end if;
  end;

  perform * from public.mark_billing_renewal_not_charged(
    'a0280000-0000-0000-0000-000000000301',
    'a0280000-0000-0000-0000-000000000003',
    'other',
    'Invoice intentionally waived',
    'Approved by support'
  );
  if not exists (
    select 1 from public.billing_renewal_periods
    where id = 'a0280000-0000-0000-0000-000000000003'::uuid
      and resolution = 'not_charged'
      and not_charged_reason_code = 'other'
      and not_charged_reason_text = 'Invoice intentionally waived'
      and not_charged_note = 'Approved by support'
  ) then
    raise exception 'Other reason text or optional note was not stored.';
  end if;
  perform * from public.undo_billing_renewal_resolution(
    'a0280000-0000-0000-0000-000000000301',
    'a0280000-0000-0000-0000-000000000003'
  );
end
$other_reason$;

-- Resolve August first. Next renewal must stay on January, the oldest
-- unresolved period, and the Payment Date must start at the scheduled date.
select *
from public.confirm_billing_renewal_paid(
  'a0280000-0000-0000-0000-000000000301',
  'a0280000-0000-0000-0000-000000000008'
);

do $assert_august_paid$
begin
  if not exists (
    select 1
    from public.billing_renewal_periods as period
    join public.billing_transactions as payment on payment.id = period.payment_transaction_id
    where period.id = 'a0280000-0000-0000-0000-000000000008'::uuid
      and period.actual_payment_date = period.scheduled_renewal_date
      and payment.payment_date = period.scheduled_renewal_date
      and payment.amount = period.amount_snapshot
      and payment.currency = period.currency_snapshot
      and payment.source = 'renewal'
      and payment.source_key = 'renewal-period:' || period.id::text
  ) then
    raise exception 'Confirm paid did not use the exact period snapshots and scheduled Payment Date.';
  end if;
  if (
    select next_renewal_date from public.tool_link_billing_components
    where id = 'a0280000-0000-0000-0000-000000000401'::uuid
  ) <> date '2026-01-06' then
    raise exception 'Out-of-order resolution skipped the earliest unresolved period.';
  end if;
end
$assert_august_paid$;

-- January has a null snapshot Amount; confirmation must preserve null.
select *
from public.confirm_billing_renewal_paid(
  'a0280000-0000-0000-0000-000000000301',
  'a0280000-0000-0000-0000-000000000001'
);

do $assert_null_amount$
begin
  if not exists (
    select 1
    from public.billing_renewal_periods as period
    join public.billing_transactions as payment on payment.id = period.payment_transaction_id
    where period.id = 'a0280000-0000-0000-0000-000000000001'::uuid
      and period.amount_snapshot is null
      and payment.amount is null
      and payment.payment_date = date '2026-01-06'
  ) then
    raise exception 'Confirm paid substituted a value for an unknown Amount.';
  end if;
  if (
    select next_renewal_date from public.tool_link_billing_components
    where id = 'a0280000-0000-0000-0000-000000000401'::uuid
  ) <> date '2026-02-06' then
    raise exception 'Next renewal did not advance to the earliest remaining unresolved period.';
  end if;
end
$assert_null_amount$;

-- Correct only August's generated Payment and matching period snapshot.
do $correct_payment$
declare
  v_august_payment_id uuid;
  v_january_payment_before jsonb;
begin
  select payment_transaction_id into v_august_payment_id
  from public.billing_renewal_periods
  where id = 'a0280000-0000-0000-0000-000000000008'::uuid;
  select to_jsonb(payment) into v_january_payment_before
  from public.billing_transactions as payment
  join public.billing_renewal_periods as period on period.payment_transaction_id = payment.id
  where period.id = 'a0280000-0000-0000-0000-000000000001'::uuid;

  perform * from public.update_billing_renewal_payment(
    'a0280000-0000-0000-0000-000000000301',
    'a0280000-0000-0000-0000-000000000008',
    v_august_payment_id,
    date '2026-08-08',
    'usd',
    null,
    date '2026-09-29'
  );

  if not exists (
    select 1
    from public.billing_renewal_periods as period
    join public.billing_transactions as payment on payment.id = period.payment_transaction_id
    where period.id = 'a0280000-0000-0000-0000-000000000008'::uuid
      and period.scheduled_renewal_date = date '2026-08-06'
      and period.actual_payment_date = date '2026-08-08'
      and period.currency_snapshot = 'USD'
      and period.amount_snapshot is null
      and payment.payment_date = date '2026-08-08'
      and payment.currency = 'USD'
      and payment.amount is null
  ) then
    raise exception 'Renewal Payment correction did not update the exact period and Payment consistently.';
  end if;
  if v_january_payment_before is distinct from (
    select to_jsonb(payment)
    from public.billing_transactions as payment
    join public.billing_renewal_periods as period on period.payment_transaction_id = payment.id
    where period.id = 'a0280000-0000-0000-0000-000000000001'::uuid
  ) then
    raise exception 'Renewal Payment correction changed another generated Payment.';
  end if;
end
$correct_payment$;

do $rejection_guards$
declare
  v_august_payment_id uuid;
  v_january_payment_id uuid;
begin
  select payment_transaction_id into v_august_payment_id from public.billing_renewal_periods
  where id = 'a0280000-0000-0000-0000-000000000008'::uuid;
  select payment_transaction_id into v_january_payment_id from public.billing_renewal_periods
  where id = 'a0280000-0000-0000-0000-000000000001'::uuid;

  begin
    perform * from public.update_billing_renewal_payment(
      'a0280000-0000-0000-0000-000000000301',
      'a0280000-0000-0000-0000-000000000008',
      v_august_payment_id,
      date '2026-09-30',
      'USD',
      80,
      date '2026-09-29'
    );
    raise exception 'A future Payment Date was unexpectedly accepted.';
  exception
    when others then
      if sqlerrm = 'A future Payment Date was unexpectedly accepted.' then raise; end if;
      if position('Payment Date cannot be in the future.' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform * from public.confirm_billing_renewal_paid(
      'a0270000-0000-0000-0000-000000000301',
      'a0280000-0000-0000-0000-000000000004'
    );
    raise exception 'A relationship/period mismatch was unexpectedly accepted.';
  exception
    when others then
      if sqlerrm = 'A relationship/period mismatch was unexpectedly accepted.' then raise; end if;
      if position('renewal period or relationship changed' in lower(sqlerrm)) = 0 then raise; end if;
  end;

  begin
    perform * from public.update_billing_renewal_payment(
      'a0280000-0000-0000-0000-000000000301',
      'a0280000-0000-0000-0000-000000000008',
      v_january_payment_id,
      date '2026-08-08',
      'USD',
      80,
      date '2026-09-29'
    );
    raise exception 'A period/transaction mismatch was unexpectedly accepted.';
  exception
    when others then
      if sqlerrm = 'A period/transaction mismatch was unexpectedly accepted.' then raise; end if;
      if position('period, relationship, or generated Payment changed' in sqlerrm) = 0 then raise; end if;
  end;
end
$rejection_guards$;

-- Paid Undo deletes only August's exact generated Payment and reopens August.
do $paid_undo$
declare
  v_august_payment_id uuid;
  v_january_payment_id uuid;
begin
  select payment_transaction_id into v_august_payment_id from public.billing_renewal_periods
  where id = 'a0280000-0000-0000-0000-000000000008'::uuid;
  select payment_transaction_id into v_january_payment_id from public.billing_renewal_periods
  where id = 'a0280000-0000-0000-0000-000000000001'::uuid;

  perform * from public.undo_billing_renewal_resolution(
    'a0280000-0000-0000-0000-000000000301',
    'a0280000-0000-0000-0000-000000000008'
  );

  if exists (select 1 from public.billing_transactions where id = v_august_payment_id) then
    raise exception 'Paid Undo left its exact generated Payment behind.';
  end if;
  if not exists (select 1 from public.billing_transactions where id = v_january_payment_id) then
    raise exception 'Paid Undo deleted another period''s generated Payment.';
  end if;
  if not exists (
    select 1 from public.billing_renewal_periods
    where id = 'a0280000-0000-0000-0000-000000000008'::uuid
      and resolution is null
      and payment_transaction_id is null
      and actual_payment_date is null
  ) then
    raise exception 'Paid Undo did not reopen its exact renewal period.';
  end if;
end
$paid_undo$;

reset role;

do $retained_fixture_unchanged$
declare
  v_before text;
  v_after text;
begin
  select retained_hash into v_before from renewal_0028_context;
  select md5(
    coalesce((select to_jsonb(link)::text from public.tool_email_links as link where link.id = 'a0270000-0000-0000-0000-000000000301'::uuid), '')
    || coalesce((select to_jsonb(component)::text from public.tool_link_billing_components as component where component.id = 'a0270000-0000-0000-0000-000000000401'::uuid), '')
    || coalesce((
      select string_agg(to_jsonb(period)::text, '|' order by period.id::text)
      from public.billing_renewal_periods as period
      where period.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
    ), '')
    || coalesce((
      select string_agg(to_jsonb(payment)::text, '|' order by payment.id::text)
      from public.billing_transactions as payment
      where payment.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'::uuid
    ), '')
  ) into v_after;
  if v_before is distinct from v_after then
    raise exception 'The retained TEST - Renewal Monthly fixture changed during 0028 verification.';
  end if;
end
$retained_fixture_unchanged$;

select
  'PASS: 0028 renewal decision contracts verified; retained fixture unchanged; all disposable changes will now roll back.' as result;

rollback;
