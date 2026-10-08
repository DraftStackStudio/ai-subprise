import type { ManageStatus } from "@/types/toolDetail";

export const relationshipLifecycleStatuses = ["Active", "Paused", "Goodbye"] as const;

export function normaliseRelationshipLifecycleStatus(value: unknown): ManageStatus | null {
  if (value === "Active" || value === "Running") return "Active";
  if (value === "Paused" || value === "On a Break" || value === "On a break") return "Paused";
  if (
    value === "Goodbye"
    || value === "Goodbye it was a journey"
    || value === "Goodbye, it was a journey"
  ) return "Goodbye";
  return null;
}

export function requireRelationshipLifecycleStatus(value: unknown, relationshipId?: string): ManageStatus {
  const status = normaliseRelationshipLifecycleStatus(value);
  if (status) return status;

  const context = relationshipId ? ` for relationship ${relationshipId}` : "";
  const received = typeof value === "string" && value ? `'${value}'` : "an empty value";
  throw new Error(`Unsupported relationship lifecycle status${context}: ${received}.`);
}

export function isRelationshipRenewalEligible(value: unknown) {
  return normaliseRelationshipLifecycleStatus(value) === "Active";
}
