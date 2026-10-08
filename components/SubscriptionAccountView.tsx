import { LinkedAccountCell } from "@/components/ToolRowRenderer";
import type { SubscriptionRow } from "@/components/SubscriptionsView";
import type { BillingAmount } from "@/types/toolDetail";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import { useState } from "react";
import { DropdownControl } from "@/components/DropdownControls";
import type { ManageStatus } from "@/types/toolDetail";
import SubscriptionBillingEditor, { type SubscriptionActions } from "@/components/SubscriptionBillingEditor";
import BillingPastEntryModal from "@/components/BillingPastEntryModal";
import BillingHistoryPanel from "@/components/BillingHistoryPanel";
import SubscriptionPayments from "@/components/SubscriptionPayments";
import UnconfirmedBillingSection from "@/components/UnconfirmedBillingSection";

function displayAmount(currency: string, amount: string) {
  return currency.trim() && amount.trim() ? `${currency.trim()} ${amount.trim()}` : "—";
}

function componentDate(component: BillingAmount) {
  switch (component.billingType) {
    case "Monthly":
    case "Yearly": return { label: "Next renewal", value: component.nextRenewalDate };
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
  const [statusDraft, setStatusDraft] = useState<ManageStatus | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState("");
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
  const canAddPayment = Boolean(account.relationshipId && account.canManageBilling) && !editingBilling && statusDraft === null && !statusBusy;
  // Keep history relationship-scoped even if callers later pass a broader collection.
  const lifecycleActivity = account.activity.filter((entry) => entry.saved === true && lifecycleEvents.has(entry.event) && entry.date).map((entry, index): AccountActivityItem => {
    const title = activityDisplayLabels[entry.event] ?? entry.event;
    return {
      date: entry.date,
      details: compactActivityDetails(entry.planName, entry.billingType),
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
      <div className="subscription-callout-identity">
        <span className="tool-logo" style={{ background: account.logoBackground }}>{account.logo}</span>
        <div><div className="subscription-callout-title"><h2>{account.toolName}</h2></div><LinkedAccountCell accountLabel={account.accountLabel} login={account.accountEmail || "Not available"} tagClass={account.accountTag} /></div>
      </div>
      <div className="subscription-callout-status">
        {account.canManageBilling ? <fieldset className="billing-current-fields" disabled={statusBusy || editingBilling}>
          <DropdownControl ariaLabel="Account Status" className="subscription-lifecycle-dropdown" id="subscription-status" isOpen={statusOpen} onOpenChange={(id) => setStatusOpen(Boolean(id))} onChange={(value) => { setStatusDraft(value as ManageStatus); setStatusOpen(false); setStatusError(""); }} value={statusDraft ?? account.status} options={["Active", "Paused", "Goodbye"].map((value) => ({ value, label: value }))} />
          {statusDraft !== null ?
          <div className="welcome-modal-actions"><button className="btn-sm" type="button" onClick={() => { setStatusDraft(null); setStatusOpen(false); }}>Cancel</button><button className="btn-sm" type="button" onClick={async () => { setStatusBusy(true); setStatusError(""); try { await actions.onSaveStatus(account.relationshipId, statusDraft); setStatusDraft(null); } catch (error) { setStatusError(error instanceof Error ? error.message : "Could not save status."); } finally { setStatusBusy(false); } }}>Save changes</button></div>
          : null}
        </fieldset> : <span>{account.status}</span>}
        {statusError ? <small className="field-feedback error" role="alert">{statusError}</small> : null}
      </div>
    </section>

    <section className="subscription-account-section" aria-labelledby="subscription-current-billing">
      <div className="subscription-section-heading"><h3 id="subscription-current-billing">Current Billing</h3>{account.state === "Incomplete" && account.billingComponents.length && account.canManageBilling ? <button className="btn-primary" disabled={statusDraft !== null || statusBusy} type="button" onClick={() => { setContinueToPaymentAfterBilling(true); setEditingBilling(true); }}>Complete setup</button> : null}</div>
      {!account.billingComponents.length ? <div className="subscription-detail-empty subscription-setup-helper">
        <svg aria-hidden="true" className="subscription-warning-icon" viewBox="0 0 24 24"><path d="M12 3 22 21H2L12 3Z" /><path d="M12 9v5M12 17v1" /></svg>
        <div><strong>Your billing information is incomplete.</strong><p>Please complete the setup to keep track of your subscription.</p></div>
        <button className="btn-primary" disabled={!account.canManageBilling || statusDraft !== null || statusBusy} type="button" onClick={() => { setFirstTimeSetup(true); setPaymentChoice(true); }}>Set up billing</button>
      </div> : <div className="subscription-current-components">
        {account.state === "Complete" && account.canManageBilling && !editingBilling ? <button aria-label="Edit Current Billing" className="subscription-current-edit" disabled={statusDraft !== null || statusBusy} type="button" onClick={() => { setContinueToPaymentAfterBilling(false); setEditingBilling(true); }}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 4.25-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.25 16 4 20Z" /><path d="m14.5 7.5 3 3" /></svg></button> : null}
        {account.billingComponents.map((component, index) => {
          const date = componentDate(component);
          return <dl className="subscription-current-component" key={component.id || `${component.billingType}-${index}`}>
            <div><dt>Plan Name</dt><dd>{account.planName.trim() ? <span className={`tool-status-chip subscription-current-plan-pill ${account.planTone}`}>{account.planName.trim()}</span> : "Not set"}</dd></div>
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
