import type { SubscriptionState } from "@/lib/subscriptions";
import type { ManageStatus } from "@/types/toolDetail";
import type { UpdateCurrentBillingInput, UpdateCurrentBillingResult } from "@/types/currentBillingChange";

export type AuditedCurrentBillingEligibility = {
  canManageBilling: boolean;
  lifecycleStatus: ManageStatus;
  planStatus: string;
  subscriptionState: SubscriptionState;
};

type AuditedCurrentBillingDependencies = {
  persist: (input: UpdateCurrentBillingInput) => Promise<UpdateCurrentBillingResult>;
  refresh: (relationshipId: string) => Promise<unknown>;
};

export function canUseAuditedCurrentBillingSave(eligibility: AuditedCurrentBillingEligibility) {
  return eligibility.canManageBilling
    && eligibility.lifecycleStatus === "Active"
    && (eligibility.planStatus === "Active" || eligibility.planStatus === "Paid")
    && eligibility.subscriptionState === "Complete";
}

export function canUseAuditedCurrentBillingSetup(eligibility: AuditedCurrentBillingEligibility) {
  return eligibility.canManageBilling
    && eligibility.lifecycleStatus === "Active"
    && (eligibility.planStatus === "Active" || eligibility.planStatus === "Paid")
    && eligibility.subscriptionState !== "Complete";
}

export function currentBillingUpdateSuccessMessage(result: UpdateCurrentBillingResult) {
  if (result.wasNoOp) return "Current Billing already matches";
  const message = result.wasAlreadyApplied ? "Current Billing update confirmed" : "Current Billing updated";
  if (!result.excludedPeriodCount) return message;
  return `${message}. ${result.excludedPeriodCount} unresolved renewal ${result.excludedPeriodCount === 1 ? "period" : "periods"} superseded.`;
}

async function persistAndRefreshCurrentBilling(
  input: UpdateCurrentBillingInput,
  dependencies: AuditedCurrentBillingDependencies,
) {
  const result = await dependencies.persist(input);
  if (result.relationshipId !== input.relationshipId) {
    throw new Error("Current Billing returned a different relationship.");
  }
  await dependencies.refresh(input.relationshipId);
  return result;
}

export async function saveAuditedCurrentBilling(
  input: UpdateCurrentBillingInput,
  eligibility: AuditedCurrentBillingEligibility,
  dependencies: AuditedCurrentBillingDependencies,
) {
  if (!canUseAuditedCurrentBillingSave(eligibility)) {
    throw new Error("Only a complete active paid subscription can update Current Billing.");
  }
  return persistAndRefreshCurrentBilling(input, dependencies);
}

export async function saveAuditedCurrentBillingSetup(
  input: UpdateCurrentBillingInput,
  eligibility: AuditedCurrentBillingEligibility,
  dependencies: AuditedCurrentBillingDependencies,
) {
  if (!canUseAuditedCurrentBillingSetup(eligibility)) {
    throw new Error("Only an incomplete active paid subscription can set up Current Billing.");
  }
  return persistAndRefreshCurrentBilling(input, dependencies);
}
