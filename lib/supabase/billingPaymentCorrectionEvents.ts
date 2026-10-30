import { createClient } from "@/lib/supabase/client";
import { paymentCorrectionsEnabled } from "@/lib/paymentCorrectionAvailability";
import type {
  BillingPaymentCorrectionEvent,
  BillingPaymentCorrectionField,
  BillingPaymentCorrectionSnapshot,
} from "@/types/billingPaymentCorrectionEvent";
import type { BillingTransactionSource, BillingTransactionStatus, BillingTransactionType } from "@/types/billingTransaction";

const correctionHistoryPageSize = 500;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function snapshot(value: unknown): BillingPaymentCorrectionSnapshot {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    amount: text(record.amount),
    billingType: text(record.billingType) as BillingTransactionType | "",
    currency: text(record.currency),
    note: text(record.note),
    paymentDate: text(record.paymentDate),
    planName: text(record.planName),
    relationshipId: text(record.relationshipId),
    source: text(record.source) as BillingTransactionSource,
    sourceKey: text(record.sourceKey),
    status: text(record.status) as BillingTransactionStatus,
    transactionId: text(record.transactionId),
  };
}

function asEvent(record: Record<string, unknown>): BillingPaymentCorrectionEvent {
  return {
    afterSnapshot: snapshot(record.after_snapshot),
    beforeSnapshot: snapshot(record.before_snapshot),
    changedFields: Array.isArray(record.changed_fields) ? record.changed_fields.map(String) as BillingPaymentCorrectionField[] : [],
    createdAt: text(record.created_at),
    effectiveDate: text(record.effective_date),
    id: text(record.id),
    paymentSource: text(record.payment_source) as "manual" | "renewal",
    paymentTransactionId: text(record.payment_transaction_id),
    relationshipId: text(record.tool_email_link_id),
    requestId: text(record.request_id),
    userId: text(record.user_id),
  };
}

export async function getBillingPaymentCorrectionEventsByRelationships(relationshipIds: string[]) {
  if (!paymentCorrectionsEnabled) return [];
  const scopedIds = [...new Set(relationshipIds.filter(Boolean))];
  if (!scopedIds.length) return [];
  const supabase = createClient();
  const records: Record<string, unknown>[] = [];
  let expectedCount: number | null = null;
  let offset = 0;

  do {
    const { count, data, error } = await supabase
      .from("billing_payment_correction_events")
      .select("*", { count: "exact" })
      .in("tool_email_link_id", scopedIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + correctionHistoryPageSize - 1);
    if (error) throw error;
    if (expectedCount === null) {
      if (count === null) throw new Error("Could not verify complete payment-correction history.");
      expectedCount = count;
    }
    const page = (data ?? []) as Record<string, unknown>[];
    records.push(...page);
    offset += page.length;
    if (offset < expectedCount && page.length === 0) {
      throw new Error("Payment-correction history ended before every record was loaded.");
    }
  } while (offset < (expectedCount ?? 0));

  const allowed = new Set(scopedIds);
  return records.map(asEvent)
    .filter((event) => allowed.has(event.relationshipId))
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate)
      || right.createdAt.localeCompare(left.createdAt)
      || right.id.localeCompare(left.id));
}

export async function getBillingPaymentCorrectionEventsByRelationship(relationshipId: string) {
  return getBillingPaymentCorrectionEventsByRelationships([relationshipId]);
}
