alter table logins
add column if not exists deleted_at timestamptz;

alter table tool_email_links
add column if not exists unlinked_at timestamptz;

create or replace function delete_login_preserving_history(target_account_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  deletion_time timestamptz := now();
begin
  update tool_email_links
  set unlinked_at = deletion_time
  where email_account_id = target_account_id
    and user_id = auth.uid()
    and unlinked_at is null;

  update logins
  set deleted_at = deletion_time
  where id = target_account_id
    and user_id = auth.uid()
    and deleted_at is null;
end;
$$;
