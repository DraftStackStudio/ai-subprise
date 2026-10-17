import { validBillingDate } from "@/lib/currentBilling";
import { subscriptionBillingPatch } from "@/lib/subscriptions";
import type {
  CompareCurrentBillingInput,
  CurrentBillingClassification,
  CurrentBillingComparison,
  CurrentBillingComponentChange,
  CurrentBillingComponentSlot,
  CurrentBillingComponentSnapshot,
  CurrentBillingField,
  CurrentBillingFieldChange,
  CurrentBillingSnapshot,
} from "@/types/currentBillingChange";
import type { BillingAmount } from "@/types/toolDetail";

const recurringTypes = new Set(["Monthly", "Yearly"]);

function canonicalAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole;
}

function compareAmounts(left: string, right: string) {
  const [leftWhole, leftFraction = ""] = left.split(".");
  const [rightWhole, rightFraction = ""] = right.split(".");
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftValue = BigInt(`${leftWhole}${leftFraction.padEnd(scale, "0")}`);
  const rightValue = BigInt(`${rightWhole}${rightFraction.padEnd(scale, "0")}`);
  return leftValue === rightValue ? 0 : leftValue > rightValue ? 1 : -1;
}

function componentSlot(component: BillingAmount): CurrentBillingComponentSlot {
  return component.billingType === "Top-up" ? "top_up" : "primary";
}

function normalizedComponent(component: BillingAmount): CurrentBillingComponentSnapshot {
  return {
    amount: canonicalAmount(component.amount),
    billingType: component.billingType,
    currency: component.currency || null,
    lastTopUpDate: component.lastTopUpDate || null,
    nextRenewalDate: component.nextRenewalDate || null,
    purchaseDate: component.purchaseDate || null,
  };
}

function normalizedSnapshot(planName: string, components: BillingAmount[]): CurrentBillingSnapshot {
  const comparableComponents = components.map((component, index) => ({
    ...component,
    id: component.id || `comparison-component-${index}`,
  }));
  const patch = subscriptionBillingPatch(planName, comparableComponents);
  const normalized: CurrentBillingSnapshot = { planName: patch.planName, components: {} };
  for (const component of patch.billingAmounts) {
    normalized.components[componentSlot(component)] = normalizedComponent(component);
  }
  return normalized;
}

function fieldChange(field: CurrentBillingField, before: string | null, after: string | null) {
  return before === after ? null : { field, before, after } satisfies CurrentBillingFieldChange;
}

function componentFieldChanges(
  before: CurrentBillingComponentSnapshot,
  after: CurrentBillingComponentSnapshot,
) {
  return [
    fieldChange("billing_type", before.billingType, after.billingType),
    fieldChange("amount", before.amount, after.amount),
    fieldChange("currency", before.currency, after.currency),
    fieldChange("next_renewal_date", before.nextRenewalDate, after.nextRenewalDate),
    fieldChange("purchase_date", before.purchaseDate, after.purchaseDate),
    fieldChange("last_top_up_date", before.lastTopUpDate, after.lastTopUpDate),
  ].filter((change): change is CurrentBillingFieldChange => change !== null);
}

function classificationsForComponent(change: CurrentBillingComponentChange) {
  const classifications: CurrentBillingClassification[] = [];
  if (!change.before) return ["component_added"] satisfies CurrentBillingClassification[];
  if (!change.after) return ["component_removed"] satisfies CurrentBillingClassification[];

  const changed = new Set(change.changes.map(({ field }) => field));
  if (changed.has("billing_type")) {
    classifications.push(
      recurringTypes.has(change.before.billingType) && recurringTypes.has(change.after.billingType)
        ? "billing_cycle_changed"
        : "billing_type_changed",
    );
  }
  if (changed.has("currency")) classifications.push("currency_changed");
  if (changed.has("amount")) {
    if (change.before.amount === null) classifications.push("amount_recorded");
    else if (change.after.amount === null) classifications.push("amount_cleared");
    else if (change.before.currency !== null && change.before.currency === change.after.currency) {
      classifications.push(compareAmounts(change.before.amount, change.after.amount) < 0 ? "price_increased" : "price_decreased");
    } else classifications.push("amount_changed");
  }
  if (changed.has("next_renewal_date")) classifications.push("renewal_date_changed");
  if (changed.has("purchase_date")) classifications.push("purchase_date_changed");
  if (changed.has("last_top_up_date")) classifications.push("last_top_up_date_changed");
  return classifications;
}

export function compareCurrentBilling(input: CompareCurrentBillingInput): CurrentBillingComparison | null {
  if (!validBillingDate(input.effectiveDate)) throw new Error("Enter a valid effective date.");
  const before = normalizedSnapshot(input.previousPlanName, input.previousComponents);
  const after = normalizedSnapshot(input.editedPlanName, input.editedComponents);
  const fieldChanges: CurrentBillingFieldChange[] = [];
  const planChange = fieldChange("plan_name", before.planName, after.planName);
  if (planChange) fieldChanges.push(planChange);

  const componentChanges: CurrentBillingComponentChange[] = [];
  for (const slot of ["primary", "top_up"] as const) {
    const previous = before.components[slot] ?? null;
    const edited = after.components[slot] ?? null;
    if (!previous && !edited) continue;
    if (!previous || !edited) {
      const changes = [fieldChange("component_configuration", previous?.billingType ?? null, edited?.billingType ?? null)!];
      componentChanges.push({ slot, before: previous, after: edited, changes });
      fieldChanges.push(...changes);
      continue;
    }
    const changes = componentFieldChanges(previous, edited);
    if (changes.length) {
      componentChanges.push({ slot, before: previous, after: edited, changes });
      fieldChanges.push(...changes);
    }
  }

  if (!fieldChanges.length) return null;
  const classifications = input.isCorrection
    ? []
    : [
        ...(planChange ? ["plan_changed" as const] : []),
        ...componentChanges.flatMap(classificationsForComponent),
      ];
  return {
    after,
    before,
    classifications: [...new Set(classifications)],
    componentChanges,
    effectiveDate: input.effectiveDate,
    fieldChanges,
    mode: input.isCorrection ? "correction" : "change",
  };
}

export function billingConfigurationForRenewalDate(renewalDate: string, effectiveDate: string) {
  if (!validBillingDate(renewalDate) || !validBillingDate(effectiveDate)) throw new Error("Enter valid renewal and effective dates.");
  return renewalDate < effectiveDate ? "previous" as const : "next" as const;
}
