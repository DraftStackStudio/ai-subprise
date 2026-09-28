begin;

-- The legacy "ended / cancelled" choice was ambiguous. Return those rows to
-- neutral unresolved Trials so the user can explicitly choose a new outcome.
-- Preserve the relationship, Trial plan and expiry, billing configuration,
-- payments, and every unrelated history entry.
update public.tool_email_links as link
set
  status = 'Active',
  trial_resolved = false,
  trial_resolution = null,
  converted_date = null,
  trial_resolution_history = coalesce(
    (
      select jsonb_agg(history.entry order by history.ordinality)
      from jsonb_array_elements(coalesce(link.trial_resolution_history, '[]'::jsonb))
        with ordinality as history(entry, ordinality)
      where history.entry ->> 'outcome' is distinct from 'ended'
    ),
    '[]'::jsonb
  )
where link.trial_resolution = 'ended';

alter table public.tool_email_links
drop constraint if exists tool_email_links_trial_resolution_check;

alter table public.tool_email_links
add constraint tool_email_links_trial_resolution_check
check (
  trial_resolution is null
  or trial_resolution in ('converted', 'moved_to_free', 'stopped_using')
);

commit;
