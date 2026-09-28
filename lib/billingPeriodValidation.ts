import { localBillingToday, validBillingDate } from "@/lib/currentBilling";
import { validSubscriptionBillingTypes } from "@/lib/subscriptions";

type PaymentFields = { amount: string; currency: string; billingType: string; status: string; paymentDate: string };
export type BillingFieldErrors = Partial<Record<keyof PaymentFields | "startDate" | "nextRenewalDate" | "rows", string>>;

export function optionalPaymentAmountError(value: string) {
  const amount = value.trim();
  if (!amount) return "";
  if (!/^\d+(\.\d+)?$/.test(amount)) return "Enter an amount of zero or greater.";
  // billing_transactions.amount is numeric(18, 6).
  const [whole, fraction = ""] = amount.split(".");
  const integer = whole.replace(/^0+/, "") || "0";
  if (integer.length > 12 || (integer === "999999999999" && fraction.startsWith("999999") && Number(fraction[6] ?? "0") >= 5)) return "Enter an amount below 1,000,000,000,000.";
  return "";
}

function sharedErrors(fields: Pick<PaymentFields, "amount" | "currency" | "status">, requireCurrency: boolean): BillingFieldErrors {
  const errors: BillingFieldErrors = {};
  const currency = fields.currency.trim().toUpperCase();
  if (requireCurrency && !currency) errors.currency = "Select a currency.";
  else if (currency && !/^[A-Z]{3}$/.test(currency)) errors.currency = "Currency must be a three-letter ISO code.";
  const amount = optionalPaymentAmountError(fields.amount);
  if (amount) errors.amount = amount;
  if (!["Paid", "Pending", "Failed", "Refunded"].includes(fields.status)) errors.status = "Select a valid payment status.";
  return errors;
}

export function periodHeaderErrors(fields: Omit<PaymentFields, "paymentDate"> & { startDate: string }, nextRenewalDate: string, requireCurrency: boolean, today = localBillingToday(), currentBillingTypes: string[] = []): BillingFieldErrors {
  const errors = sharedErrors(fields, requireCurrency);
  if (!["Monthly", "Yearly"].includes(fields.billingType)) errors.billingType = "Select Monthly or Yearly billing type.";
  else if (requireCurrency && !validSubscriptionBillingTypes([...new Set([...currentBillingTypes.filter(Boolean), fields.billingType])])) errors.billingType = "Current Billing already has another main billing type. Choose its billing type or update Current Billing first.";
  if (!validBillingDate(fields.startDate)) errors.startDate = "Enter a valid Start Date.";
  else if (fields.startDate > today) errors.startDate = "Start Date must be today or earlier to generate payments.";
  if (!validBillingDate(nextRenewalDate)) errors.nextRenewalDate = "Enter a valid Next renewal date.";
  else if (validBillingDate(fields.startDate) && fields.startDate >= nextRenewalDate) errors.nextRenewalDate = "Next renewal must be after Start Date.";
  return errors;
}

export function periodPaymentErrors(fields: PaymentFields, requireCurrency: boolean, today = localBillingToday()): BillingFieldErrors {
  const errors = sharedErrors(fields, requireCurrency);
  if (!validBillingDate(fields.paymentDate)) errors.paymentDate = "Enter a valid Payment Date.";
  else if (fields.paymentDate > today) errors.paymentDate = "Payment Date must be today or earlier.";
  // Historical transaction type may be unknown; a supplied type must be supported.
  if (fields.billingType && !["Monthly", "Yearly", "Lifetime", "One-time", "Top-up"].includes(fields.billingType)) errors.billingType = "Select a valid billing type.";
  return errors;
}
