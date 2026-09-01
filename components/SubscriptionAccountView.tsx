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

const lifecycleEvents = new Set(["Trial Started", "Trial Converted to Paid", "Plan Changed", "Paused", "Resumed", "Cancelled"]);

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
  const finishFirstTimeSetup = () => { setPaymentMode(null); setPaymentChoice(false); setFirstTimeSetup(false); actions.onPaymentsChanged?.(); };
  const canAddPayment = Boolean(account.relationshipId && account.canManageBilling) && !editingBilling && statusDraft === null && !statusBusy;
  // Keep history relationship-scoped even if callers later pass a broader collection.
  const activity = account.activity.filter((entry) => entry.saved === true && lifecycleEvents.has(entry.event) && entry.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  const activityGroups = activity.reduce<Array<{ date: string; entries: typeof activity }>>((groups, entry) => {
    const currentGroup = groups[groups.length - 1];
    if (currentGroup?.date === entry.date) currentGroup.entries.push(entry);
    else groups.push({ date: entry.date, entries: [entry] });
    return groups;
  }, []);

  return <div className="subscription-account-view" data-relationship-id={account.relationshipId}>
    <section className="subscription-account-card" aria-label="Account">
      <div className="subscription-callout-identity">
        <span className="tool-logo" style={{ background: account.logoBackground }}>{account.logo}</span>
        <div><div className="subscription-callout-title"><h2>{account.toolName}</h2></div><LinkedAccountCell accountLabel={account.accountLabel} login={account.accountEmail || "Not available"} tagClass={account.accountTag} /></div>
      </div>
      <div className="subscription-callout-status">
        {account.canManageBilling ? <fieldset className="billing-current-fields" disabled={statusBusy || editingBilling}>
          <DropdownControl ariaLabel="Account Status" id="subscription-status" isOpen={statusOpen} onOpenChange={(id) => setStatusOpen(Boolean(id))} onChange={(value) => { setStatusDraft(value as ManageStatus); setStatusOpen(false); setStatusError(""); }} value={statusDraft ?? account.status} options={["Active", "On a Break", "Goodbye"].map((value) => ({ value, label: value === "On a Break" ? "On a break" : value }))} />
          {statusDraft !== null ?
          <div className="welcome-modal-actions"><button className="btn-sm" type="button" onClick={() => { setStatusDraft(null); setStatusOpen(false); }}>Cancel</button><button className="btn-sm" type="button" onClick={async () => { setStatusBusy(true); setStatusError(""); try { await actions.onSaveStatus(account.relationshipId, statusDraft); setStatusDraft(null); } catch (error) { setStatusError(error instanceof Error ? error.message : "Could not save status."); } finally { setStatusBusy(false); } }}>Save changes</button></div>
          : null}
        </fieldset> : <span>{account.status === "On a Break" ? "On a break" : account.status}</span>}
        {statusError ? <small className="field-feedback error" role="alert">{statusError}</small> : null}
      </div>
    </section>

    <section className="subscription-account-section" aria-labelledby="subscription-current-billing">
      <div className="subscription-section-heading"><h3 id="subscription-current-billing">Current Billing</h3></div>
      {account.state !== "Complete" || !account.billingComponents.length ? <div className="subscription-detail-empty subscription-setup-helper">
        <svg aria-hidden="true" className="subscription-warning-icon" viewBox="0 0 24 24"><path d="M12 3 22 21H2L12 3Z" /><path d="M12 9v5M12 17v1" /></svg>
        <div><strong>Your billing information is incomplete.</strong><p>Please complete the setup to keep track of your subscription.</p></div>
        <button className="btn-primary" disabled={!account.canManageBilling || statusDraft !== null || statusBusy} type="button" onClick={() => { if (account.state === "Not started" || account.state === "Incomplete") { setFirstTimeSetup(true); setPaymentChoice(true); } else setEditingBilling(true); }}>{account.state === "Incomplete" ? "Complete setup" : "Set up billing"}</button>
      </div> : <div className="subscription-current-components">
        {account.canManageBilling && !editingBilling ? <button aria-label="Edit Current Billing" className="subscription-current-edit" disabled={statusDraft !== null || statusBusy} type="button" onClick={() => setEditingBilling(true)}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 4.25-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.25 16 4 20Z" /><path d="m14.5 7.5 3 3" /></svg></button> : null}
        {account.billingComponents.map((component, index) => {
          const date = componentDate(component);
          return <dl className="subscription-current-component" key={component.id || `${component.billingType}-${index}`}>
            <div><dt>Plan Name</dt><dd>{account.planName.trim() || "Not set"}</dd></div>
            <div><dt>Billing Type</dt><dd>{component.billingType === "Top-up" ? "Top-up credit" : component.billingType === "One-time" ? "One-time payment" : component.billingType}</dd></div>
            <div><dt>Amount</dt><dd>{component.currency.trim() && component.amount.trim() ? displayAmount(component.currency, component.amount) : "Not set"}</dd></div>
            <div><dt>{date.label}</dt><dd>{date.value ? billingHistoryDisplayDate(date.value) : "Not set"}</dd></div>
          </dl>;
        })}
      </div>}
      {!account.canManageBilling ? <p className="subscription-detail-empty">This historical relationship is read-only.</p> : null}
    </section>

    <SubscriptionPayments account={account} canAdd={canAddPayment} currencyOptions={actions.currencyOptions} onChanged={actions.onPaymentsChanged} />

    <section className="subscription-account-section" aria-labelledby="subscription-account-activity">
      <h3 id="subscription-account-activity">Account Activity</h3>
      {activityGroups.length ? <ul className="subscription-activity-list">{activityGroups.map((group) => <li key={group.date}>
        <span>{billingHistoryDisplayDate(group.date)}</span><div className="subscription-activity-events">{group.entries.map((entry) => <div className="subscription-activity-event" key={entry.id}><strong>{entry.event}{entry.planName ? ` · ${entry.planName}` : ""}</strong>{entry.note ? <p>{entry.note}</p> : null}</div>)}</div>
      </li>)}</ul> : <p className="subscription-detail-empty subscription-activity-empty">No recorded lifecycle changes for this account.</p>}
    </section>
    {paymentPrompt ? <div className="welcome-modal-overlay" role="presentation"><section className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="subscription-payment-prompt">
      <h2 id="subscription-payment-prompt">Record a payment?</h2>
      <p>Add this billing cycle now, or add several past billing records.</p>
      <div className="welcome-modal-actions"><button className="btn-sm" type="button" onClick={() => setPaymentPrompt(false)}>Not now</button><button className="btn-primary" type="button" onClick={() => { setPaymentPrompt(false); setPaymentChoice(true); }}>Add payment</button></div>
    </section></div> : null}
    {editingBilling ? <div className="welcome-modal-overlay" role="presentation"><section className="welcome-modal subscription-current-billing-modal" role="dialog" aria-modal="true" aria-labelledby="subscription-current-billing-modal-title">
      <h2 id="subscription-current-billing-modal-title">Edit Current Billing</h2>
      <SubscriptionBillingEditor account={account} {...actions} onClose={() => setEditingBilling(false)} />
    </section></div> : null}
    {paymentChoice ? <BillingPastEntryModal relationships={[account]} initialRelationshipId={account.relationshipId} lockedRelationshipId={account.relationshipId} billingComponents={account.billingComponents} onCancel={() => { setPaymentChoice(false); setFirstTimeSetup(false); }} onContinue={(relationship, mode, billingType) => { if (relationship.relationshipId !== account.relationshipId) return; setPaymentChoice(false); setPaymentComponentType(billingType); setPaymentMode(mode); }} /> : null}
    {paymentMode ? <BillingHistoryPanel prefillCurrentBilling selectedBillingType={paymentComponentType} onEstablishCurrentBilling={firstTimeSetup ? async (relationshipId, planName, components) => { if (relationshipId !== account.relationshipId) throw new Error("The selected relationship changed."); const merged = account.billingComponents.map((existing) => {
        const updated = components.find((component) => component.billingType === existing.billingType);
        return updated ? { ...updated, id: existing.id } : existing;
      });
      merged.push(...components.filter((component) => !account.billingComponents.some((existing) => existing.billingType === component.billingType)));
      await actions.onSaveBilling(relationshipId, planName, merged); } : undefined} onSetupComplete={firstTimeSetup ? finishFirstTimeSetup : undefined} accounts={[{ accountActivity: account.activity, accountEmail: account.accountEmail, accountLabel: account.accountLabel, accountTag: account.accountTag, billingAmounts: account.billingComponents, planName: account.planName, relationshipId: account.relationshipId }]} initialRelationshipId={account.relationshipId} initialEntryMode={paymentMode} toolName={account.toolName} toolLogo={account.logo} toolLogoBackground={account.logoBackground}
      onClose={finishFirstTimeSetup}
      onChangeRelationship={() => { setPaymentMode(null); setPaymentChoice(true); }} /> : null}
  </div>;
}
