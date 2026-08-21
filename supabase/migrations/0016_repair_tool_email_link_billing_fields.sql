-- Repair deployed environments missing the billing, trial, and history fields
-- introduced across migrations 0005 through 0011.
alter table public.tool_email_links
  add column if not exists trial_expiry_date date,
  add column if not exists next_charge_date date,
  add column if not exists currency text not null default 'USD',
  add column if not exists last_top_up_date date,
  add column if not exists trial_resolved boolean not null default false,
  add column if not exists trial_resolution text,
  add column if not exists trial_resolution_history jsonb not null default '[]'::jsonb,
  add column if not exists billing_history_entries jsonb not null default '[]'::jsonb,
  add column if not exists converted_date date,
  add column if not exists purchase_date date,
  add column if not exists start_date date;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.tool_email_links'::regclass
      and conname = 'tool_email_links_trial_resolution_check'
  ) then
    alter table public.tool_email_links
      add constraint tool_email_links_trial_resolution_check
      check (trial_resolution is null or trial_resolution in ('converted', 'ended'));
  end if;
end
$$;
