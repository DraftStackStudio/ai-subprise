-- Baseline the login/provider schema already deployed to the live project.
-- Every operation is guarded so the migration is a no-op when that schema exists.
do $$
begin
  if to_regclass('public.logins') is null
    and to_regclass('public.email_accounts') is not null then
    alter table public.email_accounts rename to logins;
  end if;
end
$$;

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.logins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email_address text not null,
  label text not null default 'Personal',
  colour text not null default '#6366f1',
  provider_id uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.logins
  add column if not exists user_id uuid,
  add column if not exists email_address text,
  add column if not exists label text default 'Personal',
  add column if not exists colour text default '#6366f1',
  add column if not exists provider_id uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists deleted_at timestamptz;

alter table public.tool_email_links
  add column if not exists unlinked_at timestamptz;

do $$
declare
  provider_id_attribute smallint;
begin
  select attnum
  into provider_id_attribute
  from pg_attribute
  where attrelid = 'public.logins'::regclass
    and attname = 'provider_id'
    and not attisdropped;

  if provider_id_attribute is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.logins'::regclass
        and confrelid = 'public.providers'::regclass
        and contype = 'f'
        and provider_id_attribute = any (conkey)
    ) then
    alter table public.logins
      add constraint logins_provider_id_fkey
      foreign key (provider_id) references public.providers(id);
  end if;
end
$$;
