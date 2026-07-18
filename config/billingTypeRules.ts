export const primaryBillingTypes = ["Monthly", "Yearly", "Lifetime", "One-time"] as const;
export const topUpBillingType = "Top-up" as const;

export type CanonicalBillingType = (typeof primaryBillingTypes)[number] | typeof topUpBillingType;

const primaryBillingTypeSet = new Set<string>(primaryBillingTypes);

export function isPrimaryBillingType(value: string): value is (typeof primaryBillingTypes)[number] {
  return primaryBillingTypeSet.has(value);
}

/**
 * Enforces the persisted billing-type invariant:
 * exactly one primary billing type, optionally followed by Top-up.
 */
export function validateBillingTypeSelection(values: string[]): CanonicalBillingType[] {
  const primary = values.find(isPrimaryBillingType);
  if (!primary) return [];
  return values.includes(topUpBillingType) ? [primary, topUpBillingType] : [primary];
}

/** Applies a checkbox toggle without ever producing an invalid intermediate selection. */
export function toggleBillingTypeSelection(
  currentValues: string[],
  toggledValue: string,
): CanonicalBillingType[] {
  const current = validateBillingTypeSelection(currentValues);

  if (isPrimaryBillingType(toggledValue)) {
    const hasTopUp = current.includes(topUpBillingType);
    return hasTopUp ? [toggledValue, topUpBillingType] : [toggledValue];
  }

  if (toggledValue === topUpBillingType) {
    const primary = current.find(isPrimaryBillingType);
    if (!primary) return current;
    return current.includes(topUpBillingType) ? [primary] : [primary, topUpBillingType];
  }

  return current;
}
