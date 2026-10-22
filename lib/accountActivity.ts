import type { BillingHistoryEntry } from "@/types/billingHistory";
import type { BillingRenewalActivity, BillingRenewalPeriod } from "@/types/billingRenewalPeriod";
import type { BillingTransaction } from "@/types/billingTransaction";
import type {
  CurrentBillingComparison,
  CurrentBillingComponentSlot,
  CurrentBillingComponentSnapshot,
  CurrentBillingField,
} from "@/types/currentBillingChange";
import type { SubscriptionBillingEvent } from "@/types/subscriptionBillingEvent";
import type { SubscriptionLifecycleEvent } from "@/types/subscriptionLifecycleEvent";

export type AccountActivitySource =
  | "current_billing"
  | "historical_subscription_period"
  | "legacy_history"
  | "renewal_period"
  | "renewal_update"
  | "subscription_lifecycle";

export type AccountActivityCorrectionDetail = {
  after: string;
  before: string;
  field: CurrentBillingField;
  label: string;
};

export type AccountActivityItem = {
  correctionDetails?: AccountActivityCorrectionDetail[];
  details: string[];
  effectiveDate: string;
  explanation?: string;
  id: string;
  note: string;
  recordedAt: string | null;
  relationshipId: string;
  source: AccountActivitySource;
  title: string;
};

export type AccountActivityDateGroup = {
  effectiveDate: string;
  items: AccountActivityItem[];
};

export type BuildAccountActivityInput = {
  billingEvents?: readonly SubscriptionBillingEvent[];
  historicalEntries?: readonly BillingHistoryEntry[];
  lifecycleEvents?: readonly SubscriptionLifecycleEvent[];
  relationshipId: string;
  renewalActivities?: readonly BillingRenewalActivity[];
  renewalPeriods?: readonly BillingRenewalPeriod[];
  transactions?: readonly BillingTransaction[];
};

const componentSlots: CurrentBillingComponentSlot[] = ["primary", "top_up"];
const recurringTypes = new Set(["Monthly", "Yearly"]);
const amountClassifications = new Set([
  "price_increased", "price_decreased", "amount_changed", "amount_recorded", "amount_cleared",
]);
const historicalPeriodKey = /^subscription-period:([^:]+):(Monthly|Yearly):(\d{4}-\d{2}-\d{2})$/;

const fieldLabels: Partial<Record<CurrentBillingField, string>> = {
  amount: "Price",
  billing_type: "Billing type",
  currency: "Currency",
  last_top_up_date: "Last top-up",
  next_renewal_date: "Renewal date",
  plan_name: "Plan",
  purchase_date: "Purchase date",
};

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function recordedDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function accountActivityRecordedDateValue(item: Pick<AccountActivityItem, "effectiveDate" | "recordedAt">) {
  const date = recordedDate(item.recordedAt);
  if (!date) return "Not recorded";
  return date === item.effectiveDate ? "—" : date;
}

function displayValue(value: string | null | undefined) {
  return value?.trim() || "Not recorded";
}

function displayBillingType(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return value === "Top-up" ? "Top-up credit" : value;
}

function displayAmount(currency: string | null | undefined, amount: string | null | undefined) {
  if (!amount?.trim()) return "Not recorded";
  return [currency?.trim(), amount.trim()].filter(Boolean).join(" ");
}

function componentLabel(
  slot: CurrentBillingComponentSlot,
  before?: CurrentBillingComponentSnapshot,
  after?: CurrentBillingComponentSnapshot,
) {
  if (slot === "top_up") return "Top-up credit";
  return displayBillingType(after?.billingType ?? before?.billingType);
}

function componentFieldValue(component: CurrentBillingComponentSnapshot, field: CurrentBillingField) {
  switch (field) {
    case "billing_type": return displayBillingType(component.billingType);
    case "amount": return displayAmount(component.currency, component.amount);
    case "currency": return displayValue(component.currency);
    case "next_renewal_date": return displayValue(component.nextRenewalDate);
    case "purchase_date": return displayValue(component.purchaseDate);
    case "last_top_up_date": return displayValue(component.lastTopUpDate);
    default: return "Not recorded";
  }
}

function currentBillingTitle(event: SubscriptionBillingEvent) {
  if (event.mode === "correction") return "Current Billing corrected";
  const isInitialSetup = Object.keys(event.beforeSnapshot.components).length === 0
    && Object.keys(event.afterSnapshot.components).length > 0
    && event.classifications.includes("component_added");
  if (isInitialSetup) return "Current Billing set up";
  if (event.classifications.includes("plan_changed")) return "Plan changed";
  if (event.classifications.includes("billing_cycle_changed")) return "Billing cycle changed";
  if (event.classifications.includes("billing_type_changed")
    || event.classifications.includes("component_added")
    || event.classifications.includes("component_removed")) return "Billing type changed";
  if (event.classifications.some((classification) => amountClassifications.has(classification))) return "Price changed";
  if (event.classifications.includes("renewal_date_changed")) return "Renewal date changed";
  return "Current Billing changed";
}

