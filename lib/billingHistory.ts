import type {
  BillingHistoryEntry,
  BillingHistoryEvent,
} from "@/types/billingHistory";

export function billingHistoryDisplayDate(value: string) {
  if (!value || value === "—") return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function billingHistoryDisplayAmount(entry: BillingHistoryEntry) {
  if (!entry.amount) return "—";
  if (entry.source !== "manual") return entry.amount;

  const currency = entry.currency?.trim().toUpperCase() || "USD";
  return `${currency} ${entry.amount}`;
}

export function updateGeneratedBillingHistoryNote(
  current: Record<string, string>,
  recordKey: string,
  entryId: string,
  note: string,
) {
  return {
    ...current,
    [`${recordKey}::${entryId}`]: note,
  };
}

export function updateManualBillingHistoryNote(
  current: Record<string, BillingHistoryEntry[]>,
  recordKey: string,
  entryId: string,
  note: string,
) {
  return {
    ...current,
    [recordKey]: (current[recordKey] ?? []).map((item) => (
      item.id === entryId ? { ...item, note, saved: false } : item
    )),
  };
}

export function pendingResolutionOptions(entry: BillingHistoryEntry): BillingHistoryEvent[] {
  if (entry.event === "Double Charged") return ["Charged", "Refunded"];
  return ["Charged", "Refunded", "Plan Changed", "Cancelled"];
}

export function createPendingResolutionEntry(
  entry: BillingHistoryEntry,
  outcome: BillingHistoryEvent,
  date: string,
): BillingHistoryEntry {
  return {
    amount: entry.amount,
    billingType: entry.billingType,
    currency: entry.currency,
    date,
    event: outcome,
    id: `resolution-${entry.id}-${Date.now()}`,
    note: `Resolved ${entry.event}`,
    planName: entry.planName,
    resolvesEntryId: entry.id,
    saved: true,
    source: "manual",
  };
}
