import { isTrustedCurrentBillingRevision } from "@/lib/currentBillingChange";
import type { CurrentBillingRevision } from "@/types/currentBillingChange";

export type ToolDetailBillingRelationship = {
  accountLabel: string;
  currentBillingRevision?: CurrentBillingRevision | null;
  planName: string;
  relationshipId: string;
  toolId: string;
};

export type ToolDetailCurrentBillingPlan = {
  planName: string;
  relationshipId: string;
  trusted: boolean;
};

export function protectedToolDetailCurrentBillingPlan(
  relationships: readonly ToolDetailBillingRelationship[],
  toolId: string,
  accountLabel: string,
  relationshipId?: string,
  fallbackRelationship?: ToolDetailBillingRelationship,
): ToolDetailCurrentBillingPlan | null {
  if (!relationshipId) return null;
  const matchesExactRelationship = (detail: ToolDetailBillingRelationship) => (
    detail.relationshipId === relationshipId
    && detail.toolId === toolId
    && detail.accountLabel === accountLabel
  );
  const relationship = relationships.find(matchesExactRelationship)
    ?? (fallbackRelationship && matchesExactRelationship(fallbackRelationship) ? fallbackRelationship : null);
  if (!relationship) return null;

  const revision = relationship.currentBillingRevision;
  if (!isTrustedCurrentBillingRevision(revision)) {
    return { planName: relationship.planName, relationshipId, trusted: false };
  }
  if (Object.keys(revision.components).length === 0) return null;
  return { planName: revision.planName, relationshipId, trusted: true };
}
