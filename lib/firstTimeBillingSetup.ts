import type { BillingAmount } from "@/types/toolDetail";
import { validSubscriptionBillingTypes } from "@/lib/subscriptions";
import { validBillingDate } from "@/lib/currentBilling";

type SetupPayment = { billingType: string; currency: string; amount: string; paymentDate: string; nextRenewalDate?: string };

export function firstTimeBillingComponents(payments: SetupPayment[]): BillingAmount[] {
  if (!payments.length || !validSubscriptionBillingTypes(payments.map((item) => item.billingType))) throw new Error("Choose one main billing type and optionally Top-up credit (maximum two).");
  return payments.map((item) => {
    if (!item.currency.trim() || !/^[A-Z]{3}$/.test(item.currency.trim().toUpperCase())) throw new Error("Select a currency for Current Billing.");
    if (!/^\d+(\.\d+)?$/.test(item.amount.trim())) throw new Error("Enter an amount of zero or greater for Current Billing.");
    if (!validBillingDate(item.paymentDate)) throw new Error("Enter a valid payment date.");
    const recurring = item.billingType === "Monthly" || item.billingType === "Yearly";
    if (recurring && !validBillingDate(item.nextRenewalDate ?? "")) throw new Error("Enter Next renewal for Current Billing.");
    return { id: "", billingType: item.billingType, currency: item.currency.trim().toUpperCase(), amount: item.amount.trim(),
      nextRenewalDate: recurring ? item.nextRenewalDate : "",
      purchaseDate: item.billingType === "Lifetime" || item.billingType === "One-time" ? item.paymentDate : "",
      lastTopUpDate: item.billingType === "Top-up" ? item.paymentDate : "" };
  });
}
