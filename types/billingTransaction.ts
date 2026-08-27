export type BillingTransactionStatus = "Paid" | "Refunded" | "Failed" | "Pending";

export type BillingTransactionSource = "manual" | "legacy_json" | "api";

export type BillingTransactionType = "Monthly" | "Yearly" | "Lifetime" | "One-time" | "Top-up";

export type BillingTransaction = {
  accountLabelSnapshot: string;
  accountLoginSnapshot: string;
  amount: string;
  billingTypeSnapshot: BillingTransactionType | "";
  createdAt: string;
  currency: string;
  id: string;
  loginId: string;
  note: string;
  paymentDate: string;
  planNameSnapshot: string;
  relationshipId: string;
  source: BillingTransactionSource;
  sourceKey: string;
  status: BillingTransactionStatus;
  toolId: string;
  toolNameSnapshot: string;
  updatedAt: string;
  userId: string;
};

export type CreateBillingTransactionInput = {
  accountLabelSnapshot?: string;
  accountLoginSnapshot?: string;
  amount?: string;
  billingTypeSnapshot?: BillingTransactionType | "";
  currency?: string;
  loginId?: string;
  note?: string;
  paymentDate: string;
  planNameSnapshot?: string;
  relationshipId?: string;
  sourceKey?: string;
  status: BillingTransactionStatus;
  toolId?: string;
  toolNameSnapshot?: string;
};

export type UpdateBillingTransactionInput = Partial<Pick<
  CreateBillingTransactionInput,
  | "amount"
  | "billingTypeSnapshot"
  | "currency"
  | "note"
  | "paymentDate"
  | "planNameSnapshot"
  | "status"
>>;
