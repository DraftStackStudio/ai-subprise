import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import type { BillingHistoryEntry } from "@/types/billingHistory";
import type { SubscriptionLifecycleEvent } from "@/types/subscriptionLifecycleEvent";

function optionalSnapshot(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function pauseLifecycleHistoryEntries(
  events: SubscriptionLifecycleEvent[],
  relationshipId: string,
): BillingHistoryEntry[] {
  const seenEventIds = new Set<string>();

  return events.flatMap((event): BillingHistoryEntry[] => {
    if (
      event.relationshipId !== relationshipId ||
      event.eventKind !== "paused" ||
      !event.id ||
      !event.effectiveDate ||
      seenEventIds.has(event.id)
    ) return [];

    seenEventIds.add(event.id);
    const reason = optionalSnapshot(event.reason);
    const plannedResume = event.plannedResumeDate
      ? `Planned resume: ${billingHistoryDisplayDate(event.plannedResumeDate)}`
      : undefined;

    return [{
      amount: optionalSnapshot(event.amountSnapshot),
      billingType: optionalSnapshot(event.billingTypeSnapshot),
      currency: optionalSnapshot(event.currencySnapshot),
      date: event.effectiveDate,
      event: "Paused",
      id: `lifecycle-pause-${event.id}`,
      note: [reason, plannedResume].filter(Boolean).join(" · "),
      planName: optionalSnapshot(event.planNameSnapshot) ?? optionalSnapshot(event.previousPlanName),
      saved: true,
      source: "generated",
    }];
  });
}

export function mergePauseLifecycleHistory(
  existingEntries: BillingHistoryEntry[],
  events: SubscriptionLifecycleEvent[],
  relationshipId: string,
) {
  const pauseEntries = pauseLifecycleHistoryEntries(events, relationshipId);
  const ledgerPauseDates = new Set(pauseEntries.map((entry) => entry.date));
  const nonDuplicateExistingEntries = existingEntries.filter((entry) => (
    entry.event !== "Paused" || !ledgerPauseDates.has(entry.date)
  ));

  return [...nonDuplicateExistingEntries, ...pauseEntries];
}
