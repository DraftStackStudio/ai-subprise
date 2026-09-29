export type BillingRenewalResolution = "paid" | "not_charged";

export type BillingRenewalNotChargedReasonCode =
  | "cancelled_subscription"
  | "payment_failed"
  | "paused"
  | "free_or_waived"
  | "other";

export type BillingRenewalPeriod = {
  actualPaymentDate: string;
  amountSnapshot: string;
  billingComponentId: string;
  billingTypeSnapshot: "Monthly" | "Yearly";
  createdAt: string;
  currencySnapshot: string;
  id: string;
  notChargedNote: string;
  notChargedReasonCode: BillingRenewalNotChargedReasonCode | null;
  notChargedReasonText: string;
  paymentTransactionId: string;
  planNameSnapshot: string;
  relationshipId: string;
  resolution: BillingRenewalResolution | null;
  resolvedAt: string;
  scheduledRenewalDate: string;
  updatedAt: string;
  userId: string;
};

export type BillingRenewalMutationResult = {
  nextRenewalDate: string;
  paymentTransactionId: string;
  periodId: string;
};

export type UpdateBillingRenewalPeriodSnapshotInput = {
  amount: string;
  currency: string;
  planName: string;
};

export type MarkBillingRenewalNotChargedInput = {
  note?: string;
  reasonCode: BillingRenewalNotChargedReasonCode;
  reasonText?: string;
};

export type UpdateBillingRenewalPaymentInput = {
  amount: string;
  currency: string;
  paymentDate: string;
};

export type BillingRenewalExactMutationResult = {
  paymentTransactionId: string;
  periodId: string;
};
