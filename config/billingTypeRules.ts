export const primaryBillingTypes = ["Monthly", "Yearly", "Lifetime", "One-time"] as const;
export const topUpBillingType = "Top-up" as const;

export type CanonicalBillingType = (typeof primaryBillingTypes)[number] | typeof topUpBillingType;

const primaryBillingTypeSet = new Set<string>(primaryBillingTypes);

export function isPrimaryBillingType(value: string): value is (typeof primaryBillingTypes)[number] {
  return primaryBillingTypeSet.has(value);
}

/**
 * Enforces the persisted billing-type invariant:
 * zero or one primary billing type, optionally followed by Top-up.
 * Top-up may also be used on its own for pay-as-you-go tools.
 */
export function validateBillingTypeSelection(values: string[]): CanonicalBillingType[] {
  const primary = values.find(isPrimaryBillingType);
  if (!primary) return values.includes(topUpBillingType) ? [topUpBillingType] : [];
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
    const isAlreadySelected = current.includes(toggledValue);

    // Checked primary options behave like normal checkboxes: unchecking a
    // hybrid leaves Top-up selected, while unchecking a lone primary leaves
    // the billing-type selection empty.
    if (isAlreadySelected) return hasTopUp ? [topUpBillingType] : [];

    return hasTopUp ? [toggledValue, topUpBillingType] : [toggledValue];
  }

  if (toggledValue === topUpBillingType) {
    const primary = current.find(isPrimaryBillingType);
    if (!primary) return current.includes(topUpBillingType) ? [] : [topUpBillingType];
    return current.includes(topUpBillingType) ? [primary] : [primary, topUpBillingType];
  }

  return current;
}
