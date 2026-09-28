-- Permanently remove every AI-tool tracking record for the authenticated user
-- while preserving the user's saved logins.

create or replace function public.reset_ai_tools_clean_slate()
returns table (
  billing_transactions_deleted bigint,
  ai_tools_deleted bigint,
  tool_email_links_deleted bigint,
  billing_components_deleted bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  deleted_transactions bigint := 0;
  deleted_tools bigint := 0;
  relationship_count bigint := 0;
  component_count bigint := 0;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)
  into relationship_count
  from public.tool_email_links as link
  where link.user_id = current_user_id;

  select count(*)
  into component_count
  from public.tool_link_billing_components as component
  where exists (
    select 1
    from public.tool_email_links as link
    where link.id = component.tool_email_link_id
      and link.user_id = current_user_id
  );

  -- Delete transactions before tools so ON DELETE SET NULL cannot leave
  -- detached historical rows behind.
  delete from public.billing_transactions
  where user_id = current_user_id;
  get diagnostics deleted_transactions = row_count;

  -- Includes active and soft-deleted tools. Relationships and their normalized
  -- billing components are removed by the existing foreign-key cascades.
  delete from public.ai_tools
  where user_id = current_user_id;
  get diagnostics deleted_tools = row_count;

  return query select
    deleted_transactions,
    deleted_tools,
    relationship_count,
    component_count;
end;
$$;

revoke all on function public.reset_ai_tools_clean_slate() from public;
revoke all on function public.reset_ai_tools_clean_slate() from anon;
grant execute on function public.reset_ai_tools_clean_slate() to authenticated;
