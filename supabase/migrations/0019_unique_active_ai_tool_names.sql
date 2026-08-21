-- Prevent duplicate active tool names per user while allowing a deleted tool
-- name to be added again later.
alter table public.ai_tools
  add column if not exists deleted_at timestamptz;

create unique index if not exists ai_tools_user_normalized_name_active_uidx
  on public.ai_tools (user_id, lower(trim(name)))
  where deleted_at is null;
