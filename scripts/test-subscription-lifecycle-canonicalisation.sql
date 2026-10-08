-- Manual rollback-only verification for migration 0031.
-- Run only after 0031 has been applied to the target database.
begin;

create temporary table lifecycle_0031_baseline on commit drop as
select
  (select count(*) from public.tool_email_links) as relationship_count,
  (select count(*) from public.tool_link_billing_components) as component_count,
  (select count(*) from public.billing_transactions) as payment_count,
  (select count(*) from public.billing_renewal_periods) as renewal_period_count,
  (select count(*) from public.billing_renewal_periods where excluded_at is not null) as excluded_period_count,
  (select count(*) from public.billing_renewal_activity) as renewal_activity_count,
  (select count(*) from public.subscription_lifecycle_events) as lifecycle_event_count;

do $setup$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then
    raise exception '0031 test requires an authenticated fixture user.';
  end if;
  if exists (select 1 from public.ai_tools where id::text like 'a031%')
    or exists (select 1 from public.logins where id::text like 'a031%')
    or exists (select 1 from public.tool_email_links where id::text like 'a031%')
    or exists (select 1 from public.subscription_lifecycle_events where id::text like 'a031%') then
    raise exception 'Safety stop: disposable a031 fixture IDs already exist.';
  end if;

  insert into public.logins (id, user_id, email_address, label, colour) values
    ('a0310000-0000-0000-0000-000000000101', v_user_id, 'active-0031@ai-subprise.invalid', 'TEST Active 0031', '#10b981'),
    ('a0310000-0000-0000-0000-000000000102', v_user_id, 'paused-0031@ai-subprise.invalid', 'TEST Paused 0031', '#f59e0b'),
    ('a0310000-0000-0000-0000-000000000103', v_user_id, 'goodbye-0031@ai-subprise.invalid', 'TEST Goodbye 0031', '#6b7280');

  insert into public.ai_tools (
    id, user_id, name, category, status, is_favourite, is_archived, notes
  ) values (
    'a0310000-0000-0000-0000-000000000201', v_user_id,
    'TEST Lifecycle Canonicalisation 0031', 'Other', 'Paid', false, false,
    'Rollback-only 0031 fixture.'
  );

  -- Omitting status proves the post-0031 relationship default is Active.
  insert into public.tool_email_links (
    id, user_id, tool_id, email_account_id, slot_order, plan, plan_name, unlinked_at
  ) values (
    'a0310000-0000-0000-0000-000000000301', v_user_id,
    'a0310000-0000-0000-0000-000000000201',
    'a0310000-0000-0000-0000-000000000101', 1, 'Paid', 'Active fixture', null
  );

  insert into public.tool_email_links (
    id, user_id, tool_id, email_account_id, slot_order, plan, plan_name, status, unlinked_at
  ) values
    ('a0310000-0000-0000-0000-000000000302', v_user_id,
     'a0310000-0000-0000-0000-000000000201',
     'a0310000-0000-0000-0000-000000000102', 2, 'Paid', 'Paused fixture', 'Paused', null),
    ('a0310000-0000-0000-0000-000000000303', v_user_id,
     'a0310000-0000-0000-0000-000000000201',
     'a0310000-0000-0000-0000-000000000103', 3, 'Paid', 'Goodbye fixture', 'Goodbye',
     timestamptz '2026-01-15 00:00:00+00');

  insert into public.subscription_lifecycle_events (
    id, user_id, tool_email_link_id, previous_lifecycle_state, next_lifecycle_state,
    event_kind, effective_date, effective_date_precision
  ) values
    ('a0310000-0000-0000-0000-000000000601', v_user_id,
     'a0310000-0000-0000-0000-000000000301', 'Active', 'Paused', 'paused',
     date '2026-01-01', 'exact_date'),
    ('a0310000-0000-0000-0000-000000000602', v_user_id,
     'a0310000-0000-0000-0000-000000000301', 'Paused', 'Active', 'resumed',
     date '2026-01-02', 'exact_date');
