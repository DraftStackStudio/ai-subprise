-- Database-level verification for migration 0027.
-- Run manually in the Supabase SQL Editor after 0027 has been applied.
--
-- Safety:
-- - Refuses to run unless the approved post-0027 baseline is unchanged.
-- - Uses fixed, clearly labelled TEST records only.
-- - Hashes all pre-existing relationship, Current Billing, and Payment rows and
--   verifies those rows are byte-for-byte unchanged before committing.
-- - Rolls back the entire transaction if any assertion fails.
-- - Retains only the primary Monthly dummy relationship on success.

begin;

create temporary table renewal_test_context (
  user_id uuid not null,
  monthly_login_id uuid not null,
  monthly_tool_id uuid not null,
  monthly_relationship_id uuid not null,
  monthly_component_id uuid not null,
  yearly_login_id uuid not null,
  yearly_tool_id uuid not null,
  yearly_relationship_id uuid not null,
  yearly_component_id uuid not null
) on commit preserve rows;

create temporary table renewal_test_baseline (
  entity text primary key,
  row_count bigint not null,
  content_hash text not null
) on commit preserve rows;

create temporary table renewal_test_results (
  ordinal bigint generated always as identity,
  test_name text not null,
  passed boolean not null,
  detail text not null
) on commit preserve rows;

create temporary table renewal_test_calls (
  call_name text primary key,
  period_id uuid,
  payment_transaction_id uuid,
  next_renewal_date date,
  inserted_count integer
) on commit preserve rows;

do $setup$
declare
  v_user_count integer;
  v_user_id uuid;
  v_relationship_count bigint;
  v_component_count bigint;
  v_payment_count bigint;
  v_period_count bigint;