function currentBillingChanges(event: SubscriptionBillingEvent) {
  const details: string[] = [];
  const corrections: AccountActivityCorrectionDetail[] = [];
  const add = (field: CurrentBillingField, label: string, before: string, after: string) => {
    if (before === after) return;
    details.push(`${label}: ${before} → ${after}`);
    corrections.push({ after, before, field, label });
  };

  if (event.changedFields.includes("plan_name")) {
    add("plan_name", "Plan", displayValue(event.beforeSnapshot.planName), displayValue(event.afterSnapshot.planName));
  }

  for (const slot of componentSlots) {
    const before = event.beforeSnapshot.components[slot];
    const after = event.afterSnapshot.components[slot];
    if (Boolean(before) !== Boolean(after)) {
      add(
        "component_configuration",
        slot === "top_up" ? "Top-up credit" : "Billing type",
        displayBillingType(before?.billingType),
        displayBillingType(after?.billingType),
      );
      continue;
    }
    if (!before || !after) continue;
    for (const field of event.changedFields) {
      if (field === "plan_name" || field === "component_configuration") continue;
      const label = fieldLabels[field];
      if (!label) continue;
      const scopedLabel = slot === "primary" ? label : `${componentLabel(slot, before, after)} ${label.toLowerCase()}`;
      add(field, scopedLabel, componentFieldValue(before, field), componentFieldValue(after, field));
    }
  }
  return { corrections, details };
}

function correctedValueSummary(event: SubscriptionBillingEvent) {
  const planSummary = event.changedFields.includes("plan_name")
    ? [`Plan: ${displayValue(event.afterSnapshot.planName)}`]
    : [];
  const componentSummaries = componentSlots.flatMap((slot) => {
    const component = event.afterSnapshot.components[slot];
    if (!component) return [];
    const values = [
      displayBillingType(component.billingType),
      displayAmount(component.currency, component.amount),
    ];
    return [values.join(" · ")];
  });
  return [...planSummary, ...componentSummaries];
}

export function currentBillingAccountActivityItems(
  events: readonly SubscriptionBillingEvent[],
  relationshipId: string,
  renewalPeriods: readonly BillingRenewalPeriod[] = [],
) {
  const seen = new Set<string>();
  return events.flatMap((event): AccountActivityItem[] => {
    if (event.relationshipId !== relationshipId || !event.id || seen.has(event.id) || !validDate(event.effectiveDate)) return [];
    seen.add(event.id);
    const changes = currentBillingChanges(event);
    const supersededPeriodIds = new Set(renewalPeriods.flatMap((period) => (
      period.relationshipId === relationshipId
        && period.excludedByBillingEventId === event.id
        && Boolean(period.excludedAt)
        && period.resolution === null
        && period.id
        ? [period.id]
        : []
    )));
    const supersededPeriodCount = supersededPeriodIds.size;
    return [{
      correctionDetails: event.mode === "correction" ? changes.corrections : undefined,
      details: event.mode === "correction" ? correctedValueSummary(event) : changes.details,
      effectiveDate: event.effectiveDate,
      explanation: supersededPeriodCount
        ? `${supersededPeriodCount} unresolved renewal ${supersededPeriodCount === 1 ? "period was" : "periods were"} superseded by this billing change and ${supersededPeriodCount === 1 ? "is" : "are"} no longer awaiting review.`
        : undefined,
      id: `current-billing-${event.id}`,
      note: event.reason.trim(),
      recordedAt: event.createdAt || null,
      relationshipId,
      source: "current_billing",
      title: currentBillingTitle(event),
    }];
  });
}

export function currentBillingComparisonActivityItem(
  comparison: CurrentBillingComparison,
  relationshipId: string,
) {
  return currentBillingAccountActivityItems([{
    afterSnapshot: comparison.after,
    beforeSnapshot: comparison.before,
    changedFields: [...new Set(comparison.fieldChanges.map(({ field }) => field))],
    classifications: comparison.classifications,
    createdAt: "",
    effectiveDate: comparison.effectiveDate,
    id: "preview",
    mode: comparison.mode,
    newRecurringComponentId: "",
    previousRecurringComponentId: "",
    reason: "",
    relationshipId,
    userId: "",
  }], relationshipId)[0] ?? null;
}

const notChargedReasonLabels = {
  cancelled_subscription: "Cancelled subscription",
  payment_failed: "Payment failed",
  paused: "Paused / on a break",
  free_or_waived: "Free / waived",
  other: "Other",
} as const;

