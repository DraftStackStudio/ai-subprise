alter table email_accounts
add column if not exists provider text not null default 'Gmail';

