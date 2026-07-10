drop policy if exists "email_accounts_v1_read" on email_accounts;
drop policy if exists "email_accounts_v1_write" on email_accounts;
drop policy if exists "email_accounts_owner_select" on email_accounts;
drop policy if exists "email_accounts_owner_insert" on email_accounts;
drop policy if exists "email_accounts_owner_update" on email_accounts;
drop policy if exists "email_accounts_owner_delete" on email_accounts;

create policy "email_accounts_owner_select"
on email_accounts for select
using (auth.uid() = user_id);

create policy "email_accounts_owner_insert"
on email_accounts for insert
with check (auth.uid() = user_id);

create policy "email_accounts_owner_update"
on email_accounts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "email_accounts_owner_delete"
on email_accounts for delete
using (auth.uid() = user_id);

drop policy if exists "ai_tools_v1_read" on ai_tools;
drop policy if exists "ai_tools_v1_write" on ai_tools;
drop policy if exists "ai_tools_owner_select" on ai_tools;
drop policy if exists "ai_tools_owner_insert" on ai_tools;
drop policy if exists "ai_tools_owner_update" on ai_tools;
drop policy if exists "ai_tools_owner_delete" on ai_tools;

create policy "ai_tools_owner_select"
on ai_tools for select
using (auth.uid() = user_id);

create policy "ai_tools_owner_insert"
on ai_tools for insert
with check (auth.uid() = user_id);

create policy "ai_tools_owner_update"
on ai_tools for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "ai_tools_owner_delete"
on ai_tools for delete
using (auth.uid() = user_id);

drop policy if exists "tool_email_links_v1_read" on tool_email_links;
drop policy if exists "tool_email_links_v1_write" on tool_email_links;
drop policy if exists "tool_email_links_owner_select" on tool_email_links;
drop policy if exists "tool_email_links_owner_insert" on tool_email_links;
drop policy if exists "tool_email_links_owner_update" on tool_email_links;
drop policy if exists "tool_email_links_owner_delete" on tool_email_links;

create policy "tool_email_links_owner_select"
on tool_email_links for select
using (auth.uid() = user_id);

create policy "tool_email_links_owner_insert"
on tool_email_links for insert
with check (auth.uid() = user_id);

create policy "tool_email_links_owner_update"
on tool_email_links for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "tool_email_links_owner_delete"
on tool_email_links for delete
using (auth.uid() = user_id);
