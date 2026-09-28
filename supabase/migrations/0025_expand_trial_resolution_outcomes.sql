-- Compatibility step: allow the old app and the new three-outcome app to
-- coexist briefly during deployment. No data is changed in this migration.
alter table public.tool_email_links
drop constraint if exists tool_email_links_trial_resolution_check;

alter table public.tool_email_links
add constraint tool_email_links_trial_resolution_check
check (
  trial_resolution is null
  or trial_resolution in ('converted', 'ended', 'moved_to_free', 'stopped_using')
);
