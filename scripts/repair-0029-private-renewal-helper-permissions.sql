-- Narrow, idempotent permission repair for databases where migrations 0027
-- through 0029 have already been applied. No function bodies or data change.

begin;

revoke execute on function public.billing_renewal_date_from_anchor(date, text, integer)
  from authenticated;

revoke execute on function public.billing_renewal_sequence_index(date, text, date)
  from authenticated;

commit;
