import type { BillingAmount } from "@/types/toolDetail";

export type CurrentBillingChangeMode = "change" | "correction";
export type CurrentBillingComponentSlot = "primary" | "top_up";

export type CurrentBillingField =
  | "plan_name"
  | "component_configuration"
  | "billing_type"
  | "amount"
  | "currency"
  | "next_renewal_date"
  | "purchase_date"
  | "last_top_up_date";

export type CurrentBillingClassification =
  | "plan_changed"
  | "component_added"
  | "component_removed"
  | "billing_cycle_changed"
  | "billing_type_changed"
  | "price_increased"
  | "price_decreased"
  | "amount_changed"
  | "amount_recorded"
  | "amount_cleared"
  | "currency_changed"
  | "renewal_date_changed"
  | "purchase_date_changed"
  | "last_top_up_date_changed";

export type CurrentBillingComponentSnapshot = {
  amount: string | null;
  billingType: BillingAmount["billingType"];
  currency: string | null;
  lastTopUpDate: string | null;
  nextRenewalDate: string | null;
  purchaseDate: string | null;
};

export type CurrentBillingSnapshot = {
  components: Partial<Record<CurrentBillingComponentSlot, CurrentBillingComponentSnapshot>>;
  planName: string;
};

export type CurrentBillingRevisionComponent = CurrentBillingComponentSnapshot & {
  id: string;
};

export type CurrentBillingRevision = {
  components: Partial<Record<CurrentBillingComponentSlot, CurrentBillingRevisionComponent>>;
  planName: string;
};

export type CurrentBillingFieldChange = {
  after: string | null;
  before: string | null;
  field: CurrentBillingField;
};

export type CurrentBillingComponentChange = {
  after: CurrentBillingComponentSnapshot | null;
  before: CurrentBillingComponentSnapshot | null;
  changes: CurrentBillingFieldChange[];
  slot: CurrentBillingComponentSlot;
};

export type CurrentBillingComparison = {
  after: CurrentBillingSnapshot;
  before: CurrentBillingSnapshot;
  classifications: CurrentBillingClassification[];
  componentChanges: CurrentBillingComponentChange[];
  effectiveDate: string;
  fieldChanges: CurrentBillingFieldChange[];
  mode: CurrentBillingChangeMode;
};

export type CompareCurrentBillingInput = {
  editedComponents: BillingAmount[];
  editedPlanName: string;
  effectiveDate: string;
  isCorrection: boolean;
  previousComponents: BillingAmount[];
  previousPlanName: string;
};

export type UpdateCurrentBillingInput = {
  components: BillingAmount[];
  effectiveDate: string;
  expectedRevision: CurrentBillingRevision;
  localDate: string;
  mode: CurrentBillingChangeMode;
  planName: string;
  reason: string | null;
  relationshipId: string;
  requestId: string;
};

export type UpdateCurrentBillingResult = {
  billingEventId: string | null;
  excludedPeriodCount: number;
  newRecurringComponentId: string | null;
  previousRecurringComponentId: string | null;
  relationshipId: string;
  wasAlreadyApplied: boolean;
  wasNoOp: boolean;
};