function subscriptionPeriodDetails(
  planName: string,
  billingType: string,
  currency: string,
  amount: string,
) {
  return [planName.trim(), billingType.trim(), displayAmount(currency, amount)]
    .filter((value) => value && value !== "Not recorded");
}

export function renewalPeriodAccountActivityItems(
  periods: readonly BillingRenewalPeriod[],
  relationshipId: string,
) {
  const seen = new Set<string>();
  return periods.flatMap((period): AccountActivityItem[] => {
    const effectiveDate = period.billingDate || period.scheduledRenewalDate;
    if (period.relationshipId !== relationshipId || !period.id || seen.has(period.id)
      || !validDate(effectiveDate) || !period.resolvedAt || !period.resolution) return [];
    if (period.resolution === "paid" && !period.paymentTransactionId) return [];
    seen.add(period.id);
    const reason = period.notChargedReasonCode === "other"
      ? period.notChargedReasonText.trim()
      : period.notChargedReasonCode ? notChargedReasonLabels[period.notChargedReasonCode] : "";
    return [{
      details: subscriptionPeriodDetails(
        period.planNameSnapshot,
        period.billingTypeSnapshot,
        period.currencySnapshot,
        period.amountSnapshot,
      ),
      effectiveDate,
      id: `renewal-period-${period.id}`,
      note: period.resolution === "not_charged" ? [reason, period.notChargedNote.trim()].filter(Boolean).join(" · ") : "",
      recordedAt: period.resolvedAt,
      relationshipId,
      source: "renewal_period",
      title: period.resolution === "paid" ? "Subscription period — Paid" : "Subscription period — Not charged",
    }];
  });
}

export function historicalSubscriptionPeriodActivityItems(
  transactions: readonly BillingTransaction[],
  relationshipId: string,
  excludedTransactionIds: ReadonlySet<string> = new Set(),
) {
  const seen = new Set<string>();
  return transactions.flatMap((transaction): AccountActivityItem[] => {
    const match = transaction.sourceKey.match(historicalPeriodKey);
    if (transaction.relationshipId !== relationshipId || transaction.source !== "manual" || transaction.status !== "Paid"
      || !match || match[1] !== relationshipId || match[2] !== transaction.billingTypeSnapshot
      || match[3] !== transaction.paymentDate || !recurringTypes.has(transaction.billingTypeSnapshot)
      || !validDate(transaction.paymentDate) || !transaction.id || seen.has(transaction.id)
      || excludedTransactionIds.has(transaction.id)) return [];
    seen.add(transaction.id);
    return [{
      details: subscriptionPeriodDetails(
        transaction.planNameSnapshot,
        transaction.billingTypeSnapshot,
        transaction.currency,
        transaction.amount,
      ),
      effectiveDate: transaction.paymentDate,
      id: `historical-subscription-period-${transaction.id}`,
      note: transaction.note.trim(),
      recordedAt: transaction.createdAt || null,
      relationshipId,
      source: "historical_subscription_period",
      title: "Subscription period — Paid",
    }];
  });
}

const lifecycleTitles = {
  ended: "Subscription cancelled",
  paused: "Subscription paused",
  restarted: "Subscription restarted",
  restarted_plan_changed: "Subscription restarted",
  resumed: "Subscription resumed",
} as const;

export function lifecycleAccountActivityItems(
  events: readonly SubscriptionLifecycleEvent[],
  relationshipId: string,
) {
  const seen = new Set<string>();
  return events.flatMap((event): AccountActivityItem[] => {
    if (event.relationshipId !== relationshipId || !event.id || seen.has(event.id) || !validDate(event.effectiveDate)) return [];
    seen.add(event.id);
    const details = subscriptionPeriodDetails(
      event.planNameSnapshot || event.previousPlanName,
      event.billingTypeSnapshot,
      event.currencySnapshot,
      event.amountSnapshot,
    );
    if (event.eventKind === "resumed" && event.nextRenewalDateSnapshot) details.push(`Next renewal: ${event.nextRenewalDateSnapshot}`);
    if (event.eventKind === "paused" && event.plannedResumeDate) details.push(`Planned resume: ${event.plannedResumeDate}`);
    return [{
      details,
      effectiveDate: event.effectiveDate,
      id: `subscription-lifecycle-${event.id}`,
      note: event.reason.trim(),
      recordedAt: event.createdAt || null,
      relationshipId,
      source: "subscription_lifecycle",
      title: lifecycleTitles[event.eventKind],
    }];
  });
}

