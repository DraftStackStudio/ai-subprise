import type { BillingAmount } from "@/types/toolDetail";
import type { BillingTransactionType } from "@/types/billingTransaction";
import { addMonthsSafely, validBillingDate } from "@/lib/currentBilling";

export function resolvePaymentDate(component: { billingType: string; paymentDate: string; nextRenewalDate?: string }) {
  if (component.paymentDate) return validBillingDate(component.paymentDate) ? component.paymentDate : "";
  if (!["Monthly", "Yearly"].includes(component.billingType) || !validBillingDate(component.nextRenewalDate ?? "")) return "";
  return addMonthsSafely(component.nextRenewalDate!, component.billingType === "Yearly" ? -12 : -1);
}

// Pure draft defaults, never a payment write. Ambiguous components stay unset.
export function subscriptionPaymentPrefill(components: BillingAmount[], mode: "single" | "period", selectedType?: string) {
  const eligible = components.filter((item) => mode === "single" || ["Monthly", "Yearly"].includes(item.billingType));
  const candidates = selectedType ? eligible.filter((item) => item.billingType === selectedType) : eligible;
  if (candidates.length !== 1) return null;
  const component = candidates[0];
  if (!["Monthly", "Yearly", "Lifetime", "One-time", "Top-up"].includes(component.billingType)) return null;
  const recurring = ["Monthly", "Yearly"].includes(component.billingType);
  const date = recurring ? component.nextRenewalDate : component.billingType === "Top-up" ? component.lastTopUpDate : component.purchaseDate;
  const paymentDate = date && validBillingDate(date) ? recurring ? addMonthsSafely(date, component.billingType === "Yearly" ? -12 : -1) : date : "";
  return { billingType: component.billingType as BillingTransactionType, currency: component.currency, amount: component.amount, paymentDate, nextRenewalDate: recurring ? component.nextRenewalDate ?? "" : "" };
}
