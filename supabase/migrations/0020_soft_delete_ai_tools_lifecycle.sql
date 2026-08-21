-- Keep deleted tools and their billing history recoverable until a separate
-- permanent-delete action physically removes the tool row.

alter table public.ai_tools
  add column if not exists deleted_at timestamptz;

alter table public.tool_email_links
  add column if not exists unlinked_at timestamptz;

create or replace function public.soft_delete_ai_tools(target_tool_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  deletion_time timestamptz := clock_timestamp();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.tool_email_links as link
  set unlinked_at = deletion_time
  where link.tool_id = any(target_tool_ids)
    and link.user_id = auth.uid()
    and link.unlinked_at is null
    and exists (
      select 1
      from public.ai_tools as tool
      where tool.id = link.tool_id
        and tool.user_id = auth.uid()
        and tool.deleted_at is null
    );

  update public.ai_tools
  set deleted_at = deletion_time
  where id = any(target_tool_ids)
    and user_id = auth.uid()
    and deleted_at is null;
end;
$$;

create or replace function public.restore_ai_tool(
  target_tool_id uuid,
  restored_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  deletion_time timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select deleted_at
  into deletion_time
  from public.ai_tools
  where id = target_tool_id
    and user_id = auth.uid()
  for update;

  if deletion_time is null then
    raise exception 'Deleted AI tool not found';
  end if;

  update public.ai_tools
  set deleted_at = null,
      restored_at = current_date,
      name = coalesce(nullif(btrim(restored_name), ''), name)
  where id = target_tool_id
    and user_id = auth.uid();

  -- Only reactivate links that were active when this exact deletion occurred.
  -- Links unlinked earlier for another reason remain historical/inactive.
  update public.tool_email_links
  set unlinked_at = null
  where tool_id = target_tool_id
    and user_id = auth.uid()
    and unlinked_at = deletion_time;
end;
$$;

revoke all on function public.soft_delete_ai_tools(uuid[]) from public;
revoke all on function public.restore_ai_tool(uuid, text) from public;
grant execute on function public.soft_delete_ai_tools(uuid[]) to authenticated;
grant execute on function public.restore_ai_tool(uuid, text) to authenticated;
