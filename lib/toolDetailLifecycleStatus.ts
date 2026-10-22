import type { ManageStatus, ToolStatus } from "@/types/toolDetail";

export type ProtectedToolDetailLifecycleStatus = {
  relationshipId: string;
  status: ManageStatus;
};

export function protectedToolDetailLifecycleStatus(input: {
  plan: ToolStatus;
  relationshipId?: string;
  status?: ManageStatus;
}): ProtectedToolDetailLifecycleStatus | null {
  if (
    (input.plan !== "Active" && input.plan !== "Paid")
    || !input.relationshipId
    || !input.status
  ) return null;

  return {
    relationshipId: input.relationshipId,
    status: input.status,
  };
}

export function toolDetailLifecycleStatusSave(input: {
  expectedRelationshipId?: string;
  protectedStatus: ProtectedToolDetailLifecycleStatus | null;
  requestedStatus: ManageStatus;
}) {
  if (!input.protectedStatus) {
    return {
      persistStatus: input.requestedStatus,
      status: input.requestedStatus,
    };
  }

  if (input.expectedRelationshipId !== input.protectedStatus.relationshipId) {
    throw new Error("This relationship changed. Reopen the account.");
  }
  if (input.requestedStatus !== input.protectedStatus.status) {
    throw new Error("Use Subscriptions → Manage Subscription to change lifecycle status.");
  }

  return {
    persistStatus: undefined,
    status: input.protectedStatus.status,
  };
}