end
$setup$;

do $contracts$
begin
  if (select status from public.tool_email_links
      where id = 'a0310000-0000-0000-0000-000000000301') <> 'Active' then
    raise exception 'Relationship status default is not Active.';
  end if;

  if not exists (
    select 1 from public.subscription_lifecycle_events
    where id = 'a0310000-0000-0000-0000-000000000601'
      and previous_lifecycle_state = 'Active'
      and next_lifecycle_state = 'Paused'
      and event_kind = 'paused'
  ) then
    raise exception 'Canonical pause transition was rejected.';
  end if;

  if not exists (
    select 1 from public.subscription_lifecycle_events
    where id = 'a0310000-0000-0000-0000-000000000602'
      and previous_lifecycle_state = 'Paused'
      and next_lifecycle_state = 'Active'
      and event_kind = 'resumed'
  ) then
    raise exception 'Canonical resume transition was rejected.';
  end if;

  begin
    update public.tool_email_links
    set status = 'Running'
    where id = 'a0310000-0000-0000-0000-000000000301';
    raise exception 'Legacy relationship status was accepted.';
  exception when check_violation then null;
  end;

  begin
    insert into public.subscription_lifecycle_events (
      user_id, tool_email_link_id, previous_lifecycle_state, next_lifecycle_state,
      event_kind, effective_date, effective_date_precision
    ) values (
      (select user_id from public.tool_email_links
       where id = 'a0310000-0000-0000-0000-000000000301'),
      'a0310000-0000-0000-0000-000000000301', 'Active', 'On a Break', 'paused',
      date '2026-01-03', 'exact_date'
    );
    raise exception 'Legacy lifecycle-ledger state was accepted.';
  exception when check_violation then null;
  end;

  begin
    insert into public.subscription_lifecycle_events (
      user_id, tool_email_link_id, previous_lifecycle_state, next_lifecycle_state,
      event_kind, effective_date, effective_date_precision
    ) values (
      (select user_id from public.tool_email_links
       where id = 'a0310000-0000-0000-0000-000000000301'),
      'a0310000-0000-0000-0000-000000000301', 'Paused', 'Goodbye', 'resumed',
      date '2026-01-03', 'exact_date'
    );
    raise exception 'Invalid canonical lifecycle transition was accepted.';
  exception when check_violation then null;
  end;
end
$contracts$;

do $preservation$
declare
  baseline lifecycle_0031_baseline%rowtype;
begin
  select * into baseline from lifecycle_0031_baseline;
  if (select count(*) from public.tool_link_billing_components) <> baseline.component_count
    or (select count(*) from public.billing_transactions) <> baseline.payment_count
    or (select count(*) from public.billing_renewal_periods) <> baseline.renewal_period_count
    or (select count(*) from public.billing_renewal_periods where excluded_at is not null) <> baseline.excluded_period_count
    or (select count(*) from public.billing_renewal_activity) <> baseline.renewal_activity_count then
    raise exception 'Billing or renewal tables changed during the canonicalisation harness.';
  end if;
  if (select count(*) from public.tool_email_links) <> baseline.relationship_count + 3
    or (select count(*) from public.subscription_lifecycle_events) <> baseline.lifecycle_event_count + 2 then
    raise exception 'Disposable relationship or lifecycle fixture counts are incorrect.';
  end if;
  if (select unlinked_at from public.tool_email_links
      where id = 'a0310000-0000-0000-0000-000000000303')
      is distinct from timestamptz '2026-01-15 00:00:00+00' then
    raise exception 'Relationship unlinked state was not preserved.';
  end if;
end
$preservation$;

select
  'PASS: 0031 canonical relationship lifecycle constraints verified; all disposable changes will now roll back.' as result,
  (select count(*) from public.tool_email_links where id::text like 'a031%') as fixture_relationships,
  (select count(*) from public.subscription_lifecycle_events where id::text like 'a031%') as fixture_lifecycle_events;

rollback;