begin
  select count(*) into v_relationship_count from public.tool_email_links;
  select count(*) into v_component_count from public.tool_link_billing_components;
  select count(*) into v_payment_count from public.billing_transactions;
  select count(*) into v_period_count from public.billing_renewal_periods;

  if v_relationship_count <> 50
    or v_component_count <> 6
    or v_payment_count <> 15
    or v_period_count <> 0 then
    raise exception
      'Safety stop: expected baseline 50 relationships, 6 components, 15 Payments, 0 renewal periods; found %, %, %, %.',
      v_relationship_count, v_component_count, v_payment_count, v_period_count;
  end if;

  select count(distinct user_id), max(user_id::text)::uuid
  into v_user_count, v_user_id
  from public.tool_email_links
  where user_id is not null;

  if v_user_count <> 1 or v_user_id is null then
    raise exception
      'Safety stop: expected exactly one existing relationship owner, found %.',
      v_user_count;
  end if;

  if exists (
    select 1 from public.logins
    where id in (
      'a0270000-0000-0000-0000-000000000101'::uuid,
      'a0270000-0000-0000-0000-000000000102'::uuid
    )
      or email_address in (
        'test-renewal-monthly@ai-subprise.invalid',
        'test-renewal-yearly@ai-subprise.invalid'
      )
  ) or exists (
    select 1 from public.ai_tools
    where id in (
      'a0270000-0000-0000-0000-000000000201'::uuid,
      'a0270000-0000-0000-0000-000000000202'::uuid
    )
      or name in ('TEST - Renewal Tool', 'TEST — Renewal Yearly Tool')
  ) or exists (
    select 1 from public.tool_email_links
    where id in (
      'a0270000-0000-0000-0000-000000000301'::uuid,
      'a0270000-0000-0000-0000-000000000302'::uuid
    )
  ) or exists (
    select 1 from public.tool_link_billing_components
    where id in (
      'a0270000-0000-0000-0000-000000000401'::uuid,
      'a0270000-0000-0000-0000-000000000402'::uuid
    )
  ) then
    raise exception 'Safety stop: one or more fixed renewal-test records already exist.';
  end if;

  insert into renewal_test_baseline (entity, row_count, content_hash)
  select
    'relationships',
    count(*),
    md5(coalesce(string_agg(to_jsonb(link)::text, '|' order by link.id::text), ''))
  from public.tool_email_links as link;

  insert into renewal_test_baseline (entity, row_count, content_hash)
  select
    'components',
    count(*),
    md5(coalesce(string_agg(to_jsonb(component)::text, '|' order by component.id::text), ''))
  from public.tool_link_billing_components as component;

  insert into renewal_test_baseline (entity, row_count, content_hash)
  select
    'payments',
    count(*),
    md5(coalesce(string_agg(to_jsonb(payment)::text, '|' order by payment.id::text), ''))
  from public.billing_transactions as payment;

  insert into renewal_test_context values (
    v_user_id,
    'a0270000-0000-0000-0000-000000000101',
    'a0270000-0000-0000-0000-000000000201',
    'a0270000-0000-0000-0000-000000000301',
    'a0270000-0000-0000-0000-000000000401',
    'a0270000-0000-0000-0000-000000000102',
    'a0270000-0000-0000-0000-000000000202',
    'a0270000-0000-0000-0000-000000000302',
    'a0270000-0000-0000-0000-000000000402'
  );

  insert into public.logins (id, user_id, email_address, label, colour)
  values
    (
      'a0270000-0000-0000-0000-000000000101',
      v_user_id,
      'test-renewal-monthly@ai-subprise.invalid',
      'TEST - Renewal Monthly',
      '#f59e0b'
    ),
    (
      'a0270000-0000-0000-0000-000000000102',
      v_user_id,
      'test-renewal-yearly@ai-subprise.invalid',
      'TEST — Renewal Yearly',
      '#f59e0b'
    );

  insert into public.ai_tools (
    id, user_id, name, category, status, is_favourite, is_archived, notes
  ) values
    (
      'a0270000-0000-0000-0000-000000000201',
      v_user_id,
      'TEST - Renewal Tool',
      'Other',
      'Paid',
      false,
      false,
      'Disposable Checkpoint 1 renewal test fixture.'
    ),
    (
      'a0270000-0000-0000-0000-000000000202',
      v_user_id,
      'TEST — Renewal Yearly Tool',
      'Other',
      'Paid',
      false,
      false,
      'Temporary yearly/leap cadence test fixture.'
    );

  insert into public.tool_email_links (
    id, user_id, tool_id, email_account_id, slot_order,
    plan, plan_name, status, billing_type, amount, currency,
    next_charge_date, unlinked_at
  ) values
    (
      'a0270000-0000-0000-0000-000000000301',
      v_user_id,
      'a0270000-0000-0000-0000-000000000201',
      'a0270000-0000-0000-0000-000000000101',
      1,
      'Paid',
      'TEST Monthly Plan',
      'Active',
      'Monthly',
      '30.84',
      'SGD',
      date '2026-01-31',
      null
    ),
    (
      'a0270000-0000-0000-0000-000000000302',
      v_user_id,
      'a0270000-0000-0000-0000-000000000202',
      'a0270000-0000-0000-0000-000000000102',
      1,
      'Paid',
      'TEST Yearly Leap Plan',
      'Active',
      'Yearly',
      '120.00',
      'SGD',
      date '2024-02-29',
      null
    );

  insert into public.tool_link_billing_components (
    id, tool_email_link_id, billing_type, amount, currency,
    next_renewal_date, recurrence_anchor_date
  ) values
    (
      'a0270000-0000-0000-0000-000000000401',
      'a0270000-0000-0000-0000-000000000301',
      'Monthly',
      '30.84',
      'SGD',
      date '2026-01-31',
      date '2026-01-31'
    ),
    (
      'a0270000-0000-0000-0000-000000000402',
      'a0270000-0000-0000-0000-000000000302',
      'Yearly',
      '120.00',
      'SGD',
      date '2024-02-29',
      date '2024-02-29'
    );
end
$setup$;

grant select on renewal_test_context to authenticated;
grant select, insert, update, delete on renewal_test_results to authenticated;
grant select, insert, update, delete on renewal_test_calls to authenticated;
grant usage, select on sequence renewal_test_results_ordinal_seq to authenticated;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from renewal_test_context),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', (select user_id::text from renewal_test_context),
    'role', 'authenticated'
  )::text,
  true
);

