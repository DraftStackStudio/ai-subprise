import type { BillingTransaction } from "@/types/billingTransaction";

export type RecurringBillingSettings = {
  billingType: "Monthly" | "Yearly";
  currency: string;
  amount: string;
  nextRenewalDate: string;
};

export type CurrentPaymentEstimate = RecurringBillingSettings & {
  paymentDate: string;
  sourceKey: string;
};

// Shared with Billing History: clamp the day to the target calendar month's end.
export function addMonthsSafely(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function localBillingToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function validBillingDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function estimateCurrentPayment(relationshipId: string, settings: RecurringBillingSettings, today = localBillingToday()): CurrentPaymentEstimate | null {
  if (!relationshipId || !settings.amount || !/^\d+(\.\d+)?$/.test(settings.amount) || !/^[A-Z]{3}$/.test(settings.currency) || !validBillingDate(settings.nextRenewalDate) || settings.nextRenewalDate <= today) return null;
  const paymentDate = addMonthsSafely(settings.nextRenewalDate, settings.billingType === "Monthly" ? -1 : -12);
  return { ...settings, paymentDate, sourceKey: `current-payment:${relationshipId}:${settings.billingType}:${paymentDate}` };
}

export function hasCurrentPayment(transactions: BillingTransaction[], relationshipId: string, estimate: CurrentPaymentEstimate) {
  return transactions.some((transaction) => transaction.relationshipId === relationshipId && (
    transaction.sourceKey === estimate.sourceKey ||
    (transaction.paymentDate === estimate.paymentDate && transaction.billingTypeSnapshot === estimate.billingType)
  ));
}
