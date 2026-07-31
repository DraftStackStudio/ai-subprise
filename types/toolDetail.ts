export type ToolStatus =
  | "Active"
  | "Trial"
  | "Free Tier"
  | "Paused"
  | "Considering"
  | "Cancelled"
  | "Paid"
  | "Free";

export type ManageStatus = "Active" | "On a Break" | "Goodbye";

export type TrialResolutionHistoryEntry = {
  billingType: string;
  convertedDate: string;
  id: string;
  isCorrection: boolean;
  nextChargeDate: string;
  purchaseDate: string;
  outcome: "converted" | "ended";
  planName: string;
};

export type BillingAmount = {
  amount: string;
  billingType: string;
  currency: string;
  id: string;
};

export type ToolDetailAccountDraft = {
  accountLabel: string;
  billingAmounts: BillingAmount[];
  billingType: string;
  lastTopUpDate: string;
  nextChargeDate: string;
  pendingTrialOutcome: "" | "converted" | "ended";
  purchaseDate: string;
  draftId?: string;
  plan: ToolStatus | "";
  planName: string;
  status: ManageStatus;
  trialExpiryDate: string;
};