set local role authenticated;

insert into renewal_test_calls (call_name, inserted_count)
select
  'monthly_sync',
  public.sync_due_billing_renewal_periods(
    'a0270000-0000-0000-0000-000000000301',
    'a0270000-0000-0000-0000-000000000401',
    date '2026-04-01'
  );

insert into renewal_test_results (test_name, passed, detail)
select
  'Monthly sync creates three unresolved periods',
  inserted_count = 3,
  'inserted=' || inserted_count
from renewal_test_calls
where call_name = 'monthly_sync';

insert into renewal_test_results (test_name, passed, detail)
select
  'Monthly 31st cadence is preserved',
  array_agg(scheduled_renewal_date order by scheduled_renewal_date)
    = array[date '2026-01-31', date '2026-02-28', date '2026-03-31'],
  'dates=' || array_agg(scheduled_renewal_date order by scheduled_renewal_date)::text
from public.billing_renewal_periods
where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301';

insert into renewal_test_results (test_name, passed, detail)
select
  'Sync creates zero Payments',
  count(*) = 0,
  'renewal_payments=' || count(*)
from public.billing_transactions
where tool_email_link_id in (
  'a0270000-0000-0000-0000-000000000301',
  'a0270000-0000-0000-0000-000000000302'
)
  and source = 'renewal';

insert into renewal_test_calls (call_name, inserted_count)
select
  'monthly_duplicate_sync',
  public.sync_due_billing_renewal_periods(
    'a0270000-0000-0000-0000-000000000301',
    'a0270000-0000-0000-0000-000000000401',
    date '2026-04-01'
  );

insert into renewal_test_results (test_name, passed, detail)
select
  'Duplicate Monthly sync creates no duplicate periods',
  inserted_count = 0
    and (
      select count(*)
      from public.billing_renewal_periods
      where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'
    ) = 3,
  'inserted=' || inserted_count || '; periods=' || (
    select count(*)
    from public.billing_renewal_periods
    where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'
  )
from renewal_test_calls
where call_name = 'monthly_duplicate_sync';

insert into renewal_test_calls (call_name, inserted_count)
select
  'yearly_sync',
  public.sync_due_billing_renewal_periods(
    'a0270000-0000-0000-0000-000000000302',
    'a0270000-0000-0000-0000-000000000402',
    date '2026-03-01'
  );

insert into renewal_test_results (test_name, passed, detail)
select
  'Yearly sync creates the expected leap-anchored periods',
  inserted_count = 3
    and (
      select array_agg(scheduled_renewal_date order by scheduled_renewal_date)
      from public.billing_renewal_periods
      where tool_email_link_id = 'a0270000-0000-0000-0000-000000000302'
    ) = array[date '2024-02-29', date '2025-02-28', date '2026-02-28'],
  'inserted=' || inserted_count || '; dates=' || coalesce((
    select array_agg(scheduled_renewal_date order by scheduled_renewal_date)::text
    from public.billing_renewal_periods
    where tool_email_link_id = 'a0270000-0000-0000-0000-000000000302'
  ), 'none')
from renewal_test_calls
where call_name = 'yearly_sync';

insert into renewal_test_results (test_name, passed, detail)
select
  'Duplicate Yearly sync creates no duplicate periods',
  public.sync_due_billing_renewal_periods(
    'a0270000-0000-0000-0000-000000000302',
    'a0270000-0000-0000-0000-000000000402',
    date '2026-03-01'
  ) = 0
    and (
      select count(*)
      from public.billing_renewal_periods
      where tool_email_link_id = 'a0270000-0000-0000-0000-000000000302'
    ) = 3,
  'periods=' || (
    select count(*)
    from public.billing_renewal_periods
    where tool_email_link_id = 'a0270000-0000-0000-0000-000000000302'
  );

do $isolation_tests$
declare
  v_error text;
