begin;

revoke all privileges
  on table public.billing_payment_correction_events
  from anon, authenticated;

grant select
  on table public.billing_payment_correction_events
  to authenticated;

commit;
