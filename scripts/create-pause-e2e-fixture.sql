-- Phase 2B2-A5.1: committed fixture setup for a later explicitly approved browser test.
-- DO NOT RUN during A5.1. Run manually in Supabase SQL Editor only after the
-- dedicated Auth user exists and preflight-pause-e2e-fixture.sql passes.
-- Replace the zero UUID and Auth-email placeholder with that dedicated user's
-- exact auth.users.id and deliverable email.

begin;

create temporary table pause_a034_context (
  user_id uuid primary key,
  auth_email text not null,
  fixture_created_at timestamptz not null default clock_timestamp()
) on commit drop;

insert into pause_a034_context (user_id, auth_email)
values (
  '00000000-0000-0000-0000-000000000000',
  'REPLACE_WITH_DELIVERABLE_AUTH_EMAIL'
);

do $guard$
declare v_user_id uuid := (select user_id from pause_a034_context);
        v_auth_email text := (select auth_email from pause_a034_context);
begin
  if v_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Replace the zero UUID with the dedicated a034 Auth user ID.';
  end if;
  if v_auth_email = 'REPLACE_WITH_DELIVERABLE_AUTH_EMAIL' then
    raise exception 'Replace the Auth-email placeholder with the dedicated a034 Auth email.';
  end if;
  if not exists (
    select 1 from auth.users
    where id = v_user_id
      and lower(email) = lower(v_auth_email)
      and email_confirmed_at is not null
  ) then
    raise exception 'The dedicated confirmed a034 Auth user was not found.';
  end if;
  if exists (select 1 from public.ai_tools where user_id = v_user_id)
    or exists (select 1 from public.logins where user_id = v_user_id)
    or exists (select 1 from public.tool_email_links where user_id = v_user_id)
    or exists (select 1 from public.billing_renewal_periods where user_id = v_user_id)
    or exists (select 1 from public.billing_transactions where user_id = v_user_id)
    or exists (select 1 from public.billing_renewal_activity where user_id = v_user_id)
    or exists (select 1 from public.subscription_lifecycle_events where user_id = v_user_id) then
    raise exception 'Safety stop: the dedicated a034 Auth user already owns public data.';
  end if;
  if exists (select 1 from public.ai_tools where id::text like 'a034%')
    or exists (select 1 from public.logins where id::text like 'a034%')
    or exists (select 1 from public.tool_email_links where id::text like 'a034%')
    or exists (select 1 from public.tool_link_billing_components where id::text like 'a034%')
    or exists (select 1 from public.billing_renewal_periods where id::text like 'a034%')
    or exists (select 1 from public.billing_transactions where id::text like 'a034%')
    or exists (select 1 from public.billing_renewal_activity where id::text like 'a034%')
    or exists (select 1 from public.subscription_lifecycle_events where id::text like 'a034%') then
    raise exception 'Safety stop: one or more reserved a034 fixture IDs already exist.';
  end if;
end
$guard$;

insert into public.logins (id, user_id, email_address, label, colour) values
  ('a0340000-0000-0000-0000-000000000101', (select user_id from pause_a034_context), 'pause-primary-a034@ai-subprise.invalid', 'TEST Pause Primary A034', '#f59e0b'),
  ('a0340000-0000-0000-0000-000000000102', (select user_id from pause_a034_context), 'pause-control-a034@ai-subprise.invalid', 'TEST Pause Control A034', '#10b981');

insert into public.ai_tools (
  id, user_id, name, category, status, is_favourite, is_archived, notes
) values (
  'a0340000-0000-0000-0000-000000000201',
  (select user_id from pause_a034_context),
  'TEST Pause E2E A034', 'Other', 'Paid', false, false,
  'Disposable Phase 2B2-A5 browser fixture.'
);

insert into public.tool_email_links (
  id, user_id, tool_id, email_account_id, slot_order, plan, plan_name, status,
  billing_type, amount, currency, next_charge_date, trial_resolved, unlinked_at
) values
  ('a0340000-0000-0000-0000-000000000301', (select user_id from pause_a034_context), 'a0340000-0000-0000-0000-000000000201', 'a0340000-0000-0000-0000-000000000101', 1, 'Paid', 'TEST Monthly Primary', 'Active', 'Monthly', '30.84', 'SGD', public.billing_renewal_date_from_anchor((current_date - interval '3 months')::date, 'Monthly', 4), false, null),
  ('a0340000-0000-0000-0000-000000000302', (select user_id from pause_a034_context), 'a0340000-0000-0000-0000-000000000201', 'a0340000-0000-0000-0000-000000000102', 2, 'Paid', 'TEST Monthly Control', 'Active', 'Monthly', '19.00', 'USD', public.billing_renewal_date_from_anchor((current_date - interval '3 months')::date, 'Monthly', 4), false, null);

insert into public.tool_link_billing_components (
  id, tool_email_link_id, billing_type, amount, currency, next_renewal_date,
  recurrence_anchor_date, last_top_up_date, retired_at
) values
  ('a0340000-0000-0000-0000-000000000401', 'a0340000-0000-0000-0000-000000000301', 'Monthly', '30.84', 'SGD', public.billing_renewal_date_from_anchor((current_date - interval '3 months')::date, 'Monthly', 4), (current_date - interval '3 months')::date, null, null),
  ('a0340000-0000-0000-0000-000000000402', 'a0340000-0000-0000-0000-000000000301', 'Top-up', '10.00', 'SGD', null, null, current_date - 7, null),
  ('a0340000-0000-0000-0000-000000000403', 'a0340000-0000-0000-0000-000000000302', 'Monthly', '19.00', 'USD', public.billing_renewal_date_from_anchor((current_date - interval '3 months')::date, 'Monthly', 4), (current_date - interval '3 months')::date, null, null);