begin
  begin
    perform public.sync_due_billing_renewal_periods(
      'a0270000-0000-0000-0000-000000000301',
      'a0270000-0000-0000-0000-000000000402',
      date '2026-04-01'
    );
    raise exception 'TEST_UNEXPECTED_SUCCESS';
  exception when others then
    v_error := sqlerrm;
    insert into renewal_test_results (test_name, passed, detail)
    values (
      'Wrong relationship/component pair is rejected',
      v_error <> 'TEST_UNEXPECTED_SUCCESS',
      v_error
    );
  end;

  begin
    perform public.confirm_billing_renewal_paid(
      'a0270000-0000-0000-0000-000000000302',
      (
        select id
        from public.billing_renewal_periods
        where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'
          and scheduled_renewal_date = date '2026-02-28'
      ),
      date '2026-02-28'
    );
    raise exception 'TEST_UNEXPECTED_SUCCESS';
  exception when others then
    v_error := sqlerrm;
    insert into renewal_test_results (test_name, passed, detail)
    values (
      'Wrong relationship/period pair is rejected',
      v_error <> 'TEST_UNEXPECTED_SUCCESS',
      v_error
    );
  end;
end
$isolation_tests$;

insert into renewal_test_calls (
  call_name, period_id, payment_transaction_id, next_renewal_date
)
select
  'confirm_february',
  result.period_id,
  result.payment_transaction_id,
  result.next_renewal_date
from public.confirm_billing_renewal_paid(
  'a0270000-0000-0000-0000-000000000301',
  (
    select id
    from public.billing_renewal_periods
    where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'
      and scheduled_renewal_date = date '2026-02-28'
  ),
  date '2026-02-28'
) as result;

insert into renewal_test_results (test_name, passed, detail)
select
  'Confirm paid creates exactly one linked renewal Payment',
  period.resolution = 'paid'
    and period.payment_transaction_id = call.payment_transaction_id
    and payment.source = 'renewal'
    and payment.source_key = 'renewal-period:' || period.id::text
    and payment.tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'
    and (
      select count(*)
      from public.billing_transactions
      where source = 'renewal'
        and source_key = 'renewal-period:' || period.id::text
    ) = 1,
  'period=' || period.id || '; payment=' || payment.id
from renewal_test_calls as call
join public.billing_renewal_periods as period
  on period.id = call.period_id
join public.billing_transactions as payment
  on payment.id = call.payment_transaction_id
where call.call_name = 'confirm_february';

insert into renewal_test_calls (
  call_name, period_id, payment_transaction_id, next_renewal_date
)
select
  'retry_confirm_february',
  result.period_id,
  result.payment_transaction_id,
  result.next_renewal_date
from public.confirm_billing_renewal_paid(
  'a0270000-0000-0000-0000-000000000301',
  (
    select period_id
    from renewal_test_calls
    where call_name = 'confirm_february'
  ),
  date '2026-02-28'
) as result;

insert into renewal_test_results (test_name, passed, detail)
select
  'Retrying Confirm paid is idempotent',
  retry.payment_transaction_id = original.payment_transaction_id
    and (
      select count(*)
      from public.billing_transactions
      where source = 'renewal'
        and source_key = 'renewal-period:' || original.period_id::text
    ) = 1,
  'original=' || original.payment_transaction_id || '; retry=' || retry.payment_transaction_id
from renewal_test_calls as original
join renewal_test_calls as retry on retry.call_name = 'retry_confirm_february'
where original.call_name = 'confirm_february';

insert into renewal_test_calls (
  call_name, period_id, payment_transaction_id, next_renewal_date
)
select
  'not_charged_march',
  result.period_id,
  result.payment_transaction_id,
  result.next_renewal_date
from public.mark_billing_renewal_not_charged(
  'a0270000-0000-0000-0000-000000000301',
  (
    select id
    from public.billing_renewal_periods
    where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'
      and scheduled_renewal_date = date '2026-03-31'
  )
) as result;

