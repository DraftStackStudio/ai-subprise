export type BillingRenewalResolution = "paid" | "not_charged";

export type BillingRenewalPeriod = {
  actualPaymentDate: string;
  amountSnapshot: string;
  billingComponentId: string;
  billingTypeSnapshot: "Monthly" | "Yearly";
  createdAt: string;
  currencySnapshot: string;
  id: string;
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
