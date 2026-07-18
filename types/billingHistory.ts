export type BillingHistoryEvent =
  | "Charged"
  | "Trial Started"
  | "Trial Converted to Paid"
  | "Plan Changed"
  | "Refunded"
  | "Double Charged"
  | "Cancelled";

export type BillingHistoryEntry = {
  amount?: string;
  billingType?: string;
  currency?: string;
  date: string;
  event: BillingHistoryEvent;
  id: string;
  note?: string;
  planName?: string;
  resolvesEntryId?: string;
  saved?: boolean;
  source: "generated" | "manual";
};

export type BillingHistorySection = {
  accountLabel: string;
  entries: BillingHistoryEntry[];
  planName: string;
};

export type BillingHistoryTarget = {
  accountLabel: string;
  toolId: string;
};
