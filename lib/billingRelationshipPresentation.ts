export type BillingRelationshipPresentationInput = {
  currentRelationshipId?: string | null;
  relationshipId: string;
  unlinkedAt?: string | null;
};

export function isHistoricalBillingRelationship({
  currentRelationshipId,
  relationshipId,
  unlinkedAt,
}: BillingRelationshipPresentationInput) {
  return Boolean(unlinkedAt) || !currentRelationshipId || currentRelationshipId !== relationshipId;
}

export function billingRelationshipSelectorLabel(
  accountLabel: string,
  planName: string,
  isHistorical: boolean,
) {
  return [accountLabel, planName, isHistorical ? "Historical" : ""].filter(Boolean).join(" · ");
}

