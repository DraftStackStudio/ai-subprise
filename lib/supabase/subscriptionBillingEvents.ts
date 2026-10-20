import { createClient } from "@/lib/supabase/client";
import type {
  CurrentBillingChangeMode,
  CurrentBillingClassification,
  CurrentBillingField,
  CurrentBillingSnapshot,
} from "@/types/currentBillingChange";
import type { SubscriptionBillingEvent } from "@/types/subscriptionBillingEvent";

const billingModes = new Set<CurrentBillingChangeMode>(["change", "correction"]);
const billingFields = new Set<CurrentBillingField>([
  "plan_name", "component_configuration", "billing_type", "amount", "currency",
  "next_renewal_date", "purchase_date", "last_top_up_date",
]);
const billingClassifications = new Set<CurrentBillingClassification>([
  "plan_changed", "component_added", "component_removed", "billing_cycle_changed",
  "billing_type_changed", "price_increased", "price_decreased", "amount_changed",
  "amount_recorded", "amount_cleared", "currency_changed", "renewal_date_changed",
  "purchase_date_changed", "last_top_up_date_changed",
]);

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function snapshot(value: unknown): CurrentBillingSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("A Current Billing event contains an invalid snapshot.");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.planName !== "string" || !record.components || typeof record.components !== "object" || Array.isArray(record.components)) {
    throw new Error("A Current Billing event contains an invalid snapshot.");
  }
  return value as CurrentBillingSnapshot;
}

function allowedArray<T extends string>(value: unknown, allowed: ReadonlySet<T>, label: string): T[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !allowed.has(item as T))) {
    throw new Error(`A Current Billing event contains invalid ${label}.`);
  }
  return value as T[];
}

export function subscriptionBillingEventFromRecord(record: Record<string, unknown>): SubscriptionBillingEvent {
  const mode = text(record.mode) as CurrentBillingChangeMode;
  if (!billingModes.has(mode)) throw new Error("A Current Billing event contains an invalid mode.");

  return {
    afterSnapshot: snapshot(record.after_snapshot),
    beforeSnapshot: snapshot(record.before_snapshot),
    changedFields: allowedArray(record.changed_fields, billingFields, "changed fields"),
    classifications: allowedArray(record.classifications, billingClassifications, "classifications"),
    createdAt: text(record.created_at),
    effectiveDate: text(record.effective_date),
    id: text(record.id),
    mode,
    newRecurringComponentId: text(record.new_recurring_component_id),
    previousRecurringComponentId: text(record.previous_recurring_component_id),
    reason: text(record.reason),
    relationshipId: text(record.tool_email_link_id),
    userId: text(record.user_id),
  };
}

export function sortSubscriptionBillingEvents(events: SubscriptionBillingEvent[]) {
  return [...events].sort((left, right) => (
    right.effectiveDate.localeCompare(left.effectiveDate)
    || right.createdAt.localeCompare(left.createdAt)
    || right.id.localeCompare(left.id)
  ));
}

export function replaceRelationshipBillingEvents(
  current: SubscriptionBillingEvent[],
  relationshipId: string,
  refreshed: SubscriptionBillingEvent[],
) {
  const scopedRefresh = refreshed.filter((event) => event.relationshipId === relationshipId);
  return sortSubscriptionBillingEvents([
    ...current.filter((event) => event.relationshipId !== relationshipId),
    ...scopedRefresh,
  ]);
}

export async function getSubscriptionBillingEventsByRelationships(relationshipIds: string[]) {
  const scopedIds = [...new Set(relationshipIds.filter(Boolean))];
  if (!scopedIds.length) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("subscription_billing_events")
    .select("*")
    .in("tool_email_link_id", scopedIds)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const scope = new Set(scopedIds);
  return sortSubscriptionBillingEvents((data ?? [])
    .map((record) => subscriptionBillingEventFromRecord(record as Record<string, unknown>))
    .filter((event) => scope.has(event.relationshipId)));
}

export async function getSubscriptionBillingEventsByRelationship(relationshipId: string) {
  return getSubscriptionBillingEventsByRelationships([relationshipId]);
}