insert into renewal_test_results (test_name, passed, detail)
select
  'Not charged resolves one period and creates no Payment',
  period.resolution = 'not_charged'
    and period.payment_transaction_id is null
    and (
      select count(*)
      from public.billing_transactions
      where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'
        and source = 'renewal'
    ) = 1,
  'resolution=' || period.resolution || '; renewal_payments=' || (
    select count(*)
    from public.billing_transactions
    where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'
      and source = 'renewal'
  )
from renewal_test_calls as call
join public.billing_renewal_periods as period on period.id = call.period_id
where call.call_name = 'not_charged_march';

insert into renewal_test_results (test_name, passed, detail)
select
  'Earlier unresolved period prevents Next renewal from skipping ahead',
  component.next_renewal_date = date '2026-01-31'
    and link.next_charge_date = date '2026-01-31',
  'component=' || component.next_renewal_date || '; relationship=' || link.next_charge_date
from public.tool_link_billing_components as component
join public.tool_email_links as link on link.id = component.tool_email_link_id
where component.id = 'a0270000-0000-0000-0000-000000000401';

do $rls_tests$
declare
  v_rows integer;
  v_error text;
  v_payment_id uuid := (
    select payment_transaction_id
    from renewal_test_calls
    where call_name = 'confirm_february'
  );
begin
  begin
    update public.billing_transactions
    set note = 'TEST WRITE MUST NOT APPLY'
    where id = v_payment_id;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then raise exception 'TEST_WRITE_SUCCEEDED'; end if;
    insert into renewal_test_results (test_name, passed, detail)
    values ('Renewal Payment cannot be manually edited', true, 'updated_rows=0');
  exception when others then
    v_error := sqlerrm;
    insert into renewal_test_results (test_name, passed, detail)
    values (
      'Renewal Payment cannot be manually edited',
      sqlstate = '42501',
      v_error
    );
  end;

  begin
    delete from public.billing_transactions
    where id = v_payment_id;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then raise exception 'TEST_WRITE_SUCCEEDED'; end if;
    insert into renewal_test_results (test_name, passed, detail)
    values ('Renewal Payment cannot be manually deleted', true, 'deleted_rows=0');
  exception when others then
    v_error := sqlerrm;
    insert into renewal_test_results (test_name, passed, detail)
    values (
      'Renewal Payment cannot be manually deleted',
      sqlstate = '42501',
      v_error
    );
  end;

  begin
    update public.billing_renewal_periods
    set amount_snapshot = amount_snapshot
    where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301';
    get diagnostics v_rows = row_count;
    if v_rows > 0 then raise exception 'TEST_WRITE_SUCCEEDED'; end if;
    insert into renewal_test_results (test_name, passed, detail)
    values ('Renewal periods cannot be directly manipulated', true, 'updated_rows=0');
  exception when others then
    v_error := sqlerrm;
    insert into renewal_test_results (test_name, passed, detail)
    values (
      'Renewal periods cannot be directly manipulated',
      sqlstate = '42501',
      v_error
    );
  end;
end
$rls_tests$;

insert into renewal_test_calls (
  call_name, period_id, payment_transaction_id, next_renewal_date
)
select
  'confirm_january',
  result.period_id,
  result.payment_transaction_id,
  result.next_renewal_date
from public.confirm_billing_renewal_paid(
  'a0270000-0000-0000-0000-000000000301',
  (
    select id
    from public.billing_renewal_periods
    where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'
      and scheduled_renewal_date = date '2026-01-31'
  ),
  date '2026-01-31'
) as result;

insert into renewal_test_results (test_name, passed, detail)
select
  'Resolving the contiguous gap advances Next renewal',
  component.next_renewal_date = date '2026-04-30'
    and link.next_charge_date = date '2026-04-30',
  'component=' || component.next_renewal_date || '; relationship=' || link.next_charge_date
from public.tool_link_billing_components as component
join public.tool_email_links as link on link.id = component.tool_email_link_id
where component.id = 'a0270000-0000-0000-0000-000000000401';

insert into renewal_test_calls (
  call_name, period_id, payment_transaction_id, next_renewal_date
)
select
  'undo_january_paid',
  result.period_id,
  result.payment_transaction_id,
  result.next_renewal_date
