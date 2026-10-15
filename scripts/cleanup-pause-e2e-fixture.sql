-- Phase 2B2-A5.1: privileged, exact-scope cleanup for the committed a034 fixture.
-- DO NOT RUN during A5.1. Run manually in Supabase SQL Editor only after review.
-- Replace the zero UUID and Auth-email placeholder with the dedicated user's
-- exact auth.users.id and deliverable email.
-- The Auth user itself is removed separately in Supabase Authentication only
-- after this transaction commits and the read-only verification returns zero rows.

begin;

create temporary table pause_a034_cleanup_context (
  user_id uuid primary key,
  auth_email text not null
) on commit drop;
insert into pause_a034_cleanup_context values (
  '00000000-0000-0000-0000-000000000000',
  'REPLACE_WITH_DELIVERABLE_AUTH_EMAIL'
);

create temporary table pause_a034_cleanup_events on commit drop as
select event.id
from public.subscription_lifecycle_events as event
where event.user_id = (select user_id from pause_a034_cleanup_context)
  and event.tool_email_link_id = 'a0340000-0000-0000-0000-000000000301';

do $guard$
declare v_user_id uuid := (select user_id from pause_a034_cleanup_context);
        v_auth_email text := (select auth_email from pause_a034_cleanup_context);
begin
  if v_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Replace the zero UUID with the dedicated a034 Auth user ID.';
  end if;
  if v_auth_email = 'REPLACE_WITH_DELIVERABLE_AUTH_EMAIL' then
    raise exception 'Replace the Auth-email placeholder with the dedicated a034 Auth email.';
  end if;
  if exists (
    select 1 from auth.users
    where id = v_user_id
      and lower(coalesce(email, '')) <> lower(v_auth_email)
  ) then
    raise exception 'Safety stop: the supplied Auth user ID belongs to a different email.';
  end if;
  if exists (select 1 from public.ai_tools where id::text like 'a034%' and user_id is distinct from v_user_id)
    or exists (select 1 from public.logins where id::text like 'a034%' and user_id is distinct from v_user_id)
    or exists (select 1 from public.tool_email_links where id::text like 'a034%' and user_id is distinct from v_user_id)
    or exists (
      select 1 from public.tool_link_billing_components
      where id::text like 'a034%'
        and tool_email_link_id not in ('a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000302')
    )
    or exists (select 1 from public.billing_renewal_periods where id::text like 'a034%' and user_id is distinct from v_user_id)
    or exists (select 1 from public.billing_transactions where id::text like 'a034%' and user_id is distinct from v_user_id)
    or exists (select 1 from public.billing_renewal_activity where id::text like 'a034%' and user_id is distinct from v_user_id)
    or exists (select 1 from public.subscription_lifecycle_events where id::text like 'a034%' and user_id is distinct from v_user_id) then
    raise exception 'Safety stop: a reserved a034 ID belongs to another user.';
  end if;
  if exists (select 1 from public.ai_tools where user_id = v_user_id and id <> 'a0340000-0000-0000-0000-000000000201')
    or exists (select 1 from public.logins where user_id = v_user_id and id not in ('a0340000-0000-0000-0000-000000000101', 'a0340000-0000-0000-0000-000000000102'))
    or exists (select 1 from public.tool_email_links where user_id = v_user_id and id not in ('a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000302'))
    or exists (select 1 from public.billing_transactions where user_id = v_user_id and id not in ('a0340000-0000-0000-0000-000000000601', 'a0340000-0000-0000-0000-000000000602'))
    or exists (select 1 from public.billing_renewal_activity where user_id = v_user_id and id <> 'a0340000-0000-0000-0000-000000000701')
    or exists (
      select 1 from public.subscription_lifecycle_events
      where user_id = v_user_id
        and (tool_email_link_id <> 'a0340000-0000-0000-0000-000000000301' or event_kind <> 'paused')
    )
    or (select count(*) from pause_a034_cleanup_events) > 1 then
    raise exception 'Safety stop: the dedicated test user owns an unexpected record.';
  end if;
  if exists (
    select 1 from public.tool_link_billing_components
    where tool_email_link_id in ('a0340000-0000-0000-0000-000000000301', 'a0340000-0000-0000-0000-000000000302')
      and id not in ('a0340000-0000-0000-0000-000000000401', 'a0340000-0000-0000-0000-000000000402', 'a0340000-0000-0000-0000-000000000403')
  ) then
    raise exception 'Safety stop: a fixture relationship has an unexpected billing component.';
  end if;
  if exists (
    select 1 from public.billing_renewal_periods
    where user_id = v_user_id
      and id not in (
        'a0340000-0000-0000-0000-000000000501',
        'a0340000-0000-0000-0000-000000000502',
        'a0340000-0000-0000-0000-000000000503',
        'a0340000-0000-0000-0000-000000000504',
        'a0340000-0000-0000-0000-000000000505'
      )
      and not (
        tool_email_link_id = 'a0340000-0000-0000-0000-000000000301'
        and billing_component_id = 'a0340000-0000-0000-0000-000000000401'
        and scheduled_renewal_date = billing_date
        and resolution is null
        and excluded_at is null
        and plan_name_snapshot = 'TEST Monthly Primary'
        and billing_type_snapshot = 'Monthly'
        and currency_snapshot = 'SGD'
        and amount_snapshot = 30.84
        and exists (
          select 1
          from public.subscription_lifecycle_events as event
          where event.id in (select id from pause_a034_cleanup_events)
            and scheduled_renewal_date <= event.effective_date
        )
      )
  ) then
    raise exception 'Safety stop: the test user has an unexpected renewal period.';
  end if;
