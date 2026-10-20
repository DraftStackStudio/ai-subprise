import type {
  CurrentBillingChangeMode,
  CurrentBillingClassification,
  CurrentBillingField,
  CurrentBillingSnapshot,
} from "@/types/currentBillingChange";

export type SubscriptionBillingEvent = {
  afterSnapshot: CurrentBillingSnapshot;
  beforeSnapshot: CurrentBillingSnapshot;
  changedFields: CurrentBillingField[];
  classifications: CurrentBillingClassification[];
  createdAt: string;
  effectiveDate: string;
  id: string;
  mode: CurrentBillingChangeMode;
  newRecurringComponentId: string;
  previousRecurringComponentId: string;
  reason: string;
  relationshipId: string;
  userId: string;
};
