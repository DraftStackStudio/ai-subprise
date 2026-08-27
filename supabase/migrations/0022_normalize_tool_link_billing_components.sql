-- Normalize current billing settings per linked relationship and billing type.
-- These rows describe current configuration only; they are not transactions.

create table if not exists public.tool_link_billing_components (
  id uuid primary key default gen_random_uuid(),
  tool_email_link_id uuid not null references public.tool_email_links(id) on delete cascade,
  billing_type text not null,
  amount text,
  currency text,
  next_renewal_date date,
  purchase_date date,
  last_top_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tool_link_billing_components_type_check
    check (billing_type in ('Monthly', 'Yearly', 'Lifetime', 'One-time', 'Top-up')),
  constraint tool_link_billing_components_unique_type
    unique (tool_email_link_id, billing_type),
  constraint tool_link_billing_components_relevant_dates_check
    check (
      (billing_type in ('Monthly', 'Yearly') and purchase_date is null and last_top_up_date is null)
      or (billing_type in ('Lifetime', 'One-time') and next_renewal_date is null and last_top_up_date is null)
      or (billing_type = 'Top-up' and next_renewal_date is null and purchase_date is null)
    )
);

create index if not exists tool_link_billing_components_link_idx
  on public.tool_link_billing_components (tool_email_link_id);

create index if not exists tool_link_billing_components_type_idx
  on public.tool_link_billing_components (billing_type);

create or replace function public.set_tool_link_billing_component_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tool_link_billing_components_set_updated_at
  on public.tool_link_billing_components;
create trigger tool_link_billing_components_set_updated_at
before update on public.tool_link_billing_components
for each row execute function public.set_tool_link_billing_component_updated_at();

alter table public.tool_link_billing_components enable row level security;

drop policy if exists "tool_link_billing_components_owner_select" on public.tool_link_billing_components;
drop policy if exists "tool_link_billing_components_owner_insert" on public.tool_link_billing_components;
drop policy if exists "tool_link_billing_components_owner_update" on public.tool_link_billing_components;
drop policy if exists "tool_link_billing_components_owner_delete" on public.tool_link_billing_components;

create policy "tool_link_billing_components_owner_select"
on public.tool_link_billing_components for select
using (
  exists (
    select 1
    from public.tool_email_links as link
    where link.id = tool_email_link_id
      and link.user_id = auth.uid()
  )
);

create policy "tool_link_billing_components_owner_insert"
on public.tool_link_billing_components for insert
with check (
  exists (
    select 1
    from public.tool_email_links as link
    where link.id = tool_email_link_id
      and link.user_id = auth.uid()
  )
);

create policy "tool_link_billing_components_owner_update"
on public.tool_link_billing_components for update
using (
  exists (
    select 1
    from public.tool_email_links as link
    where link.id = tool_email_link_id
      and link.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.tool_email_links as link
    where link.id = tool_email_link_id
      and link.user_id = auth.uid()
  )
);

create policy "tool_link_billing_components_owner_delete"
on public.tool_link_billing_components for delete
using (
  exists (
    select 1
    from public.tool_email_links as link
    where link.id = tool_email_link_id
      and link.user_id = auth.uid()
  )
);

-- Backfill recognized legacy billing types. Amount and currency are copied only
-- when the legacy relationship contains exactly one recognized type. With more
-- than one type, their ownership is ambiguous, so those values remain only in
-- the legacy compatibility columns instead of being guessed.
with legacy_components as (
  select
    link.id as tool_email_link_id,
    link.amount,
    link.currency,
    link.next_charge_date,
    link.purchase_date,
    link.last_top_up_date,
    case lower(btrim(entry.value))
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
    end as billing_type
  from public.tool_email_links as link
  cross join lateral unnest(string_to_array(coalesce(link.billing_type, ''), ',')) as entry(value)
), recognized_components as (
  select
    legacy.*,
    count(*) over (partition by legacy.tool_email_link_id) as recognized_type_count
  from legacy_components as legacy
  where legacy.billing_type is not null
), deduplicated_components as (
  select distinct on (tool_email_link_id, billing_type)
    tool_email_link_id,
    billing_type,
    recognized_type_count,
    amount,
    currency,
    next_charge_date,
    purchase_date,
    last_top_up_date
  from recognized_components
  order by tool_email_link_id, billing_type
)
insert into public.tool_link_billing_components (
  tool_email_link_id,
  billing_type,
  amount,
  currency,
  next_renewal_date,
  purchase_date,
  last_top_up_date
)
select
  tool_email_link_id,
  billing_type,
  case when recognized_type_count = 1 then nullif(btrim(amount), '') else null end,
  case when recognized_type_count = 1 then nullif(btrim(currency), '') else null end,
  case when billing_type in ('Monthly', 'Yearly') then next_charge_date else null end,
  case when billing_type in ('Lifetime', 'One-time') then purchase_date else null end,
  case when billing_type = 'Top-up' then last_top_up_date else null end
from deduplicated_components
on conflict (tool_email_link_id, billing_type) do nothing;
