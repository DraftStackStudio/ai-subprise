alter table tool_email_links
add column if not exists trial_resolved boolean not null default false,
add column if not exists trial_resolution text,
add column if not exists trial_resolution_history jsonb not null default '[]'::jsonb,
add column if not exists billing_history_entries jsonb not null default '[]'::jsonb,
add column if not exists converted_date date;

alter table tool_email_links
drop constraint if exists tool_email_links_trial_resolution_check;

alter table tool_email_links
add constraint tool_email_links_trial_resolution_check
check (trial_resolution is null or trial_resolution in ('converted', 'ended'));