insert into public.billing_transactions (
  id, user_id, tool_email_link_id, tool_id, login_id, payment_date,
  tool_name_snapshot, account_label_snapshot, account_login_snapshot,
  plan_name_snapshot, billing_type_snapshot, amount, currency, status,
  note, source, source_key
) values
  ('a0340000-0000-0000-0000-000000000601', (select user_id from pause_a034_context), 'a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000201', 'a0340000-0000-0000-0000-000000000101', current_date - 32, 'TEST Pause E2E A034', 'TEST Pause Primary A034', 'pause-primary-a034@ai-subprise.invalid', 'TEST Monthly Primary', 'Monthly', 30.84, 'SGD', 'Paid', 'Protected historical fixture payment.', 'manual', 'a034-primary-history'),
  ('a0340000-0000-0000-0000-000000000602', (select user_id from pause_a034_context), 'a0340000-0000-0000-0000-000000000302', 'a0340000-0000-0000-0000-000000000201', 'a0340000-0000-0000-0000-000000000102', current_date - 32, 'TEST Pause E2E A034', 'TEST Pause Control A034', 'pause-control-a034@ai-subprise.invalid', 'TEST Monthly Control', 'Monthly', 19.00, 'USD', 'Paid', 'Protected isolation-control payment.', 'manual', 'a034-control-history');

insert into public.billing_renewal_periods (
  id, user_id, tool_email_link_id, billing_component_id,
  scheduled_renewal_date, billing_date, plan_name_snapshot,
  billing_type_snapshot, currency_snapshot, amount_snapshot,
  resolution, resolved_at, not_charged_reason_code
) values
  ('a0340000-0000-0000-0000-000000000501', (select user_id from pause_a034_context), 'a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000401', current_date - 1, current_date - 1, 'TEST Monthly Primary', 'Monthly', 'SGD', 30.84, null, null, null),
  ('a0340000-0000-0000-0000-000000000502', (select user_id from pause_a034_context), 'a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000401', current_date, current_date, 'TEST Monthly Primary', 'Monthly', 'SGD', 30.84, null, null, null),
  ('a0340000-0000-0000-0000-000000000503', (select user_id from pause_a034_context), 'a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000401', current_date + 1, current_date + 1, 'TEST Monthly Primary', 'Monthly', 'SGD', 30.84, null, null, null),
  ('a0340000-0000-0000-0000-000000000504', (select user_id from pause_a034_context), 'a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000401', current_date + 2, current_date + 2, 'TEST Monthly Primary', 'Monthly', 'SGD', 30.84, 'not_charged', clock_timestamp(), 'free_or_waived'),
  ('a0340000-0000-0000-0000-000000000505', (select user_id from pause_a034_context), 'a0340000-0000-0000-0000-000000000302', 'a0340000-0000-0000-0000-000000000403', current_date - 1, current_date - 1, 'TEST Monthly Control', 'Monthly', 'USD', 19.00, null, null, null);

insert into public.billing_renewal_activity (
  id, user_id, tool_email_link_id, billing_renewal_period_id, kind,
  activity_date, previous_billing_date, billing_date,
  plan_name_snapshot, billing_type_snapshot, currency_snapshot,
  amount_snapshot, note
) values (
  'a0340000-0000-0000-0000-000000000701',
  (select user_id from pause_a034_context),
  'a0340000-0000-0000-0000-000000000301',
  'a0340000-0000-0000-0000-000000000501',
  'billing_period_corrected', current_date - 1, current_date - 2, current_date - 1,
  'TEST Monthly Primary', 'Monthly', 'SGD', 30.84,
  'Protected fixture renewal activity.'
);

do $postcondition$
declare v_user_id uuid := (select user_id from pause_a034_context);
begin
  if (select count(*) from public.ai_tools where user_id = v_user_id) <> 1
    or (select count(*) from public.logins where user_id = v_user_id) <> 2
    or (select count(*) from public.tool_email_links where user_id = v_user_id) <> 2
    or (select count(*) from public.tool_link_billing_components where tool_email_link_id in ('a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000302')) <> 3
    or (select count(*) from public.billing_renewal_periods where user_id = v_user_id) <> 5
    or (select count(*) from public.billing_transactions where user_id = v_user_id) <> 2
    or (select count(*) from public.billing_renewal_activity where user_id = v_user_id) <> 1
    or exists (select 1 from public.subscription_lifecycle_events where user_id = v_user_id) then
    raise exception 'The committed a034 fixture did not match its exact setup manifest.';
  end if;
end
$postcondition$;

select
  'Fixture ready; save this result and do not Pause until the read-only baseline is captured.' as result,
  user_id,
  fixture_created_at,
  current_date as exact_pause_date,
  'a0340000-0000-0000-0000-000000000301'::uuid as primary_relationship_id,
  'a0340000-0000-0000-0000-000000000302'::uuid as isolation_relationship_id,
  'The UI generates the Pause request UUID; capture it from the lifecycle ledger after submission.'::text as pause_request_id_instruction
from pause_a034_context;

commit;
