-- Dedicated immutable-by-default historical money events.
-- Current billing components and future renewal dates never create rows here.

create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_email_link_id uuid references public.tool_email_links(id) on delete set null,
  tool_id uuid references public.ai_tools(id) on delete set null,
  login_id uuid references public.logins(id) on delete set null,
  payment_date date not null,
  tool_name_snapshot text,
  account_label_snapshot text,
  account_login_snapshot text,
  plan_name_snapshot text,
  billing_type_snapshot text,
  amount numeric(18, 6),
  currency text,
  status text not null,
  note text,
  source text not null default 'manual',
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_transactions_status_check
    check (status in ('Paid', 'Refunded', 'Failed', 'Pending')),
  constraint billing_transactions_billing_type_check
    check (
      billing_type_snapshot is null
      or billing_type_snapshot in ('Monthly', 'Yearly', 'Lifetime', 'One-time', 'Top-up')
    ),
  constraint billing_transactions_currency_check
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint billing_transactions_amount_check
    check (amount is null or amount >= 0),
  constraint billing_transactions_source_check
    check (source in ('manual', 'legacy_json', 'api'))
);

create unique index if not exists billing_transactions_source_key_uidx
  on public.billing_transactions (user_id, source, source_key)
  where source_key is not null;

create index if not exists billing_transactions_user_date_idx
  on public.billing_transactions (user_id, payment_date desc);

create index if not exists billing_transactions_relationship_date_idx
  on public.billing_transactions (tool_email_link_id, payment_date desc)
  where tool_email_link_id is not null;

create index if not exists billing_transactions_tool_date_idx
  on public.billing_transactions (tool_id, payment_date desc)
  where tool_id is not null;

create index if not exists billing_transactions_login_date_idx
  on public.billing_transactions (login_id, payment_date desc)
  where login_id is not null;

create or replace function public.set_billing_transaction_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists billing_transactions_set_updated_at
  on public.billing_transactions;
create trigger billing_transactions_set_updated_at
before update on public.billing_transactions
for each row execute function public.set_billing_transaction_updated_at();

alter table public.billing_transactions enable row level security;

drop policy if exists "billing_transactions_owner_select" on public.billing_transactions;
drop policy if exists "billing_transactions_owner_insert" on public.billing_transactions;
drop policy if exists "billing_transactions_owner_update" on public.billing_transactions;
drop policy if exists "billing_transactions_owner_delete_manual" on public.billing_transactions;

create policy "billing_transactions_owner_select"
on public.billing_transactions for select
using (auth.uid() = user_id);

create policy "billing_transactions_owner_insert"
on public.billing_transactions for insert
with check (
  auth.uid() = user_id
  and (
    tool_email_link_id is null
    or exists (
      select 1 from public.tool_email_links as link
      where link.id = tool_email_link_id and link.user_id = auth.uid()
    )
  )
  and (
    tool_id is null
    or exists (
      select 1 from public.ai_tools as tool
      where tool.id = tool_id and tool.user_id = auth.uid()
    )
  )
  and (
    login_id is null
    or exists (
      select 1 from public.logins as login
      where login.id = login_id and login.user_id = auth.uid()
    )
  )
);

create policy "billing_transactions_owner_update"
on public.billing_transactions for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    tool_email_link_id is null
    or exists (
      select 1 from public.tool_email_links as link
      where link.id = tool_email_link_id and link.user_id = auth.uid()
    )
  )
  and (
    tool_id is null
    or exists (
      select 1 from public.ai_tools as tool
      where tool.id = tool_id and tool.user_id = auth.uid()
    )
  )
  and (
    login_id is null
    or exists (
      select 1 from public.logins as login
      where login.id = login_id and login.user_id = auth.uid()
    )
  )
);

-- Imported legacy rows cannot be removed through the authenticated client.
create policy "billing_transactions_owner_delete_manual"
on public.billing_transactions for delete
using (auth.uid() = user_id and source = 'manual');

revoke all on table public.billing_transactions from anon;
revoke update on table public.billing_transactions from authenticated;
grant select, insert, delete on table public.billing_transactions to authenticated;
grant update (
  payment_date,
  plan_name_snapshot,
  billing_type_snapshot,
  amount,
  currency,
  status,
  note
) on table public.billing_transactions to authenticated;

-- Conservative, idempotent legacy backfill. Only JSON entries that explicitly
-- represent a dated charge or refund are migrated. Current relationship values
-- are not used to fill missing historical snapshots.
with legacy_money_events as (
  select
    link.user_id,
    link.id as tool_email_link_id,
    link.tool_id,
    link.email_account_id as login_id,
    entry.value as history_entry
  from public.tool_email_links as link
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(link.billing_history_entries) = 'array'
        then link.billing_history_entries
      else '[]'::jsonb
    end
  ) as entry(value)
  where link.user_id is not null
    and entry.value->>'event' in ('Charged', 'Refunded')
    and pg_input_is_valid(entry.value->>'date', 'date')
), normalized_legacy_events as (
  select
    user_id,
    tool_email_link_id,
    tool_id,
    login_id,
    (history_entry->>'date')::date as payment_date,
    nullif(btrim(history_entry->>'planName'), '') as plan_name_snapshot,
    case lower(btrim(history_entry->>'billingType'))
      when 'monthly' then 'Monthly'
      when 'annual' then 'Yearly'
      when 'yearly' then 'Yearly'
      when 'lifetime' then 'Lifetime'
      when 'one-time' then 'One-time'
      when 'one-time payment' then 'One-time'
      when 'one-time credit' then 'One-time'
      when 'top-up' then 'Top-up'
      when 'top-up credit' then 'Top-up'
      else null
    end as billing_type_snapshot,
    case
      when btrim(history_entry->>'amount') ~ '^\d+(\.\d+)?$'
        then (history_entry->>'amount')::numeric(18, 6)
      else null
    end as amount,
    case
      when upper(btrim(history_entry->>'currency')) ~ '^[A-Z]{3}$'
        then upper(btrim(history_entry->>'currency'))
      else null
    end as currency,
    case history_entry->>'event'
      when 'Refunded' then 'Refunded'
      else 'Paid'
    end as status,
    nullif(btrim(history_entry->>'note'), '') as note,
    'legacy-json:' || tool_email_link_id::text || ':' || coalesce(
      nullif(history_entry->>'id', ''),
      md5(history_entry::text)
    ) as source_key
  from legacy_money_events
)
insert into public.billing_transactions (
  user_id,
  tool_email_link_id,
  tool_id,
  login_id,
  payment_date,
  plan_name_snapshot,
  billing_type_snapshot,
  amount,
  currency,
  status,
  note,
  source,
  source_key
)
select
  user_id,
  tool_email_link_id,
  tool_id,
  login_id,
  payment_date,
  plan_name_snapshot,
  billing_type_snapshot,
  amount,
  currency,
  status,
  note,
  'legacy_json',
  source_key
from normalized_legacy_events
on conflict (user_id, source, source_key) where source_key is not null do nothing;
