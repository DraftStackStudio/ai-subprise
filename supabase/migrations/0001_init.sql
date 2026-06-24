create table if not exists email_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email_address text not null,
  label text not null default 'Personal',
  colour text not null default '#6366f1',
  created_at timestamptz not null default now()
);

alter table email_accounts enable row level security;
drop policy if exists "email_accounts_v1_read" on email_accounts;
create policy "email_accounts_v1_read" on email_accounts for select using (true);
drop policy if exists "email_accounts_v1_write" on email_accounts;
create policy "email_accounts_v1_write" on email_accounts for all using (true) with check (true);

create table if not exists ai_tools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  logo_url text,
  category text not null default 'LLM',
  status text not null default 'Free',
  billing_type text,
  trial_expiry_date date,
  is_favourite boolean not null default false,
  is_archived boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

alter table ai_tools enable row level security;
drop policy if exists "ai_tools_v1_read" on ai_tools;
create policy "ai_tools_v1_read" on ai_tools for select using (true);
drop policy if exists "ai_tools_v1_write" on ai_tools;
create policy "ai_tools_v1_write" on ai_tools for all using (true) with check (true);

create table if not exists tool_email_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  tool_id uuid not null references ai_tools(id) on delete cascade,
  email_account_id uuid not null references email_accounts(id) on delete cascade,
  slot_order integer not null default 1,
  created_at timestamptz not null default now()
);

alter table tool_email_links enable row level security;
drop policy if exists "tool_email_links_v1_read" on tool_email_links;
create policy "tool_email_links_v1_read" on tool_email_links for select using (true);
drop policy if exists "tool_email_links_v1_write" on tool_email_links;
create policy "tool_email_links_v1_write" on tool_email_links for all using (true) with check (true);

insert into email_accounts (id, email_address, label, colour) values
  ('a1000000-0000-0000-0000-000000000001', 'alex@gmail.com', 'Personal', '#6366f1'),
  ('a1000000-0000-0000-0000-000000000002', 'alex@work.io', 'Work', '#f59e0b'),
  ('a1000000-0000-0000-0000-000000000003', 'alex.side@proton.me', 'Side Projects', '#10b981'),
  ('a1000000-0000-0000-0000-000000000004', 'aitest2024@gmail.com', 'AI Testing', '#ef4444')
on conflict (id) do nothing;

insert into ai_tools (id, name, logo_url, category, status, billing_type, trial_expiry_date, is_favourite, is_archived, notes) values
  ('b1000000-0000-0000-0000-000000000001', 'ChatGPT', 'https://logo.clearbit.com/openai.com', 'LLM', 'Paid', 'Monthly', null, true, false, 'Plus plan, used daily for writing'),
  ('b1000000-0000-0000-0000-000000000002', 'Midjourney', 'https://logo.clearbit.com/midjourney.com', 'Image Generation', 'Paid', 'Monthly', null, true, false, 'Basic plan via Discord'),
  ('b1000000-0000-0000-0000-000000000003', 'Perplexity AI', 'https://logo.clearbit.com/perplexity.ai', 'LLM', 'Trial', null, '2025-08-10', false, false, 'Trying out Pro trial'),
  ('b1000000-0000-0000-0000-000000000004', 'ElevenLabs', 'https://logo.clearbit.com/elevenlabs.io', 'Audio', 'Free', null, null, false, false, 'Free tier for short clips'),
  ('b1000000-0000-0000-0000-000000000005', 'GitHub Copilot', 'https://logo.clearbit.com/github.com', 'Coding', 'Paid', 'Yearly', null, true, false, 'Linked to work account'),
  ('b1000000-0000-0000-0000-000000000006', 'Runway ML', 'https://logo.clearbit.com/runwayml.com', 'Video Generation', 'Trial', null, '2025-08-03', false, false, 'Testing Gen-3 Alpha')
on conflict (id) do nothing;

insert into tool_email_links (tool_id, email_account_id, slot_order) values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 1),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', 1),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 2),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', 1),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 1),
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000004', 1)
on conflict do nothing;