from public.undo_billing_renewal_resolution(
  'a0270000-0000-0000-0000-000000000301',
  (select period_id from renewal_test_calls where call_name = 'confirm_january')
) as result;

insert into renewal_test_results (test_name, passed, detail)
select
  'Undo Confirm paid removes only its exact generated Payment',
  january.resolution is null
    and not exists (
      select 1
      from public.billing_transactions
      where id = confirm_january.payment_transaction_id
    )
    and exists (
      select 1
      from public.billing_transactions
      where id = confirm_february.payment_transaction_id
    ),
  'january_removed=' || (
    not exists (
      select 1 from public.billing_transactions
      where id = confirm_january.payment_transaction_id
    )
  ) || '; february_preserved=' || (
    exists (
      select 1 from public.billing_transactions
      where id = confirm_february.payment_transaction_id
    )
  )
from public.billing_renewal_periods as january
cross join renewal_test_calls as confirm_january
cross join renewal_test_calls as confirm_february
where january.id = confirm_january.period_id
  and confirm_january.call_name = 'confirm_january'
  and confirm_february.call_name = 'confirm_february';

insert into renewal_test_calls (
  call_name, period_id, payment_transaction_id, next_renewal_date
)
select
  'undo_february_paid',
  result.period_id,
  result.payment_transaction_id,
  result.next_renewal_date
from public.undo_billing_renewal_resolution(
  'a0270000-0000-0000-0000-000000000301',
  (select period_id from renewal_test_calls where call_name = 'confirm_february')
) as result;

insert into renewal_test_calls (
  call_name, period_id, payment_transaction_id, next_renewal_date
)
select
  'undo_march_not_charged',
  result.period_id,
  result.payment_transaction_id,
  result.next_renewal_date
from public.undo_billing_renewal_resolution(
  'a0270000-0000-0000-0000-000000000301',
  (select period_id from renewal_test_calls where call_name = 'not_charged_march')
) as result;

insert into renewal_test_results (test_name, passed, detail)
select
  'Undo restores paid and not-charged periods to unresolved',
  count(*) filter (where resolution is null) = 3
    and count(*) filter (where resolution is not null) = 0
    and count(*) filter (where payment_transaction_id is not null) = 0,
  'unresolved=' || count(*) filter (where resolution is null)
    || '; resolved=' || count(*) filter (where resolution is not null)
from public.billing_renewal_periods
where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301';

insert into renewal_test_results (test_name, passed, detail)
select
  'All generated renewal Payments are removed after Undo',
  count(*) = 0,
  'remaining=' || count(*)
from public.billing_transactions
where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'
  and source = 'renewal';

reset role;

-- The cadence helper is intentionally not executable by the authenticated
-- client. Verify its leap-year return as the migration owner instead.
insert into renewal_test_results (test_name, passed, detail)
select
  'Leap-year cadence returns to 29 February',
  public.billing_renewal_date_from_anchor(
    date '2024-02-29', 'Yearly', 4
  ) = date '2028-02-29',
  'sequence_4=' || public.billing_renewal_date_from_anchor(
    date '2024-02-29', 'Yearly', 4
  );

-- Remove only the temporary Yearly fixture. The primary Monthly fixture and its
-- three unresolved periods remain for the upcoming UI checkpoint.
delete from public.billing_renewal_periods
where tool_email_link_id = 'a0270000-0000-0000-0000-000000000302';

delete from public.ai_tools
where id = 'a0270000-0000-0000-0000-000000000202';

delete from public.logins
where id = 'a0270000-0000-0000-0000-000000000102';

insert into renewal_test_results (test_name, passed, detail)
select
  'All pre-existing relationships are unchanged',
  baseline.row_count = current_rows.row_count
    and baseline.content_hash = current_rows.content_hash,
  'before=' || baseline.row_count || '/' || baseline.content_hash
    || '; after=' || current_rows.row_count || '/' || current_rows.content_hash
