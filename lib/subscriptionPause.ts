import { validBillingDate } from "@/lib/currentBilling";

export type LifecycleDatePrecision = "exact_date" | "month_only";

export type PauseSubscriptionDraft = {
  effectiveDate: string;
  effectiveDatePrecision: LifecycleDatePrecision;
  planningToResume: boolean;
  plannedResumeDate: string;
  plannedResumePrecision: LifecycleDatePrecision;
  reason: string;
};

export type PauseSubscriptionInput = {
  effectiveDate: string;
  effectiveDatePrecision: LifecycleDatePrecision;
  plannedResumeDate: string | null;
  plannedResumePrecision: LifecycleDatePrecision | null;
  reason: string;
};

export type PauseSubscriptionErrors = Partial<Record<"effectiveDate" | "plannedResumeDate", string>>;

export function canPauseSubscription(input: {
  canManageBilling: boolean;
  lifecycleStatus: string;
  planStatus: string;
}) {
  return input.canManageBilling
    && input.lifecycleStatus === "Active"
    && (input.planStatus === "Active" || input.planStatus === "Paid");
}

export function resolveLifecycleDate(value: string, precision: LifecycleDatePrecision) {
  if (precision === "exact_date") return validBillingDate(value) ? value : "";
  if (!/^\d{4}-\d{2}$/.test(value)) return "";
  const [year, month] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12) return "";
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lastDay = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return `${value}-${String(lastDay).padStart(2, "0")}`;
}

export function validatePauseSubscriptionDraft(draft: PauseSubscriptionDraft, today: string) {
  const errors: PauseSubscriptionErrors = {};
  const effectiveDate = resolveLifecycleDate(draft.effectiveDate, draft.effectiveDatePrecision);
  if (!effectiveDate) errors.effectiveDate = "Enter a valid effective pause date.";
  else if (effectiveDate > today) errors.effectiveDate = "The effective pause date cannot be in the future.";

  const plannedResumeDate = draft.planningToResume
    ? resolveLifecycleDate(draft.plannedResumeDate, draft.plannedResumePrecision)
    : null;
  if (draft.planningToResume && !plannedResumeDate) {
    errors.plannedResumeDate = "Enter a valid planned resume date.";
  } else if (plannedResumeDate && effectiveDate && plannedResumeDate <= effectiveDate) {
    errors.plannedResumeDate = "The planned resume date must be later than the effective pause date.";
  }

  if (Object.keys(errors).length) return { errors, input: null };
  return {
    errors,
    input: {
      effectiveDate,
      effectiveDatePrecision: draft.effectiveDatePrecision,
      plannedResumeDate,
      plannedResumePrecision: draft.planningToResume ? draft.plannedResumePrecision : null,
      reason: draft.reason.trim(),
    } satisfies PauseSubscriptionInput,
  };
}
