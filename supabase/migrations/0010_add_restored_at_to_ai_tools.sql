alter table public.ai_tools
  add column if not exists restored_at date;
