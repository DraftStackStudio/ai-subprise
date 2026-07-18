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
  nextChargeDate: string;
  draftId?: string;
  plan: ToolStatus | "";
  planName: string;
  status: ManageStatus;
  trialExpiryDate: string;
};
