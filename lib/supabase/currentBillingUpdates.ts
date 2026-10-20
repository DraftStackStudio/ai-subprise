import { validBillingDate } from "@/lib/currentBilling";
import { canonicalCurrentBillingAmount, isTrustedCurrentBillingRevision } from "@/lib/currentBillingChange";
import { validSubscriptionBillingTypes } from "@/lib/subscriptions";
import { createClient } from "@/lib/supabase/client";
import type {
  UpdateCurrentBillingInput,
  UpdateCurrentBillingResult,
} from "@/types/currentBillingChange";
import type { BillingAmount } from "@/types/toolDetail";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalUuid(value: unknown, label: string) {
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new Error(`${label} is required.`);
  return value.toLowerCase();
}

function nullableUuid(value: unknown, label: string) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !uuidPattern.test(value)) throw new Error(`Current Billing returned an invalid ${label}.`);
  return value.toLowerCase();
}

export { isTrustedCurrentBillingRevision };

function componentDate(component: BillingAmount) {
  if (component.billingType === "Monthly" || component.billingType === "Yearly") return component.nextRenewalDate ?? "";
  if (component.billingType === "Top-up") return component.lastTopUpDate ?? "";
  return component.purchaseDate ?? "";
}

function normalizedComponentPayload(component: BillingAmount) {
  if (!isRecord(component)
    || typeof component.billingType !== "string"
    || typeof component.amount !== "string"
    || typeof component.currency !== "string") {
    throw new Error("Current Billing contains an invalid component.");
  }
  const amount = canonicalCurrentBillingAmount(component.amount);
  const currency = component.currency.trim().toUpperCase() || null;
  if (currency !== null && !/^[A-Z]{3}$/.test(currency)) throw new Error("Select a valid currency.");
  for (const value of [component.nextRenewalDate, component.purchaseDate, component.lastTopUpDate]) {
    if (value !== undefined && typeof value !== "string") throw new Error("Enter a valid billing date.");
  }
  const date = componentDate(component).trim();
  if (date && !validBillingDate(date)) throw new Error("Enter a valid billing date.");
  const recurring = component.billingType === "Monthly" || component.billingType === "Yearly";
  return {
    amount,
    billingType: component.billingType,
    currency,
    lastTopUpDate: component.billingType === "Top-up" ? date || null : null,
    nextRenewalDate: recurring ? date || null : null,
    purchaseDate: component.billingType === "Lifetime" || component.billingType === "One-time" ? date || null : null,
  };
}

function currentBillingRpcPayload(input: UpdateCurrentBillingInput) {
  const relationshipId = canonicalUuid(input?.relationshipId, "A relationship ID");
  const requestId = canonicalUuid(input?.requestId, "A Current Billing request ID");
  if (!validBillingDate(input?.effectiveDate)) throw new Error("Enter a valid effective date.");
  if (!validBillingDate(input?.localDate)) throw new Error("A valid local date is required.");
  if (input.mode !== "change" && input.mode !== "correction") {
    throw new Error("Select whether this is a billing change or correction.");
  }
  if (input.mode === "correction" && input.effectiveDate !== input.localDate) {
    throw new Error("A correction becomes operational on its save date.");
  }
  if (input.mode === "change" && input.effectiveDate > input.localDate) {
    throw new Error("Future billing changes are not supported.");
  }
  if (!isTrustedCurrentBillingRevision(input.expectedRevision)) {
    throw new Error("Current Billing could not be verified. Reopen the editor before saving.");
  }
  if (typeof input.planName !== "string") throw new Error("Current Billing contains an invalid plan name.");
  if (!Array.isArray(input.components)
    || !validSubscriptionBillingTypes(input.components.map((component) => component?.billingType))) {
    throw new Error("Select one main billing type and optionally Top-up credit (maximum two types).");
  }
  if (input.reason !== null && typeof input.reason !== "string") {
    throw new Error("Current Billing contains an invalid reason.");
  }

  return {
    p_components: input.components.map(normalizedComponentPayload),
    p_effective_date: input.effectiveDate,
    p_expected_revision: input.expectedRevision,
    p_local_date: input.localDate,
    p_mode: input.mode,
    p_plan_name: input.planName.trim(),
    p_reason: input.reason?.trim() || null,
    p_relationship_id: relationshipId,
    p_request_id: requestId,
  };
}

function currentBillingResultFromRecord(
  value: unknown,
  expectedRelationshipId: string,
  requestId: string,
): UpdateCurrentBillingResult {
  if (!isRecord(value)) throw new Error("Current Billing did not return a result.");
  const requiredFields = [
    "relationship_id", "billing_event_id", "previous_recurring_component_id",
    "new_recurring_component_id", "excluded_period_count", "was_already_applied", "was_no_op",
  ];
  if (requiredFields.some((field) => !Object.prototype.hasOwnProperty.call(value, field))) {
    throw new Error("Current Billing returned an incomplete result.");
  }
  const relationshipId = nullableUuid(value.relationship_id, "relationship ID");
  const billingEventId = nullableUuid(value.billing_event_id, "billing event ID");
  const previousRecurringComponentId = nullableUuid(value.previous_recurring_component_id, "previous component ID");
  const newRecurringComponentId = nullableUuid(value.new_recurring_component_id, "new component ID");
  const excludedPeriodCount = Number(value.excluded_period_count);
  if (relationshipId !== expectedRelationshipId) throw new Error("Current Billing returned a different relationship.");
  if (!Number.isInteger(excludedPeriodCount) || excludedPeriodCount < 0) {
    throw new Error("Current Billing returned an invalid excluded-period count.");
  }
  if (typeof value.was_already_applied !== "boolean" || typeof value.was_no_op !== "boolean") {
    throw new Error("Current Billing returned an invalid result status.");
  }
  const wasAlreadyApplied = value.was_already_applied;
  const wasNoOp = value.was_no_op;
  if (wasAlreadyApplied && wasNoOp) throw new Error("Current Billing returned an invalid result status.");
  if (wasNoOp) {
    if (billingEventId !== null || previousRecurringComponentId !== null || newRecurringComponentId !== null
      || excludedPeriodCount !== 0 || wasAlreadyApplied) {
      throw new Error("Current Billing returned an invalid no-op result.");
    }
  } else if (billingEventId !== requestId) {
    throw new Error("Current Billing returned an unexpected billing event.");
  }

  return {
    billingEventId,
    excludedPeriodCount,
    newRecurringComponentId,
    previousRecurringComponentId,
    relationshipId,
    wasAlreadyApplied,
    wasNoOp,
  };
}

export async function updateCurrentBilling(input: UpdateCurrentBillingInput): Promise<UpdateCurrentBillingResult> {
  const payload = currentBillingRpcPayload(input);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("update_current_billing", payload);
  if (error) throw error;
  const record = Array.isArray(data) ? data[0] : data;
  return currentBillingResultFromRecord(record, payload.p_relationship_id, payload.p_request_id);
}
