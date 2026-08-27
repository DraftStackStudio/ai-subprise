-- Keep one active relationship per tool/login while retaining historical rows.
-- Existing duplicate active rows are preserved but all except the newest are
-- marked unlinked before the partial unique index is created.

alter table public.tool_email_links
  add column if not exists unlinked_at timestamptz;

with ranked_active_links as (
  select
    id,
    row_number() over (
      partition by tool_id, email_account_id
      order by created_at desc, id desc
    ) as active_rank
  from public.tool_email_links
  where unlinked_at is null
)
update public.tool_email_links as link
set unlinked_at = clock_timestamp()
from ranked_active_links as ranked
where link.id = ranked.id
  and ranked.active_rank > 1;

create unique index if not exists tool_email_links_one_active_relationship_uidx
  on public.tool_email_links (tool_id, email_account_id)
  where unlinked_at is null;
