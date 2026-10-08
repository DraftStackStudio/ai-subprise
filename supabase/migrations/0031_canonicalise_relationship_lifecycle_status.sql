-- Canonicalise relationship lifecycle storage to Active, Paused, and Goodbye.
-- This migration changes only structured lifecycle state fields, their
-- constraints, and the relationship-status default. It creates no history,
-- renewal periods, Payments, exclusions, or billing mutations.

begin;

-- Prevent relationship or lifecycle-ledger writes from racing the safety
-- checks and normalisation in this transaction.
lock table public.tool_email_links, public.subscription_lifecycle_events
  in share row exclusive mode;

do $preflight$
begin
  if exists (
    select 1
    from public.tool_email_links as link
    where link.status not in (
      'Active', 'Running', 'Paused', 'On a Break', 'On a break', 'Goodbye',
      'Goodbye it was a journey', 'Goodbye, it was a journey'
    )
  ) then
    raise exception 'Migration 0031 found an unsupported relationship lifecycle status.';
  end if;

  if exists (
    select 1
    from public.subscription_lifecycle_events as event
    where event.previous_lifecycle_state not in (
      'Active', 'Running', 'Paused', 'On a Break', 'On a break', 'Goodbye',
      'Goodbye it was a journey', 'Goodbye, it was a journey'
    )
      or event.next_lifecycle_state not in (
        'Active', 'Running', 'Paused', 'On a Break', 'On a break', 'Goodbye',
        'Goodbye it was a journey', 'Goodbye, it was a journey'
      )
  ) then
    raise exception 'Migration 0031 found an unsupported lifecycle-ledger state.';
  end if;
end
$preflight$;

-- The 0030 checks reject Paused, so remove the dependent transition check and
-- both state-domain checks before canonicalising existing structured states.
alter table public.subscription_lifecycle_events
  drop constraint if exists subscription_lifecycle_events_transition_check,
  drop constraint if exists subscription_lifecycle_events_previous_state_check,
  drop constraint if exists subscription_lifecycle_events_next_state_check;

update public.subscription_lifecycle_events
set
  previous_lifecycle_state = case
    when previous_lifecycle_state in ('Active', 'Running') then 'Active'
    when previous_lifecycle_state in ('Paused', 'On a Break', 'On a break') then 'Paused'
    when previous_lifecycle_state in (
      'Goodbye', 'Goodbye it was a journey', 'Goodbye, it was a journey'
    ) then 'Goodbye'
  end,
  next_lifecycle_state = case
    when next_lifecycle_state in ('Active', 'Running') then 'Active'
    when next_lifecycle_state in ('Paused', 'On a Break', 'On a break') then 'Paused'
    when next_lifecycle_state in (
      'Goodbye', 'Goodbye it was a journey', 'Goodbye, it was a journey'
    ) then 'Goodbye'
  end
where previous_lifecycle_state not in ('Active', 'Paused', 'Goodbye')
   or next_lifecycle_state not in ('Active', 'Paused', 'Goodbye');

alter table public.subscription_lifecycle_events
  add constraint subscription_lifecycle_events_previous_state_check
    check (previous_lifecycle_state in ('Active', 'Paused', 'Goodbye')),
  add constraint subscription_lifecycle_events_next_state_check
    check (next_lifecycle_state in ('Active', 'Paused', 'Goodbye')),
  add constraint subscription_lifecycle_events_transition_check
    check (
      (event_kind = 'paused' and previous_lifecycle_state = 'Active' and next_lifecycle_state = 'Paused')
      or (event_kind = 'ended' and previous_lifecycle_state = 'Active' and next_lifecycle_state = 'Goodbye')
      or (event_kind = 'resumed' and previous_lifecycle_state = 'Paused' and next_lifecycle_state = 'Active')
      or (event_kind in ('restarted', 'restarted_plan_changed') and previous_lifecycle_state = 'Goodbye' and next_lifecycle_state = 'Active')
    );

-- Drop only the canonical constraint name so a rerun remains deterministic.
-- The read-only preflight safety-stops if another status check exists.
alter table public.tool_email_links
  drop constraint if exists tool_email_links_status_check;

update public.tool_email_links
set status = case
  when status in ('Active', 'Running') then 'Active'
  when status in ('Paused', 'On a Break', 'On a break') then 'Paused'
  when status in (
    'Goodbye', 'Goodbye it was a journey', 'Goodbye, it was a journey'
  ) then 'Goodbye'
end
where status not in ('Active', 'Paused', 'Goodbye');

alter table public.tool_email_links
  alter column status set default 'Active',
  add constraint tool_email_links_status_check
    check (status in ('Active', 'Paused', 'Goodbye'));

do $postcondition$
begin
  if exists (
    select 1 from public.tool_email_links as link
    where link.status not in ('Active', 'Paused', 'Goodbye')
  ) then
    raise exception 'Migration 0031 left a non-canonical relationship lifecycle status.';
  end if;

  if exists (
    select 1 from public.subscription_lifecycle_events as event
    where event.previous_lifecycle_state not in ('Active', 'Paused', 'Goodbye')
       or event.next_lifecycle_state not in ('Active', 'Paused', 'Goodbye')
  ) then
    raise exception 'Migration 0031 left a non-canonical lifecycle-ledger state.';
  end if;
end
$postcondition$;

commit;
