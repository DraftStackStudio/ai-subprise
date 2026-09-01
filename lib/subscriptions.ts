import type { BillingAmount } from "@/types/toolDetail";
import type { BillingHistoryEntry } from "@/types/billingHistory";
import { validBillingDate } from "@/lib/currentBilling";

export function validSubscriptionBillingTypes(values: string[]) {
  return values.length <= 2 && new Set(values).size === values.length
    && values.every((value) => ["Monthly", "Yearly", "Lifetime", "One-time", "Top-up"].includes(value))
    && values.filter((value) => value !== "Top-up").length <= 1;
}

// Current configuration only; never produces payment/history writes.
export function subscriptionBillingPatch(planName: string, draft: BillingAmount[]) {
  if (!validSubscriptionBillingTypes(draft.map((item) => item.billingType))) throw new Error("Select one main billing type and optionally Top-up credit (maximum two types).");
  const seen = new Set<string>();
  const billingAmounts = draft.map((item) => {
    if (!["Monthly", "Yearly", "Lifetime", "One-time", "Top-up"].includes(item.billingType)) throw new Error("Select a billing type for each component.");
    const recurring = ["Monthly", "Yearly"].includes(item.billingType);
    const key = recurring ? "recurring" : item.billingType;
    if (seen.has(key)) throw new Error("This billing component is already configured. Edit the existing component instead.");
    seen.add(key);
    const amount = item.amount.trim();
    const currency = item.currency.trim().toUpperCase();
    if (amount && !/^\d+(\.\d+)?$/.test(amount)) throw new Error("Enter an amount of zero or greater.");
    if (currency && !/^[A-Z]{3}$/.test(currency)) throw new Error("Select a valid currency.");
    const date = recurring ? item.nextRenewalDate : item.billingType === "Top-up" ? item.lastTopUpDate : item.purchaseDate;
    if (date && !validBillingDate(date)) throw new Error("Enter a valid billing date.");
    return { id: item.id || crypto.randomUUID(), billingType: item.billingType, currency, amount,
      nextRenewalDate: recurring ? date || "" : "",
      purchaseDate: ["Lifetime", "One-time"].includes(item.billingType) ? date || "" : "",
      lastTopUpDate: item.billingType === "Top-up" ? date || "" : "" };
  });
  return { planName: planName.trim(), billingAmounts, billingType: billingAmounts.map((item) => item.billingType).join(", "),
    amount: billingAmounts[0]?.amount ?? "", currency: billingAmounts[0]?.currency ?? "",
    nextChargeDate: billingAmounts.find((item) => ["Monthly", "Yearly"].includes(item.billingType))?.nextRenewalDate ?? "",
    purchaseDate: billingAmounts.find((item) => ["Lifetime", "One-time"].includes(item.billingType))?.purchaseDate ?? "",
    lastTopUpDate: billingAmounts.find((item) => item.billingType === "Top-up")?.lastTopUpDate ?? "" };
}

export function qualifiesForSubscriptions(relationship: {
  relationshipId: string;
  plan: string;
  trialResolved?: boolean;
  trialResolution?: string;
  trialResolutionHistory?: { outcome: string }[];
  billingHistoryEntries?: BillingHistoryEntry[];
}, transactionRelationshipIds: ReadonlySet<string>) {
  if (!relationship.relationshipId) return false;
  if (relationship.plan === "Active" || relationship.plan === "Paid" || transactionRelationshipIds.has(relationship.relationshipId)) return true;
  // Resolution history is append-only in the existing flow; a correction must
  // supersede an earlier conversion rather than treating any old entry as proof.
  const latestOutcome = relationship.trialResolutionHistory?.at(-1)?.outcome;
  if (latestOutcome) return latestOutcome === "converted";
  if (relationship.trialResolution === "ended") return false;
  if (relationship.trialResolved && relationship.trialResolution === "converted") return true;
  return relationship.billingHistoryEntries?.some((entry) => entry.saved === true && entry.event === "Trial Converted to Paid") ?? false;
}

export type SubscriptionState = "Not started" | "Incomplete" | "Complete";

// A selected type can exist before a normalized billing component is saved.
// Represent that selection without borrowing amounts or dates from another component.
export function subscriptionComponents(components: BillingAmount[] = [], selectedTypes = ""): BillingAmount[] {
  const configured = components.filter((component) => component.billingType.trim());
  const missingTypes = [...new Set(selectedTypes.split(",").map((type) => type.trim()).filter(Boolean))]
    .filter((type) => !configured.some((component) => component.billingType === type));
  return [...configured, ...missingTypes.map((billingType) => ({ id: "", billingType, currency: "", amount: "" }))];
}

export function subscriptionState(components: BillingAmount[]): SubscriptionState {
  if (!components.length) return "Not started";
  return components.every((component) => {
    const date = component.billingType === "Monthly" || component.billingType === "Yearly"
      ? component.nextRenewalDate
      : component.billingType === "Lifetime" || component.billingType === "One-time"
        ? component.purchaseDate
        : component.billingType === "Top-up" ? component.lastTopUpDate : undefined;
    return Boolean(component.currency.trim() && component.amount.trim() && date?.trim());
  }) ? "Complete" : "Incomplete";
}

export function subscriptionBillingSummary(components: BillingAmount[]) {
  return components.map((component) => {
    const amount = component.currency.trim() && component.amount.trim()
      ? `${component.currency.trim()}${component.amount.trim()}` : "";
    return [component.billingType, amount].filter(Boolean).join(" · ");
  });
}
