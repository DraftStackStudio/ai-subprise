-- Narrow repair for databases where migration 0029 was applied before its
-- legacy Billing Date backfill was added. Safe to run repeatedly.

begin;

with backfilled as (
  update public.billing_renewal_periods as period
  set billing_date = period.scheduled_renewal_date
  where period.billing_date is null
  returning period.id
)
select count(*) as backfilled_periods
from backfilled;

commit;
