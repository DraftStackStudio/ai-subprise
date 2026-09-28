import type { BillingHistoryEvent } from "@/types/billingHistory";
import type { ManageStatus, ToolStatus, TrialResolution } from "@/types/toolDetail";

export const trialResolutionOutcomes: TrialResolution[] = [
  "converted",
  "moved_to_free",
  "stopped_using",
];

export function isTrialResolution(value: unknown): value is TrialResolution {
  return typeof value === "string" && trialResolutionOutcomes.includes(value as TrialResolution);
}

export function trialResolutionTransition(outcome: TrialResolution): {
  activityEvent: BillingHistoryEvent;
  label: string;
  plan: ToolStatus;
  status: ManageStatus;
} {
  switch (outcome) {
    case "converted":
      return { activityEvent: "Trial Converted to Paid", label: "Converted to paid", plan: "Active", status: "Active" };
    case "moved_to_free":
      return { activityEvent: "Moved to Free Tier", label: "Moved to free tier", plan: "Free Tier", status: "Active" };
    case "stopped_using":
      return { activityEvent: "Stopped Using", label: "Stopped using", plan: "Trial", status: "Goodbye" };
  }
}

export function expiredTrialNeedsResolution(input: {
  daysRemaining: number | null;
  plan: ToolStatus;
  relationshipId?: string;
  trialResolved?: boolean;
}) {
  return Boolean(
    input.relationshipId
    && input.plan === "Trial"
    && input.daysRemaining !== null
    && input.daysRemaining < 0
    && input.trialResolved !== true,
  );
}
