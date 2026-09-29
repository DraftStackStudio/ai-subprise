import { createClient } from "@/lib/supabase/client";
import type { BillingRenewalMutationResult, BillingRenewalPeriod, BillingRenewalResolution } from "@/types/billingRenewalPeriod";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asPeriod(record: Record<string, unknown>): BillingRenewalPeriod {
  const resolution = text(record.resolution);
  return {
    actualPaymentDate: text(record.actual_payment_date),
    amountSnapshot: record.amount_snapshot === null || record.amount_snapshot === undefined ? "" : String(record.amount_snapshot),
    billingComponentId: text(record.billing_component_id),
    billingTypeSnapshot: text(record.billing_type_snapshot) as "Monthly" | "Yearly",
    createdAt: text(record.created_at),
    currencySnapshot: text(record.currency_snapshot),
    id: text(record.id),
    paymentTransactionId: text(record.payment_transaction_id),
    planNameSnapshot: text(record.plan_name_snapshot),
    relationshipId: text(record.tool_email_link_id),
    resolution: resolution ? resolution as BillingRenewalResolution : null,
    resolvedAt: text(record.resolved_at),
    scheduledRenewalDate: text(record.scheduled_renewal_date),
    updatedAt: text(record.updated_at),
    userId: text(record.user_id),
  };
}

function mutationResult(data: unknown): BillingRenewalMutationResult {
  const record = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!record) throw new Error("The renewal operation did not return a result.");
  return {
    nextRenewalDate: text(record.next_renewal_date),
    paymentTransactionId: text(record.payment_transaction_id),
    periodId: text(record.period_id),
  };
}

export async function getBillingRenewalPeriodsByRelationship(relationshipId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("billing_renewal_periods")
    .select("*")
    .eq("tool_email_link_id", relationshipId)
    .order("scheduled_renewal_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((record) => asPeriod(record as Record<string, unknown>));
}

export async function syncDueBillingRenewalPeriods(relationshipId: string, billingComponentId: string, asOfDate?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("sync_due_billing_renewal_periods", {
    p_as_of_date: asOfDate,
    p_billing_component_id: billingComponentId,
    p_relationship_id: relationshipId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function confirmBillingRenewalPaid(relationshipId: string, periodId: string, actualPaymentDate?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("confirm_billing_renewal_paid", {
    p_actual_payment_date: actualPaymentDate,
    p_period_id: periodId,
    p_relationship_id: relationshipId,
  });
  if (error) throw error;
  return mutationResult(data);
}

export async function markBillingRenewalNotCharged(relationshipId: string, periodId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("mark_billing_renewal_not_charged", {
    p_period_id: periodId,
    p_relationship_id: relationshipId,
  });
  if (error) throw error;
  return mutationResult(data);
}

export async function undoBillingRenewalResolution(relationshipId: string, periodId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("undo_billing_renewal_resolution", {
    p_period_id: periodId,
    p_relationship_id: relationshipId,
  });
  if (error) throw error;
  return mutationResult(data);
}
