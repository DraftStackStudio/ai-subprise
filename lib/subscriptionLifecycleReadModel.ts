import type { LastBillingSetup } from "@/types/subscriptionLifecycleEvent";
import type { RetiredBillingAmount } from "@/types/toolDetail";

export function lastBillingSetupFromRetiredComponents(
  components: RetiredBillingAmount[] = [],
): LastBillingSetup | null {
  const latestRetiredAt = components
    .map((component) => component.retiredAt)
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left))[0];
  if (!latestRetiredAt) return null;

  return {
    components: components
      .filter((component) => component.retiredAt === latestRetiredAt)
      .map(({ retiredAt: _retiredAt, ...component }) => component),
    retiredAt: latestRetiredAt,
  };
}