end
$guard$;

delete from public.billing_renewal_activity
where user_id = (select user_id from pause_a034_cleanup_context)
  and id = 'a0340000-0000-0000-0000-000000000701'
  and tool_email_link_id = 'a0340000-0000-0000-0000-000000000301';

-- Includes RPC-materialised periods whose IDs are generated, but only beneath
-- the two exact dedicated fixture relationships and their exact components.
delete from public.billing_renewal_periods
where user_id = (select user_id from pause_a034_cleanup_context)
  and (
    (tool_email_link_id = 'a0340000-0000-0000-0000-000000000301'
      and billing_component_id = 'a0340000-0000-0000-0000-000000000401')
    or
    (tool_email_link_id = 'a0340000-0000-0000-0000-000000000302'
      and billing_component_id = 'a0340000-0000-0000-0000-000000000403')
  );

delete from public.subscription_lifecycle_events
where user_id = (select user_id from pause_a034_cleanup_context)
  and id in (select id from pause_a034_cleanup_events)
  and tool_email_link_id = 'a0340000-0000-0000-0000-000000000301';

delete from public.billing_transactions
where user_id = (select user_id from pause_a034_cleanup_context)
  and id in (
    'a0340000-0000-0000-0000-000000000601',
    'a0340000-0000-0000-0000-000000000602'
  )
  and tool_email_link_id in (
    'a0340000-0000-0000-0000-000000000301',
    'a0340000-0000-0000-0000-000000000302'
  );

delete from public.tool_link_billing_components
where id in (
    'a0340000-0000-0000-0000-000000000401',
    'a0340000-0000-0000-0000-000000000402',
    'a0340000-0000-0000-0000-000000000403'
  )
  and tool_email_link_id in (
    'a0340000-0000-0000-0000-000000000301',
    'a0340000-0000-0000-0000-000000000302'
  );

delete from public.tool_email_links
where user_id = (select user_id from pause_a034_cleanup_context)
  and id in (
    'a0340000-0000-0000-0000-000000000301',
    'a0340000-0000-0000-0000-000000000302'
  );

delete from public.ai_tools
where user_id = (select user_id from pause_a034_cleanup_context)
  and id = 'a0340000-0000-0000-0000-000000000201';

delete from public.logins
where user_id = (select user_id from pause_a034_cleanup_context)
  and id in (
    'a0340000-0000-0000-0000-000000000101',
    'a0340000-0000-0000-0000-000000000102'
  );

do $postcondition$
declare v_user_id uuid := (select user_id from pause_a034_cleanup_context);
begin
  if exists (select 1 from public.ai_tools where user_id = v_user_id)
    or exists (select 1 from public.logins where user_id = v_user_id)
    or exists (select 1 from public.tool_email_links where user_id = v_user_id)
    or exists (select 1 from public.billing_renewal_periods where user_id = v_user_id)
    or exists (select 1 from public.billing_transactions where user_id = v_user_id)
    or exists (select 1 from public.billing_renewal_activity where user_id = v_user_id)
    or exists (select 1 from public.subscription_lifecycle_events where user_id = v_user_id)
    or exists (select 1 from public.ai_tools where id::text like 'a034%')
    or exists (select 1 from public.logins where id::text like 'a034%')
    or exists (select 1 from public.tool_email_links where id::text like 'a034%')
    or exists (select 1 from public.tool_link_billing_components where id::text like 'a034%')
    or exists (select 1 from public.billing_renewal_periods where id::text like 'a034%')
    or exists (select 1 from public.billing_transactions where id::text like 'a034%')
    or exists (select 1 from public.billing_renewal_activity where id::text like 'a034%')
    or exists (select 1 from public.subscription_lifecycle_events where id::text like 'a034%') then
    raise exception 'Cleanup postcondition failed; the transaction will roll back.';
  end if;
end
$postcondition$;

select 'PASS: exact a034 public fixture rows removed; verify, then delete the dedicated Auth user.' as result;

commit;