from renewal_test_baseline as baseline
cross join lateral (
  select
    count(*) as row_count,
    md5(coalesce(string_agg(to_jsonb(link)::text, '|' order by link.id::text), '')) as content_hash
  from public.tool_email_links as link
  where link.id <> 'a0270000-0000-0000-0000-000000000301'
) as current_rows
where baseline.entity = 'relationships';

insert into renewal_test_results (test_name, passed, detail)
select
  'All pre-existing Current Billing components are unchanged',
  baseline.row_count = current_rows.row_count
    and baseline.content_hash = current_rows.content_hash,
  'before=' || baseline.row_count || '/' || baseline.content_hash
    || '; after=' || current_rows.row_count || '/' || current_rows.content_hash
from renewal_test_baseline as baseline
cross join lateral (
  select
    count(*) as row_count,
    md5(coalesce(string_agg(to_jsonb(component)::text, '|' order by component.id::text), '')) as content_hash
  from public.tool_link_billing_components as component
  where component.id <> 'a0270000-0000-0000-0000-000000000401'
) as current_rows
where baseline.entity = 'components';

insert into renewal_test_results (test_name, passed, detail)
select
  'All pre-existing Payments are unchanged',
  baseline.row_count = current_rows.row_count
    and baseline.content_hash = current_rows.content_hash,
  'before=' || baseline.row_count || '/' || baseline.content_hash
    || '; after=' || current_rows.row_count || '/' || current_rows.content_hash
from renewal_test_baseline as baseline
cross join lateral (
  select
    count(*) as row_count,
    md5(coalesce(string_agg(to_jsonb(payment)::text, '|' order by payment.id::text), '')) as content_hash
  from public.billing_transactions as payment
) as current_rows
where baseline.entity = 'payments';

insert into renewal_test_results (test_name, passed, detail)
select
  'Final retained dummy state is isolated and reusable',
  (select count(*) from public.tool_email_links) = 51
    and (select count(*) from public.tool_link_billing_components) = 7
    and (select count(*) from public.billing_transactions) = 15
    and (
      select count(*)
      from public.billing_renewal_periods
      where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'
        and resolution is null
    ) = 3
    and (
      select next_renewal_date
      from public.tool_link_billing_components
      where id = 'a0270000-0000-0000-0000-000000000401'
    ) = date '2026-01-31',
  'relationships=' || (select count(*) from public.tool_email_links)
    || '; components=' || (select count(*) from public.tool_link_billing_components)
    || '; payments=' || (select count(*) from public.billing_transactions)
    || '; retained_unresolved_periods=' || (
      select count(*)
      from public.billing_renewal_periods
      where tool_email_link_id = 'a0270000-0000-0000-0000-000000000301'
        and resolution is null
    );

do $assert_all$
declare
  v_failures text;
begin
  select string_agg(test_name || ': ' || detail, E'\n' order by ordinal)
  into v_failures
  from renewal_test_results
  where not passed;

  if v_failures is not null then
    raise exception 'Renewal foundation verification failed. All test changes were rolled back.%',
      E'\n' || v_failures;
  end if;
end
$assert_all$;

commit;

select test_name, passed, detail
from renewal_test_results
order by ordinal;

select
  tool.name as retained_tool,
  login.label as retained_login,
  link.id as relationship_id,
  component.id as billing_component_id,
  component.billing_type,
  component.currency,
  component.amount,
  component.recurrence_anchor_date,
  component.next_renewal_date,
  count(period.id) as unresolved_periods,
  array_agg(period.scheduled_renewal_date order by period.scheduled_renewal_date)
    as scheduled_periods
from public.tool_email_links as link
join public.ai_tools as tool on tool.id = link.tool_id
join public.logins as login on login.id = link.email_account_id
join public.tool_link_billing_components as component
  on component.tool_email_link_id = link.id
left join public.billing_renewal_periods as period
  on period.tool_email_link_id = link.id
  and period.resolution is null
where link.id = 'a0270000-0000-0000-0000-000000000301'
group by
  tool.name,
  login.label,
  link.id,
  component.id,
  component.billing_type,
  component.currency,
  component.amount,
  component.recurrence_anchor_date,
  component.next_renewal_date;
