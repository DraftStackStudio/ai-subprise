export type BillingHistoryEvent =
  | "Charged"
  | "Trial Started"
  | "Trial Converted to Paid"
  | "Moved to Free Tier"
  | "Stopped Using"
  | "Plan Changed"
  | "Refunded"
  | "Double Charged"
  | "Paused"
  | "Resumed"
  | "Restarted"
  | "Cancelled";

export type BillingHistoryEntry = {
  amount?: string;
  billingType?: string;
  currency?: string;
  date: string;
  event: BillingHistoryEvent;
  id: string;
  isCorrection?: boolean;
  isTrialOutcomeNote?: boolean;
  nextChargeDate?: string;
  note?: string;
  planName?: string;
  resolvesEntryId?: string;
  saved?: boolean;
  source: "generated" | "manual";
};

export type BillingHistorySection = {
  accountLabel: string;
  conversionNotes?: string[];
  entries: BillingHistoryEntry[];
  planName: string;
  startDate?: string;
};

export type BillingHistoryTarget = {
  accountLabel: string;
  relationshipId: string;
  toolId: string;
};
