-- Repair environments that did not receive the later ai_tools column migrations.
-- Preset inserts include both fields, so either missing column blocks the whole insert.
alter table public.ai_tools
  add column if not exists restored_at date,
  add column if not exists url text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_tools'
      and column_name = 'pricing_url'
  ) then
    execute $sql$
      update public.ai_tools
      set url = nullif(pricing_url, '#')
      where url is null
        and pricing_url is not null
    $sql$;
  end if;
end
$$;

alter table public.ai_tools
  drop column if exists pricing_url;
