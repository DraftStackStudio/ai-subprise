-- Narrow idempotent repair for an already-applied migration 0028.
-- Replaces only the affected RPC definition and performs no data mutation.

create or replace function public.update_billing_renewal_payment(
  p_relationship_id uuid,
  p_period_id uuid,
  p_payment_transaction_id uuid,
  p_payment_date date,
  p_currency text,
  p_amount numeric(18, 6),
  p_local_date date default null
)
returns table (period_id uuid, payment_transaction_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_local_date date := coalesce(p_local_date, current_date);
  v_currency text := nullif(upper(btrim(p_currency)), '');
  v_period_rows integer;
  v_transaction_rows integer;
begin
  if v_user_id is null then raise exception 'Authentication is required.'; end if;
  if v_local_date > current_date + 1 then
    raise exception 'The local calendar date cannot be in the future.';
  end if;
  if p_payment_date is null then raise exception 'Enter a valid Payment Date.'; end if;
  if p_payment_date > v_local_date then raise exception 'Payment Date cannot be in the future.'; end if;
  if v_currency is not null and v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Enter a valid three-letter currency.';
  end if;
  if p_amount is not null and p_amount < 0 then
    raise exception 'Amount must be zero or greater.';
  end if;

  perform 1
  from public.billing_renewal_periods as period
  join public.tool_email_links as link on link.id = period.tool_email_link_id
  join public.tool_link_billing_components as component on component.id = period.billing_component_id
    and component.tool_email_link_id = period.tool_email_link_id
  join public.billing_transactions as transaction
    on transaction.id = period.payment_transaction_id
  where period.id = p_period_id
    and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id
    and period.resolution = 'paid'
    and period.payment_transaction_id = p_payment_transaction_id
    and link.user_id = v_user_id
    and link.unlinked_at is null
    and transaction.user_id = v_user_id
    and transaction.tool_email_link_id = p_relationship_id
    and transaction.source = 'renewal'
    and transaction.source_key = 'renewal-period:' || p_period_id::text
  for update of period, component, link, transaction;

  if not found then raise exception 'The renewal period, relationship, or generated Payment changed.'; end if;

  update public.billing_renewal_periods as period
  set actual_payment_date = p_payment_date,
    currency_snapshot = v_currency,
    amount_snapshot = p_amount
  where period.id = p_period_id
    and period.tool_email_link_id = p_relationship_id
    and period.user_id = v_user_id
    and period.resolution = 'paid'
    and period.payment_transaction_id = p_payment_transaction_id;
  get diagnostics v_period_rows = row_count;

  update public.billing_transactions as transaction
  set payment_date = p_payment_date,
    currency = v_currency,
    amount = p_amount
  where transaction.id = p_payment_transaction_id
    and transaction.user_id = v_user_id
    and transaction.tool_email_link_id = p_relationship_id
    and transaction.source = 'renewal'
    and transaction.source_key = 'renewal-period:' || p_period_id::text;
  get diagnostics v_transaction_rows = row_count;

  if v_period_rows <> 1 or v_transaction_rows <> 1 then
    raise exception 'The exact renewal Payment could not be updated safely.';
  end if;

  return query select p_period_id, p_payment_transaction_id;
end;
$$;
