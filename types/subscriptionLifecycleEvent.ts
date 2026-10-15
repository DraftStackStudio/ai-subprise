import type { BillingAmount } from "@/types/toolDetail";

export type SubscriptionLifecycleEventKind =
  | "paused"
  | "ended"
  | "resumed"
  | "restarted"
  | "restarted_plan_changed";

export type SubscriptionLifecycleEvent = {
  amountSnapshot: string;
  billingTypeSnapshot: "Monthly" | "Yearly" | "";
  createdAt: string;
  currencySnapshot: string;
  effectiveDate: string;
  effectiveDatePrecision: "exact_date" | "month_only";
  eventKind: SubscriptionLifecycleEventKind;
  id: string;
  newBillingComponentId: string;
  nextLifecycleState: "Active" | "Paused" | "Goodbye";
  planNameSnapshot: string;
  plannedResumeDate: string;
  plannedResumePrecision: "exact_date" | "month_only" | "";
  previousBillingComponentId: string;
  previousLifecycleState: "Active" | "Paused" | "Goodbye";
  previousPlanName: string;
  reason: string;
  relationshipId: string;
  userId: string;
};

export type LastBillingSetup = {
  components: BillingAmount[];
  retiredAt: string;
};

export type PauseSubscriptionResult = {
  excludedPeriodCount: number;
  lifecycleEventId: string;
  materializedPeriodCount: number;
  relationshipId: string;
  retiredBillingComponentId: string;
  wasAlreadyApplied: boolean;
};
