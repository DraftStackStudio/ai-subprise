import { addMonthsSafely, validBillingDate } from "@/lib/currentBilling";
import { optionalPaymentAmountError } from "@/lib/billingPeriodValidation";
import type { SubscriptionLifecycleEvent } from "@/types/subscriptionLifecycleEvent";
import type { BillingTransaction } from "@/types/billingTransaction";

export type ResumeBillingType = "Monthly" | "Yearly";
export type ResumeNextRenewalMode = "suggested" | "manual" | "unknown";
export type ResumeChargeAnswer = "yes" | "no" | "unknown";

export type ResumeSubscriptionDraft = {
  amount: string;
  billingType: ResumeBillingType | "";
  chargeAnswer: ResumeChargeAnswer;
  currency: string;
  nextRenewalDate: string;
  nextRenewalConfirmed: boolean;
  nextRenewalMode: ResumeNextRenewalMode;
};

export type ResumePaymentInput = {
  amount: string;
  billingType: ResumeBillingType;
  currency: string;
  paymentDate: string;
  planName: string;
};

export type ResumeSubscriptionInput = {
  amount: string;
  billingType: ResumeBillingType;
  currency: string;
  nextRenewalDate: string | null;
  nextRenewalUnknown: boolean;
};

export type ResumeSubscriptionErrors = Partial<Record<
  "amount" | "billingType" | "currency" | "nextRenewalDate",
  string
>>;

export type ResumePaymentErrors = Partial<Record<"amount" | "currency" | "paymentDate", string>>;

export function currentPauseEventForResume(events: SubscriptionLifecycleEvent[] = [], relationshipId: string) {
  const latest = events
    .filter((event) => event.relationshipId === relationshipId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))[0];
  return latest?.eventKind === "paused" && latest.previousBillingComponentId ? latest : null;
}

export function canResumeSubscription(input: {
  canManageBilling: boolean;
  lifecycleStatus: string;
  planStatus: string;
  retiredBillingType: string;
  retiredComponentId: string;
}) {
  return input.canManageBilling
    && input.lifecycleStatus === "Paused"
    && (input.planStatus === "Active" || input.planStatus === "Paid")
    && Boolean(input.retiredComponentId)
    && (input.retiredBillingType === "Monthly" || input.retiredBillingType === "Yearly");
}

export function suggestedResumeNextRenewalDate(today: string, billingType: ResumeBillingType) {
  if (!validBillingDate(today)) return "";
  return addMonthsSafely(today, billingType === "Monthly" ? 1 : 12);
}

export function changeResumeBillingFrequency(
  draft: ResumeSubscriptionDraft,
  billingType: ResumeBillingType,
  today: string,
): ResumeSubscriptionDraft {
  return {
    ...draft,
    billingType,
    nextRenewalDate: draft.nextRenewalMode === "suggested"
      ? suggestedResumeNextRenewalDate(today, billingType)
      : draft.nextRenewalDate,
    nextRenewalConfirmed: draft.nextRenewalMode === "suggested" ? false : draft.nextRenewalConfirmed,
  };
}

export function validateResumeSubscriptionDraft(draft: ResumeSubscriptionDraft, today: string) {
  const errors: ResumeSubscriptionErrors = {};
  const amount = draft.amount.trim();
  const currency = draft.currency.trim().toUpperCase();
  const nextRenewalUnknown = draft.nextRenewalMode === "unknown";

  if (draft.billingType !== "Monthly" && draft.billingType !== "Yearly") {
    errors.billingType = "Select Monthly or Yearly billing.";
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.currency = "Select a three-letter currency.";
  }
  const amountError = optionalPaymentAmountError(amount);
  if (amountError) errors.amount = amountError;

  if (!nextRenewalUnknown) {
    if (!validBillingDate(draft.nextRenewalDate)) {
      errors.nextRenewalDate = "Confirm a valid next renewal date or select Unknown.";
    } else if (draft.nextRenewalDate <= today) {
      errors.nextRenewalDate = "The next renewal date must be later than today.";
    } else if (draft.nextRenewalMode === "suggested" && !draft.nextRenewalConfirmed) {
      errors.nextRenewalDate = "Confirm the suggested date, change it, or select Unknown.";
    }
  }

  if (Object.keys(errors).length || (draft.billingType !== "Monthly" && draft.billingType !== "Yearly")) {
    return { errors, input: null };
  }
  return {
    errors,
    input: {
      amount,
      billingType: draft.billingType,
      currency,
      nextRenewalDate: nextRenewalUnknown ? null : draft.nextRenewalDate,
      nextRenewalUnknown,
    } satisfies ResumeSubscriptionInput,
  };
}

export function validateResumePayment(input: ResumePaymentInput, today: string) {
  const errors: ResumePaymentErrors = {};
  const amount = input.amount.trim();
  const currency = input.currency.trim().toUpperCase();
  if (!validBillingDate(input.paymentDate)) errors.paymentDate = "Enter a valid payment date.";
  else if (input.paymentDate > today) errors.paymentDate = "Payment date cannot be in the future.";
  if (!/^[A-Z]{3}$/.test(currency)) errors.currency = "Select a three-letter currency.";
  const amountError = optionalPaymentAmountError(amount);
  if (amountError) errors.amount = amountError;
  if (Object.keys(errors).length) return { errors, input: null };
  return { errors, input: { ...input, amount, currency, planName: input.planName.trim() } };
}

export function resumePaymentSourceKey(lifecycleEventId: string) {
  return `resume-payment:${lifecycleEventId}`;
}

export function matchesResumePayment(
  transaction: BillingTransaction,
  relationshipId: string,
  lifecycleEventId: string,
  input: ResumePaymentInput,
) {
  return transaction.relationshipId === relationshipId
    && transaction.source === "manual"
    && transaction.sourceKey === resumePaymentSourceKey(lifecycleEventId)
    && transaction.status === "Paid"
    && transaction.paymentDate === input.paymentDate
    && transaction.planNameSnapshot === input.planName
    && transaction.billingTypeSnapshot === input.billingType
    && transaction.currency === input.currency
    && transaction.amount === input.amount;
}
