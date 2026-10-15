import { LinkedAccountCell } from "@/components/ToolRowRenderer";
import type { SubscriptionRow } from "@/components/SubscriptionsView";
import type { BillingAmount } from "@/types/toolDetail";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import { useState } from "react";
import { DropdownControl } from "@/components/DropdownControls";
import SubscriptionBillingEditor, { type SubscriptionActions } from "@/components/SubscriptionBillingEditor";
import PauseSubscriptionModal from "@/components/PauseSubscriptionModal";
import BillingPastEntryModal from "@/components/BillingPastEntryModal";
import BillingHistoryPanel from "@/components/BillingHistoryPanel";
import SubscriptionPayments from "@/components/SubscriptionPayments";
import UnconfirmedBillingSection from "@/components/UnconfirmedBillingSection";
import { canPauseSubscription } from "@/lib/subscriptionPause";

function displayAmount(currency: string, amount: string) {
  return currency.trim() && amount.trim() ? `${currency.trim()} ${amount.trim()}` : "—";
}

function componentDate(component: BillingAmount, isLastBillingSetup = false) {
  switch (component.billingType) {
    case "Monthly":
    case "Yearly": return { label: isLastBillingSetup ? "Last recorded renewal" : "Next renewal", value: component.nextRenewalDate };
    case "Lifetime":
    case "One-time": return { label: "Purchased on", value: component.purchaseDate };
    case "Top-up": return { label: "Last top-up", value: component.lastTopUpDate };
    default: return { label: "Date", value: undefined };
  }
}

const lifecycleEvents = new Set(["Trial Started", "Trial Converted to Paid", "Moved to Free Tier", "Stopped Using", "Plan Changed", "Paused", "Resumed", "Restarted", "Cancelled"]);

const notChargedReasonLabels = {
  cancelled_subscription: "Cancelled subscription",
  payment_failed: "Payment failed",
  paused: "Paused / on a break",
  free_or_waived: "Free / waived",
  other: "Other",
} as const;

function localResolvedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compactActivityDetails(...parts: Array<string | undefined>) {
  return parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
}

function visibleLifecycleNote(title: string, note: string) {
  const value = note.trim();
  if ((title === "Subscription restarted" && value === "Explicitly restarted") ||
      (title === "Subscription cancelled" && value === "Cancelled")) return "";
  return value;
}

type AccountActivityItem = {
  date: string;
  details: string[];
  description?: string;
  id: string;
  lifecycleEvent?: string;
  note: string;
  order: number;
  title: string;
};

const activityDisplayLabels: Record<string, string> = {
  "Plan Changed": "Plan changed",
  Cancelled: "Subscription cancelled",
  Restarted: "Subscription restarted",
};

function combineSameDayCancellationRestart(entries: AccountActivityItem[]) {
  const hiddenCancellationIds = new Set<string>();
  return entries.map((entry, index) => {
    if (entry.lifecycleEvent !== "Restarted") return entry;
    const cancellation = entries.slice(0, index).reverse().find((candidate) => (
      candidate.date === entry.date &&
      candidate.lifecycleEvent === "Cancelled" &&
      !hiddenCancellationIds.has(candidate.id)
    ));
    if (!cancellation) return entry;
    hiddenCancellationIds.add(cancellation.id);
    const notes = [cancellation.note, entry.note].filter(Boolean);
    return {
      ...entry,
      description: "Cancelled and restarted on the same day",
      note: [...new Set(notes)].join(" · "),
    };
  }).filter((entry) => !hiddenCancellationIds.has(entry.id));
}

function ActivityMetadata({ parts }: { parts: string[] }) {
  if (!parts.length) return null;
  return <p className="subscription-activity-details">{parts.map((part, index) => <span key={`${part}-${index}`}>{part}</span>)}</p>;
}