export function renewalUpdateAccountActivityItems(
  activities: readonly BillingRenewalActivity[],
  periods: readonly BillingRenewalPeriod[],
  relationshipId: string,
) {
  const periodsById = new Map(periods.map((period) => [period.id, period]));
  const seen = new Set<string>();
  return activities.flatMap((activity): AccountActivityItem[] => {
    const period = periodsById.get(activity.periodId);
    const effectiveDate = period?.scheduledRenewalDate || activity.billingDate || activity.activityDate;
    if (activity.relationshipId !== relationshipId || !activity.id || seen.has(activity.id) || !validDate(effectiveDate)) return [];
    seen.add(activity.id);
    return [{
      details: activity.kind === "billing_schedule_changed"
        ? [`Billing date: ${activity.previousBillingDate} → ${activity.billingDate}`]
        : subscriptionPeriodDetails(activity.planNameSnapshot, activity.billingTypeSnapshot, activity.currencySnapshot, activity.amountSnapshot),
      effectiveDate,
      id: `renewal-update-${activity.id}`,
      note: activity.note.trim(),
      recordedAt: activity.createdAt || null,
      relationshipId,
      source: "renewal_update",
      title: activity.kind === "billing_schedule_changed" ? "Billing date updated" : "Billing details updated",
    }];
  });
}

const legacyTitles: Partial<Record<BillingHistoryEntry["event"], string>> = {
  Cancelled: "Subscription cancelled",
  "Plan Changed": "Plan changed",
  Restarted: "Subscription restarted",
};

export function legacyAccountActivityItems(
  entries: readonly BillingHistoryEntry[],
  relationshipId: string,
  structuredLifecycleKeys: ReadonlySet<string> = new Set(),
) {
  const seen = new Set<string>();
  return entries.flatMap((entry): AccountActivityItem[] => {
    if (!entry.saved || !entry.id || seen.has(entry.id) || !validDate(entry.date)
      || entry.event === "Charged" || entry.event === "Refunded" || entry.event === "Double Charged"
      || structuredLifecycleKeys.has(`${entry.event}:${entry.date}`)) return [];
    seen.add(entry.id);
    return [{
      details: [entry.planName, entry.billingType, displayAmount(entry.currency, entry.amount)]
        .filter((value): value is string => Boolean(value && value !== "Not recorded")),
      effectiveDate: entry.date,
      id: `legacy-history-${entry.id}`,
      note: entry.note?.trim() ?? "",
      recordedAt: null,
      relationshipId,
      source: "legacy_history",
      title: legacyTitles[entry.event] ?? entry.event,
    }];
  });
}

function itemOrder(left: AccountActivityItem, right: AccountActivityItem) {
  return (right.recordedAt ?? "").localeCompare(left.recordedAt ?? "") || left.id.localeCompare(right.id);
}

export function groupAccountActivityByEffectiveDate(items: readonly AccountActivityItem[]) {
  const groups = new Map<string, AccountActivityItem[]>();
  items.forEach((item) => groups.set(item.effectiveDate, [...(groups.get(item.effectiveDate) ?? []), item]));
  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([effectiveDate, groupedItems]): AccountActivityDateGroup => ({
      effectiveDate,
      items: [...groupedItems].sort(itemOrder),
    }));
}

export function buildAccountActivityReadModel(input: BuildAccountActivityInput) {
  const renewalPeriods = input.renewalPeriods ?? [];
  const lifecycleItems = lifecycleAccountActivityItems(input.lifecycleEvents ?? [], input.relationshipId);
  const structuredLifecycleKeys = new Set(lifecycleItems.map((item) => {
    const legacyEvent = item.title === "Subscription paused" ? "Paused"
      : item.title === "Subscription resumed" ? "Resumed"
        : item.title === "Subscription restarted" ? "Restarted"
          : item.title === "Subscription cancelled" ? "Cancelled" : item.title;
    return `${legacyEvent}:${item.effectiveDate}`;
  }));
  const linkedRenewalTransactionIds = new Set(renewalPeriods.map((period) => period.paymentTransactionId).filter(Boolean));
  const items = [
    ...currentBillingAccountActivityItems(input.billingEvents ?? [], input.relationshipId, renewalPeriods),
    ...renewalPeriodAccountActivityItems(renewalPeriods, input.relationshipId),
    ...historicalSubscriptionPeriodActivityItems(input.transactions ?? [], input.relationshipId, linkedRenewalTransactionIds),
    ...renewalUpdateAccountActivityItems(input.renewalActivities ?? [], renewalPeriods, input.relationshipId),
    ...lifecycleItems,
    ...legacyAccountActivityItems(input.historicalEntries ?? [], input.relationshipId, structuredLifecycleKeys),
  ];
  const seen = new Set<string>();
  return groupAccountActivityByEffectiveDate(items.filter((item) => {
    const key = `${item.source}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}
