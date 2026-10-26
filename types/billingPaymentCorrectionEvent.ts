import type { BillingTransactionSource, BillingTransactionStatus, BillingTransactionType } from "@/types/billingTransaction";

export type BillingPaymentCorrectionField =
  | "payment_date"
  | "plan_name"
  | "billing_type"
  | "currency"
  | "amount"
  | "status"
  | "note";

export type BillingPaymentCorrectionSnapshot = {
  amount: string;
  billingType: BillingTransactionType | "";
  currency: string;
  note: string;
  paymentDate: string;
  planName: string;
  relationshipId: string;
  source: BillingTransactionSource;
  sourceKey: string;
  status: BillingTransactionStatus;
  transactionId: string;
};

export type BillingPaymentCorrectionEvent = {
  afterSnapshot: BillingPaymentCorrectionSnapshot;
  beforeSnapshot: BillingPaymentCorrectionSnapshot;
  changedFields: BillingPaymentCorrectionField[];
  createdAt: string;
  effectiveDate: string;
  id: string;
  paymentSource: "manual" | "renewal";
  paymentTransactionId: string;
  relationshipId: string;
  requestId: string;
  userId: string;
};