export default function SubscriptionAccountView({ account, ...actions }: SubscriptionActions & { account: SubscriptionRow }) {
  const [manageOpen, setManageOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [editingBilling, setEditingBilling] = useState(false);
  const [paymentPrompt, setPaymentPrompt] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"single" | "period" | null>(null);
  const [paymentComponentType, setPaymentComponentType] = useState<string | undefined>();
  const [firstTimeSetup, setFirstTimeSetup] = useState(false);
  const [continueToPaymentAfterBilling, setContinueToPaymentAfterBilling] = useState(false);
  const [paymentPrefill, setPaymentPrefill] = useState<{ planName: string; billingComponents: BillingAmount[] } | null>(null);
  const paymentAccount = paymentPrefill ? { ...account, planName: paymentPrefill.planName, billingComponents: paymentPrefill.billingComponents } : account;
  const finishPaymentFlow = () => { setPaymentMode(null); setPaymentChoice(false); setFirstTimeSetup(false); setPaymentPrefill(null); actions.onPaymentsChanged?.(); };
  const shouldUpdateCurrentBilling = firstTimeSetup || paymentMode === "period";
  const canAddPayment = Boolean(account.relationshipId && account.canManageBilling) && !editingBilling;
  const pauseEligible = canPauseSubscription({ canManageBilling: account.canManageBilling, lifecycleStatus: account.status, planStatus: account.planStatus });
  const showLastBillingSetup = Boolean(account.lastBillingSetup)
    && (!account.canManageBilling || account.status !== "Active");
  const displayedBillingComponents = showLastBillingSetup
    ? account.lastBillingSetup?.components ?? []
    : account.billingComponents;
  // Keep history relationship-scoped even if callers later pass a broader collection.
  const lifecycleActivity = account.activity.filter((entry) => entry.saved === true && lifecycleEvents.has(entry.event) && entry.date).map((entry, index): AccountActivityItem => {
    const title = activityDisplayLabels[entry.event] ?? entry.event;
    return {
      date: entry.date,
      details: compactActivityDetails(
        entry.planName,
        entry.billingType,
        entry.amount?.trim() ? displayAmount(entry.currency ?? "", entry.amount) : undefined,
      ),
      id: entry.id,
      lifecycleEvent: entry.event,
      note: visibleLifecycleNote(title, entry.note || ""),
      order: index,
      title,
    };
  });
  const groupedLifecycleActivity = combineSameDayCancellationRestart(lifecycleActivity);
  const decisionActivity = (account.renewalPeriods ?? []).filter((period) => period.resolution && period.resolvedAt).map((period): AccountActivityItem => {
    const amount = displayAmount(period.currencySnapshot, period.amountSnapshot);
    const reason = period.notChargedReasonCode === "other" ? period.notChargedReasonText : period.notChargedReasonCode ? notChargedReasonLabels[period.notChargedReasonCode] : "";
    return {
      date: localResolvedDate(period.resolvedAt),
      description: period.resolution === "not_charged" ? reason : undefined,
      details: compactActivityDetails(period.planNameSnapshot, period.billingTypeSnapshot, amount),
      id: `renewal-decision-${period.id}`,
      note: period.resolution === "not_charged" ? period.notChargedNote.trim() : "",
      order: new Date(period.resolvedAt).getTime() || 0,
      title: period.resolution === "paid" ? "Payment confirmed" : "Payment not charged",
    };
  });
  const renewalPeriodsById = new Map((account.renewalPeriods ?? []).map((period) => [period.id, period]));
  const correctionActivity = (account.renewalActivities ?? []).map((entry): AccountActivityItem => ({
    date: renewalPeriodsById.get(entry.periodId)?.scheduledRenewalDate || entry.billingDate || entry.activityDate,
    details: compactActivityDetails(
      entry.planNameSnapshot,
      entry.billingTypeSnapshot,
      displayAmount(entry.currencySnapshot, entry.amountSnapshot),
    ),
    id: entry.id,
    note: "",
    order: new Date(entry.createdAt).getTime() || 0,
    title: entry.kind === "billing_schedule_changed" ? "Billing date updated" : "Billing details updated",
  }));
  const activity = [...groupedLifecycleActivity, ...decisionActivity, ...correctionActivity].filter((entry) => entry.date)
    .sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);

  return <div className="subscription-account-view" data-relationship-id={account.relationshipId}>
    <section className="subscription-account-card" aria-label="Account">
      <div className="subscription-account-header-section subscription-callout-tool">
        <span className="tool-logo" style={{ background: account.logoBackground }}>{account.logo}</span>
        <h2>{account.toolName}</h2>
      </div>
      <div className="subscription-account-header-section subscription-callout-account">
        <LinkedAccountCell accountLabel={account.accountLabel} login={account.accountEmail || "Not available"} tagClass={account.accountTag} />
      </div>
      <div className="subscription-account-header-section subscription-callout-lifecycle">
        <span className="tool-status-chip status-muted subscription-lifecycle-pill">{account.status}</span>
      </div>
      <div className="subscription-account-header-section subscription-callout-action">
        {account.canManageBilling ? pauseEligible ? <DropdownControl ariaLabel="Manage Subscription" className="subscription-lifecycle-dropdown" id="subscription-manage" isOpen={manageOpen} onOpenChange={(id) => setManageOpen(Boolean(id))} onChange={(value) => { if (value === "pause") setPauseOpen(true); }} placeholder="Manage Subscription" selectedLabel="Manage Subscription" value="" options={[{ value: "pause", label: "Pause subscription" }]} />
          : <button aria-label="Manage Subscription" className="subscription-manage-trigger" disabled title="No lifecycle actions are currently available" type="button"><span>Manage Subscription</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg></button>
          : null}
      </div>
    </section>

    <section className="subscription-account-section" aria-labelledby="subscription-current-billing">
      <div className="subscription-section-heading"><h3 id="subscription-current-billing">{showLastBillingSetup ? "Last Billing Setup" : "Current Billing"}</h3>{!showLastBillingSetup && account.state === "Incomplete" && account.billingComponents.length && account.canManageBilling ? <button className="btn-primary" type="button" onClick={() => { setContinueToPaymentAfterBilling(true); setEditingBilling(true); }}>Complete setup</button> : null}</div>
      {!displayedBillingComponents.length ? <div className="subscription-detail-empty subscription-setup-helper">
        <svg aria-hidden="true" className="subscription-warning-icon" viewBox="0 0 24 24"><path d="M12 3 22 21H2L12 3Z" /><path d="M12 9v5M12 17v1" /></svg>
        <div><strong>Your billing information is incomplete.</strong><p>Please complete the setup to keep track of your subscription.</p></div>
        {!showLastBillingSetup ? <button className="btn-primary" disabled={!account.canManageBilling} type="button" onClick={() => { setFirstTimeSetup(true); setPaymentChoice(true); }}>Set up billing</button> : null}
      </div> : <div className="subscription-current-components">
        {!showLastBillingSetup && account.state === "Complete" && account.canManageBilling && !editingBilling ? <button aria-label="Edit Current Billing" className="subscription-current-edit" type="button" onClick={() => { setContinueToPaymentAfterBilling(false); setEditingBilling(true); }}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 4.25-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.25 16 4 20Z" /><path d="m14.5 7.5 3 3" /></svg></button> : null}
        {displayedBillingComponents.map((component, index) => {
          const date = componentDate(component, showLastBillingSetup);
          return <dl className="subscription-current-component" key={component.id || `${component.billingType}-${index}`}>
            <div><dt>Plan Name</dt><dd>{account.planName.trim() ? <span className="tool-status-chip status-muted subscription-current-plan-pill">{account.planName.trim()}</span> : "Not set"}</dd></div>
            <div><dt>Billing Type</dt><dd>{component.billingType === "Top-up" ? "Top-up credit" : component.billingType === "One-time" ? "One-time payment" : component.billingType}</dd></div>
            <div><dt>Amount</dt><dd>{displayAmount(component.currency, component.amount)}</dd></div>
            <div><dt>{date.label}</dt><dd>{date.value ? billingHistoryDisplayDate(date.value) : "Not set"}</dd></div>
          </dl>;
        })}
      </div>}
      {!account.canManageBilling ? <p className="subscription-detail-empty">This historical relationship is read-only.</p> : null}
    </section>

    <UnconfirmedBillingSection
      canManage={account.canManageBilling}
      currencyOptions={actions.currencyOptions}
      onConfirmPaid={actions.onConfirmRenewalPaid}
      onEdit={actions.onUpdateRenewalPeriodSnapshot}
      onNotCharged={actions.onMarkRenewalNotCharged}
      onUndo={actions.onUndoRenewalResolution}
      periods={account.renewalPeriods}
      relationshipId={account.relationshipId}
    />

    <SubscriptionPayments account={account} canAdd={canAddPayment} currencyOptions={actions.currencyOptions} onChanged={actions.onPaymentsChanged} onUpdateCurrentBillingAmount={async (relationshipId, billingType, currency, amount) => {
      if (relationshipId !== account.relationshipId) throw new Error("The selected relationship changed.");
      const componentIndex = account.billingComponents.findIndex((component) => component.billingType === billingType);
      if (componentIndex < 0) throw new Error("This payment no longer matches Current Billing.");
      const components = account.billingComponents.map((component, index) => index === componentIndex ? { ...component, currency, amount } : component);
      await actions.onSaveBilling(relationshipId, account.planName, components);
    }} />

    <section className="subscription-account-section" aria-labelledby="subscription-account-activity">
      <h3 id="subscription-account-activity">Account Activity</h3>
      {activity.length ? <ul className="subscription-activity-list">{activity.map((entry) => <li key={entry.id}>
        <span className="subscription-activity-date">{billingHistoryDisplayDate(entry.date)}</span>
        <div className="subscription-activity-event">
          <strong>{entry.title}</strong>
          {entry.description ? <p className="subscription-activity-description">{entry.description}</p> : null}
          <ActivityMetadata parts={entry.details} />
          {entry.note ? <p className="subscription-activity-note">{entry.note}</p> : null}
        </div>
      </li>)}</ul> : <p className="subscription-detail-empty subscription-activity-empty">No recorded lifecycle changes for this account.</p>}
    </section>
    {paymentPrompt ? <div className="welcome-modal-overlay" role="presentation"><section className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="subscription-payment-prompt">
      <h2 id="subscription-payment-prompt">Record a payment?</h2>
      <p>Add this billing cycle now, or add several past billing records.</p>
      <div className="welcome-modal-actions"><button className="btn-sm" type="button" onClick={() => setPaymentPrompt(false)}>Not now</button><button className="btn-primary" type="button" onClick={() => { setPaymentPrompt(false); setPaymentChoice(true); }}>Add payment</button></div>
    </section></div> : null}
    {pauseOpen ? <PauseSubscriptionModal onCancel={() => setPauseOpen(false)} onConfirm={async (requestId, input) => {
      await actions.onPauseSubscription(account.relationshipId, requestId, input);
      setPauseOpen(false);
    }} /> : null}
    {editingBilling ? <div className="welcome-modal-overlay" role="presentation"><section className="welcome-modal subscription-current-billing-modal" role="dialog" aria-modal="true" aria-labelledby="subscription-current-billing-modal-title">
      <h2 id="subscription-current-billing-modal-title">Edit Current Billing</h2>
      <SubscriptionBillingEditor account={account} {...actions} onClose={() => { setEditingBilling(false); setContinueToPaymentAfterBilling(false); }} onSaved={(planName, billingComponents) => {
        setEditingBilling(false);
        if (continueToPaymentAfterBilling) {
          setPaymentPrefill({ planName, billingComponents });
          setPaymentChoice(true);
        }
        setContinueToPaymentAfterBilling(false);
      }} />
    </section></div> : null}
    {paymentChoice ? <BillingPastEntryModal relationships={[paymentAccount]} initialRelationshipId={account.relationshipId} lockedRelationshipId={account.relationshipId} billingComponents={paymentAccount.billingComponents} onCancel={() => { setPaymentChoice(false); setFirstTimeSetup(false); setPaymentPrefill(null); }} onContinue={(relationship, mode, billingType) => { if (relationship.relationshipId !== account.relationshipId) return; setPaymentChoice(false); setPaymentComponentType(billingType); setPaymentMode(mode); }} /> : null}
    {paymentMode ? <BillingHistoryPanel prefillCurrentBilling selectedBillingType={paymentComponentType} onEstablishCurrentBilling={shouldUpdateCurrentBilling ? async (relationshipId, planName, components) => { if (relationshipId !== account.relationshipId) throw new Error("The selected relationship changed."); const merged = paymentAccount.billingComponents.map((existing) => {
        const updated = components.find((component) => component.billingType === existing.billingType);
        return updated ? { ...updated, id: existing.id } : existing;
      });
      merged.push(...components.filter((component) => !paymentAccount.billingComponents.some((existing) => existing.billingType === component.billingType)));
      await actions.onSaveBilling(relationshipId, planName, merged); } : undefined} onSetupComplete={firstTimeSetup ? finishPaymentFlow : undefined} accounts={[{ accountActivity: paymentAccount.activity, accountEmail: paymentAccount.accountEmail, accountLabel: paymentAccount.accountLabel, accountTag: paymentAccount.accountTag, billingAmounts: paymentAccount.billingComponents, planName: paymentAccount.planName, relationshipId: paymentAccount.relationshipId }]} initialRelationshipId={account.relationshipId} initialEntryMode={paymentMode} toolName={account.toolName} toolLogo={account.logo} toolLogoBackground={account.logoBackground}
      onClose={finishPaymentFlow}
      onChangeRelationship={() => { setPaymentMode(null); setPaymentChoice(true); }} /> : null}
  </div>;
}
