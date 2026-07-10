alter table ai_tools
add column if not exists pricing_url text not null default '#',
add column if not exists logo_text text,
add column if not exists logo_bg text not null default '#F0F4FF',
add column if not exists archived_at timestamptz,
add column if not exists archived_status text;

alter table tool_email_links
add column if not exists plan text not null default 'Free Tier',
add column if not exists plan_name text,
add column if not exists status text not null default 'Running',
add column if not exists billing_type text,
add column if not exists amount text;
