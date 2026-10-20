import { validBillingDate } from "@/lib/currentBilling";
import { subscriptionBillingPatch, validSubscriptionBillingTypes } from "@/lib/subscriptions";
import type {
  CompareCurrentBillingInput,
  CurrentBillingClassification,
  CurrentBillingComparison,
  CurrentBillingComponentChange,
  CurrentBillingComponentSlot,
  CurrentBillingComponentSnapshot,
  CurrentBillingField,
  CurrentBillingFieldChange,
  CurrentBillingRevision,
  CurrentBillingRevisionComponent,
  CurrentBillingSnapshot,
} from "@/types/currentBillingChange";
import type { BillingAmount } from "@/types/toolDetail";

const recurringTypes = new Set(["Monthly", "Yearly"]);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const revisionComponentKeys = [
  "amount", "billingType", "currency", "id", "lastTopUpDate", "nextRenewalDate", "purchaseDate",
].sort();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Mirrors current_billing_canonical_amount(text), including the numeric(18, 6)
// rounding and range boundary used by PostgreSQL.
export function canonicalCurrentBillingAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Enter an amount of zero or greater within the supported range.");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  const sixPlaces = fraction.slice(0, 6).padEnd(6, "0");
  const shouldRound = (fraction[6] ?? "0") >= "5";
  const scaled = BigInt(`${normalizedWhole}${sixPlaces}`) + (shouldRound ? 1n : 0n);
  const scaledText = scaled.toString().padStart(7, "0");
  const integerPart = scaledText.slice(0, -6).replace(/^0+(?=\d)/, "") || "0";
  if (integerPart.length > 12) {
    throw new Error("Enter an amount of zero or greater within the supported range.");
  }
  const normalizedFraction = scaledText.slice(-6).replace(/0+$/, "");
  return normalizedFraction ? `${integerPart}.${normalizedFraction}` : integerPart;
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
    amount: canonicalCurrentBillingAmount(component.amount),
    billingType: component.billingType,
    currency: component.currency.trim().toUpperCase() || null,
    lastTopUpDate: component.lastTopUpDate?.trim() || null,
    nextRenewalDate: component.nextRenewalDate?.trim() || null,
    purchaseDate: component.purchaseDate?.trim() || null,
  };
}

function revisionComponent(component: BillingAmount): CurrentBillingRevisionComponent | null {
  const id = component.id.trim().toLowerCase();
  if (!uuidPattern.test(id)) return null;
  if ([component.lastTopUpDate, component.nextRenewalDate, component.purchaseDate]
    .some((date) => Boolean(date?.trim()) && !validBillingDate(date!.trim()))) return null;
  try {
    return { id, ...normalizedComponent(component) };
  } catch {
    return null;
  }
}

function trustedRevisionComponent(
  value: unknown,
  slot: CurrentBillingComponentSlot,
): value is CurrentBillingRevisionComponent {
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== revisionComponentKeys.join("|")) return false;
  if (typeof value.id !== "string" || !uuidPattern.test(value.id) || value.id !== value.id.toLowerCase()) return false;
  if (typeof value.billingType !== "string" || !validSubscriptionBillingTypes([value.billingType])) return false;
  if ((slot === "top_up") !== (value.billingType === "Top-up")) return false;
  if (value.amount !== null && typeof value.amount !== "string") return false;
  try {
    if (typeof value.amount === "string" && canonicalCurrentBillingAmount(value.amount) !== value.amount) return false;
  } catch {
    return false;
  }
  if (value.currency !== null && (
    typeof value.currency !== "string"
    || !/^[A-Z]{3}$/.test(value.currency)
  )) return false;
  return [value.nextRenewalDate, value.purchaseDate, value.lastTopUpDate]
    .every((date) => date === null || (typeof date === "string" && validBillingDate(date)));
}

export function isTrustedCurrentBillingRevision(value: unknown): value is CurrentBillingRevision {
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== "components|planName") return false;
  if (typeof value.planName !== "string" || value.planName !== value.planName.trim()) return false;
  if (!isRecord(value.components)) return false;
  const components = value.components;
  const slots = Object.keys(components);
  if (slots.some((slot) => slot !== "primary" && slot !== "top_up")) return false;
  return slots.every((slot) => trustedRevisionComponent(components[slot], slot as CurrentBillingComponentSlot));
}

export function buildCurrentBillingRevision(
  planName: string,
  components: readonly BillingAmount[],
): CurrentBillingRevision | null {
  if (!validSubscriptionBillingTypes(components.map((component) => component.billingType))) return null;

  const revision: CurrentBillingRevision = { planName: planName.trim(), components: {} };
  for (const component of components) {
    const normalized = revisionComponent(component);
    if (!normalized) return null;
    const slot = componentSlot(component);
    if (revision.components[slot]) return null;
    revision.components[slot] = normalized;
  }
  return revision;
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
