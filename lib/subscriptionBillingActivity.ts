import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import type {
  CurrentBillingComponentSlot,
  CurrentBillingComponentSnapshot,
  CurrentBillingField,
} from "@/types/currentBillingChange";
import type { SubscriptionBillingEvent } from "@/types/subscriptionBillingEvent";

export type SubscriptionBillingActivityItem = {
  date: string;
  details: string[];
  id: string;
  note: string;
  order: number;
  title: string;
};

const componentSlots: CurrentBillingComponentSlot[] = ["primary", "top_up"];

const fieldLabels: Partial<Record<CurrentBillingField, string>> = {
  amount: "Amount",
  billing_type: "Billing type",
  currency: "Currency",
  last_top_up_date: "Last top-up",
  next_renewal_date: "Next renewal",
  purchase_date: "Purchased on",
};

function recordedDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function displayValue(value: string | null | undefined) {
  return value?.trim() || "Not recorded";
}

function displayBillingType(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return value === "Top-up" ? "Top-up credit" : value;
}

function displayAmount(component: CurrentBillingComponentSnapshot | null | undefined) {
  if (!component?.amount?.trim()) return "Not recorded";
  return [component.currency?.trim(), component.amount.trim()].filter(Boolean).join(" ");
}

function fieldValue(component: CurrentBillingComponentSnapshot, field: CurrentBillingField) {
  switch (field) {
    case "billing_type": return displayBillingType(component.billingType);
    case "amount": return displayAmount(component);
    case "currency": return displayValue(component.currency);
    case "next_renewal_date": return component.nextRenewalDate ? billingHistoryDisplayDate(component.nextRenewalDate) : "Not recorded";
    case "purchase_date": return component.purchaseDate ? billingHistoryDisplayDate(component.purchaseDate) : "Not recorded";
    case "last_top_up_date": return component.lastTopUpDate ? billingHistoryDisplayDate(component.lastTopUpDate) : "Not recorded";
    default: return "Not recorded";
  }
}

function componentLabel(
  slot: CurrentBillingComponentSlot,
  before: CurrentBillingComponentSnapshot | undefined,
  after: CurrentBillingComponentSnapshot | undefined,
) {
  if (slot === "top_up") return "Top-up credit";
  return displayBillingType(after?.billingType ?? before?.billingType);
}

function componentConfigurationDetails(event: SubscriptionBillingEvent) {
  return componentSlots.flatMap((slot) => {
    const before = event.beforeSnapshot.components[slot];
    const after = event.afterSnapshot.components[slot];
    if (Boolean(before) === Boolean(after)) return [];
    return [`Billing component: ${displayBillingType(before?.billingType)} → ${displayBillingType(after?.billingType)}`];
  });
}

function componentFieldDetails(event: SubscriptionBillingEvent, field: CurrentBillingField) {
  const label = fieldLabels[field];
  if (!label) return [];
  return componentSlots.flatMap((slot) => {
    const before = event.beforeSnapshot.components[slot];
    const after = event.afterSnapshot.components[slot];
    if (!before || !after) return [];
    const beforeValue = fieldValue(before, field);
    const afterValue = fieldValue(after, field);
    if (beforeValue === afterValue) return [];
    return [`${componentLabel(slot, before, after)} ${label.toLowerCase()}: ${beforeValue} → ${afterValue}`];
  });
}

function changeDetails(event: SubscriptionBillingEvent) {
  return event.changedFields.flatMap((field) => {
    if (field === "plan_name") {
      return [`Plan: ${displayValue(event.beforeSnapshot.planName)} → ${displayValue(event.afterSnapshot.planName)}`];
    }
    if (field === "component_configuration") return componentConfigurationDetails(event);
    return componentFieldDetails(event, field);
  });
}

function billingActivityTitle(event: SubscriptionBillingEvent) {
  if (event.mode === "correction") return "Current Billing corrected";
  const isInitialSetup = Object.keys(event.beforeSnapshot.components).length === 0
    && Object.keys(event.afterSnapshot.components).length > 0
    && event.classifications.includes("component_added");
  return isInitialSetup ? "Current Billing set up" : "Current Billing changed";
}

export function subscriptionBillingActivityItems(
  events: readonly SubscriptionBillingEvent[],
  relationshipId: string,
): SubscriptionBillingActivityItem[] {
  const seenEventIds = new Set<string>();
  return events.flatMap((event) => {
    if (event.relationshipId !== relationshipId || !event.id || seenEventIds.has(event.id)) return [];
    seenEventIds.add(event.id);
    return [{
      date: event.effectiveDate,
      details: [
        ...changeDetails(event),
        `Effective: ${billingHistoryDisplayDate(event.effectiveDate)}`,
        `Recorded: ${recordedDateTime(event.createdAt)}`,
      ],
      id: `current-billing-${event.id}`,
      note: event.reason.trim(),
      order: new Date(event.createdAt).getTime() || 0,
      title: billingActivityTitle(event),
    }];
  });
}
