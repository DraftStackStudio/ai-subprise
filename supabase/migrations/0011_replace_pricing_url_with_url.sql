alter table public.ai_tools
add column if not exists url text;

update public.ai_tools
set url = nullif(pricing_url, '#')
where url is null
  and pricing_url is not null;

alter table public.ai_tools
drop column if exists pricing_url;
