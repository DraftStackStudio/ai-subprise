alter table tool_email_links
add column if not exists currency text not null default 'USD';
