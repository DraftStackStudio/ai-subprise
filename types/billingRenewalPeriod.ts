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
  billingDate: string;
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

export type BillingRenewalActivityKind = "billing_period_corrected" | "billing_schedule_changed";

export type BillingRenewalActivity = {
  activityDate: string;
  amountSnapshot: string;
  billingDate: string;
  billingTypeSnapshot: "Monthly" | "Yearly";
  createdAt: string;
  currencySnapshot: string;
  id: string;
  kind: BillingRenewalActivityKind;
  note: string;
  periodId: string;
  planNameSnapshot: string;
  previousBillingDate: string;
  relationshipId: string;
};

export type BillingRenewalMutationResult = {
  nextRenewalDate: string;
  paymentTransactionId: string;
  periodId: string;
};

export type UpdateBillingRenewalPeriodSnapshotInput = {
  amount: string;
  billingDate: string;
  currency: string;
  dateScope: "period_only" | "this_and_future";
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
