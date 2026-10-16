import { createClient } from "@/lib/supabase/client";
import type {
  PauseSubscriptionResult,
  ResumeSubscriptionResult,
  SubscriptionLifecycleEvent,
  SubscriptionLifecycleEventKind,
} from "@/types/subscriptionLifecycleEvent";
import type { PauseSubscriptionInput } from "@/lib/subscriptionPause";
import type { ResumeSubscriptionInput } from "@/lib/subscriptionResume";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function lifecycleEvent(record: Record<string, unknown>): SubscriptionLifecycleEvent {
  return {
    amountSnapshot: record.amount_snapshot === null || record.amount_snapshot === undefined
      ? ""
      : String(record.amount_snapshot),
    billingTypeSnapshot: text(record.billing_type_snapshot) as SubscriptionLifecycleEvent["billingTypeSnapshot"],
    createdAt: text(record.created_at),
    currencySnapshot: text(record.currency_snapshot),
    effectiveDate: text(record.effective_date),
    effectiveDatePrecision: text(record.effective_date_precision) as SubscriptionLifecycleEvent["effectiveDatePrecision"],
    eventKind: text(record.event_kind) as SubscriptionLifecycleEventKind,
    id: text(record.id),
    newBillingComponentId: text(record.new_billing_component_id),
    nextRenewalDateSnapshot: text(record.next_renewal_date_snapshot),
    nextLifecycleState: text(record.next_lifecycle_state) as SubscriptionLifecycleEvent["nextLifecycleState"],
    planNameSnapshot: text(record.plan_name_snapshot),
    plannedResumeDate: text(record.planned_resume_date),
    plannedResumePrecision: text(record.planned_resume_precision) as SubscriptionLifecycleEvent["plannedResumePrecision"],
    previousBillingComponentId: text(record.previous_billing_component_id),
    previousLifecycleState: text(record.previous_lifecycle_state) as SubscriptionLifecycleEvent["previousLifecycleState"],
    previousPlanName: text(record.previous_plan_name),
    reason: text(record.reason),
    relationshipId: text(record.tool_email_link_id),
    userId: text(record.user_id),
  };
}

export async function getSubscriptionLifecycleEventsByRelationships(relationshipIds: string[]) {
  const scopedIds = [...new Set(relationshipIds.filter(Boolean))];
  if (!scopedIds.length) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("subscription_lifecycle_events")
    .select("*")
    .in("tool_email_link_id", scopedIds)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const scope = new Set(scopedIds);
  return (data ?? [])
    .map((record) => lifecycleEvent(record as Record<string, unknown>))
    .filter((event) => scope.has(event.relationshipId));
}

export async function getSubscriptionLifecycleEventsByRelationship(relationshipId: string) {
  return getSubscriptionLifecycleEventsByRelationships([relationshipId]);
}

export async function pauseSubscription(
  relationshipId: string,
  requestId: string,
  input: PauseSubscriptionInput,
  localDate: string,
): Promise<PauseSubscriptionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("pause_subscription", {
    p_effective_date: input.effectiveDate,
    p_effective_date_precision: input.effectiveDatePrecision,
    p_local_date: localDate,
    p_planned_resume_date: input.plannedResumeDate,
    p_planned_resume_precision: input.plannedResumePrecision,
    p_reason: input.reason || null,
    p_relationship_id: relationshipId,
    p_request_id: requestId,
  });
  if (error) throw error;

  const record = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!record) throw new Error("Pause Subscription did not return a result.");
  const result = {
    excludedPeriodCount: Number(record.excluded_period_count ?? 0),
    lifecycleEventId: text(record.lifecycle_event_id),
    materializedPeriodCount: Number(record.materialized_period_count ?? 0),
    relationshipId: text(record.relationship_id),
    retiredBillingComponentId: text(record.retired_billing_component_id),
    wasAlreadyApplied: record.was_already_applied === true,
  };
  if (!result.relationshipId || !result.lifecycleEventId) {
    throw new Error("Pause Subscription returned an incomplete result.");
  }
  return result;
}

export async function resumeSubscription(
  relationshipId: string,
  pauseEventId: string,
  requestId: string,
  input: ResumeSubscriptionInput,
  localDate: string,
): Promise<ResumeSubscriptionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("resume_subscription", {
    p_amount: input.amount || null,
    p_billing_type: input.billingType,
    p_currency: input.currency,
    p_local_date: localDate,
    p_next_renewal_date: input.nextRenewalDate,
    p_next_renewal_unknown: input.nextRenewalUnknown,
    p_pause_event_id: pauseEventId,
    p_relationship_id: relationshipId,
    p_request_id: requestId,
  });
  if (error) throw error;

  const record = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!record) throw new Error("Resume Subscription did not return a result.");
  const result = {
    lifecycleEventId: text(record.lifecycle_event_id),
    newBillingComponentId: text(record.new_billing_component_id),
    nextRenewalDate: text(record.next_renewal_date),
    previousBillingComponentId: text(record.previous_billing_component_id),
    relationshipId: text(record.relationship_id),
    wasAlreadyApplied: record.was_already_applied === true,
  };
  if (!result.relationshipId || !result.lifecycleEventId || !result.newBillingComponentId || !result.previousBillingComponentId) {
    throw new Error("Resume Subscription returned an incomplete result.");
  }
  return result;
}
