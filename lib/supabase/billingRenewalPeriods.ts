import { createClient } from "@/lib/supabase/client";
import type {
  BillingRenewalExactMutationResult,
  BillingRenewalActivity,
  BillingRenewalMutationResult,
  BillingRenewalNotChargedReasonCode,
  BillingRenewalPeriod,
  BillingRenewalResolution,
  MarkBillingRenewalNotChargedInput,
  UpdateBillingRenewalPaymentInput,
  UpdateBillingRenewalPeriodSnapshotInput,
} from "@/types/billingRenewalPeriod";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function localCalendarDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function asPeriod(record: Record<string, unknown>): BillingRenewalPeriod {
  const resolution = text(record.resolution);
  const notChargedReasonCode = text(record.not_charged_reason_code);
  return {
    actualPaymentDate: text(record.actual_payment_date),
    amountSnapshot: record.amount_snapshot === null || record.amount_snapshot === undefined ? "" : String(record.amount_snapshot),
    billingComponentId: text(record.billing_component_id),
    billingDate: text(record.billing_date) || text(record.scheduled_renewal_date),
    billingTypeSnapshot: text(record.billing_type_snapshot) as "Monthly" | "Yearly",
    createdAt: text(record.created_at),
    currencySnapshot: text(record.currency_snapshot),
    excludedAt: text(record.excluded_at),
    excludedByLifecycleEventId: text(record.excluded_by_lifecycle_event_id),
    id: text(record.id),
    notChargedNote: text(record.not_charged_note),
    notChargedReasonCode: notChargedReasonCode
      ? notChargedReasonCode as BillingRenewalNotChargedReasonCode
      : null,
    notChargedReasonText: text(record.not_charged_reason_text),
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

function asActivity(record: Record<string, unknown>): BillingRenewalActivity {
  return {
    activityDate: text(record.activity_date),
    amountSnapshot: record.amount_snapshot === null || record.amount_snapshot === undefined ? "" : String(record.amount_snapshot),
    billingDate: text(record.billing_date),
    billingTypeSnapshot: text(record.billing_type_snapshot) as "Monthly" | "Yearly",
    createdAt: text(record.created_at),
    currencySnapshot: text(record.currency_snapshot),
    id: text(record.id),
    kind: text(record.kind) as BillingRenewalActivity["kind"],
    note: text(record.note),
    periodId: text(record.billing_renewal_period_id),
    planNameSnapshot: text(record.plan_name_snapshot),
    previousBillingDate: text(record.previous_billing_date),
    relationshipId: text(record.tool_email_link_id),
  };
}

function exactMutationResult(data: unknown): BillingRenewalExactMutationResult {
  const record = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!record) throw new Error("The renewal operation did not return a result.");
  return {
    paymentTransactionId: text(record.payment_transaction_id),
    periodId: text(record.period_id),
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

export async function getBillingRenewalActivitiesByRelationship(relationshipId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("billing_renewal_activity")
    .select("*")
    .eq("tool_email_link_id", relationshipId)
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((record) => asActivity(record as Record<string, unknown>));
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

export async function confirmBillingRenewalPaid(relationshipId: string, periodId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("confirm_billing_renewal_paid", {
    p_period_id: periodId,
    p_relationship_id: relationshipId,
  });
  if (error) throw error;
  return mutationResult(data);
}

export async function markBillingRenewalNotCharged(
  relationshipId: string,
  periodId: string,
  input: MarkBillingRenewalNotChargedInput,
) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("mark_billing_renewal_not_charged", {
    p_note: input.note?.trim() || null,
    p_period_id: periodId,
    p_reason_code: input.reasonCode,
    p_reason_text: input.reasonText?.trim() || null,
    p_relationship_id: relationshipId,
  });
  if (error) throw error;
  return mutationResult(data);
}

export async function updateBillingRenewalPeriodSnapshot(
  relationshipId: string,
  periodId: string,
  input: UpdateBillingRenewalPeriodSnapshotInput,
) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("update_billing_renewal_period_snapshot", {
    p_amount: input.amount.trim() || null,
    p_billing_date: input.billingDate,
    p_currency: input.currency.trim() || null,
    p_date_scope: input.dateScope,
    p_local_date: localCalendarDate(),
    p_period_id: periodId,
    p_plan_name: input.planName.trim() || null,
    p_relationship_id: relationshipId,
  });
  if (error) throw error;
  return exactMutationResult(data).periodId;
}

export async function updateBillingRenewalPayment(
  relationshipId: string,
  periodId: string,
  paymentTransactionId: string,
  input: UpdateBillingRenewalPaymentInput,
) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("update_billing_renewal_payment", {
    p_amount: input.amount.trim() || null,
    p_currency: input.currency.trim() || null,
    p_local_date: localCalendarDate(),
    p_payment_date: input.paymentDate,
    p_payment_transaction_id: paymentTransactionId,
    p_period_id: periodId,
    p_relationship_id: relationshipId,
  });
  if (error) throw error;
  return exactMutationResult(data);
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
