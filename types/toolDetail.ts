export type ToolStatus =
  | "Active"
  | "Trial"
  | "Free Tier"
  | "Paused"
  | "Considering"
  | "Cancelled"
  | "Paid"
  | "Free";

export type ManageStatus = "Active" | "Paused" | "Goodbye";

export type TrialResolution = "converted" | "moved_to_free" | "stopped_using";

export type TrialResolutionHistoryEntry = {
  billingType: string;
  convertedDate: string;
  id: string;
  isCorrection: boolean;
  nextChargeDate: string;
  purchaseDate: string;
  outcome: TrialResolution;
  planName: string;
  resolvedDate: string;
};

export type BillingAmount = {
  amount: string;
  billingType: string;
  currency: string;
  id: string;
  lastTopUpDate?: string;
  nextRenewalDate?: string;
  purchaseDate?: string;
};

export type RetiredBillingAmount = BillingAmount & {
  retiredAt: string;
};

export type ToolDetailAccountDraft = {
  accountLabel: string;
  billingAmounts: BillingAmount[];
  billingType: string;
  lastTopUpDate: string;
  nextChargeDate: string;
  pendingTrialOutcome: "" | TrialResolution;
  purchaseDate: string;
  draftId?: string;
  plan: ToolStatus | "";
  planName: string;
  status: ManageStatus;
  trialExpiryDate: string;
};
