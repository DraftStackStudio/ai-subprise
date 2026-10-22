import { LinkedAccountCell } from "@/components/ToolRowRenderer";
import type { SubscriptionRow } from "@/components/SubscriptionsView";
import type { BillingAmount, RetiredBillingAmount } from "@/types/toolDetail";
import type { SubscriptionLifecycleEvent } from "@/types/subscriptionLifecycleEvent";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import { useRef, useState } from "react";
import { DropdownControl } from "@/components/DropdownControls";
import SubscriptionBillingEditor, { type SubscriptionActions } from "@/components/SubscriptionBillingEditor";
import PauseSubscriptionModal from "@/components/PauseSubscriptionModal";
import ResumeSubscriptionModal from "@/components/ResumeSubscriptionModal";
import BillingPastEntryModal from "@/components/BillingPastEntryModal";
import BillingHistoryPanel from "@/components/BillingHistoryPanel";
import AccountActivityTable from "@/components/AccountActivityTable";
import SubscriptionPayments from "@/components/SubscriptionPayments";
import type { PaymentBillingDifferenceChoice } from "@/components/PaymentBillingDifferenceChoice";
import UnconfirmedBillingSection from "@/components/UnconfirmedBillingSection";
import { canPauseSubscription } from "@/lib/subscriptionPause";
import { canResumeSubscription, currentPauseEventForResume, type ResumeBillingType } from "@/lib/subscriptionResume";
import { isTrustedCurrentBillingRevision } from "@/lib/currentBillingChange";
import { localBillingToday } from "@/lib/currentBilling";
import type { UpdateCurrentBillingInput } from "@/types/currentBillingChange";

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
  const [resumeContext, setResumeContext] = useState<{ pauseEvent: SubscriptionLifecycleEvent; retiredComponent: RetiredBillingAmount } | null>(null);
  const [paymentBillingUpdate, setPaymentBillingUpdate] = useState<{ components: BillingAmount[]; mode: "change" | "correction" } | null>(null);
  const setupSubmission = useRef<{ input: UpdateCurrentBillingInput; signature: string } | null>(null);
  const paymentAccount = paymentPrefill ? { ...account, planName: paymentPrefill.planName, billingComponents: paymentPrefill.billingComponents } : account;
  const finishPaymentFlow = () => { setPaymentMode(null); setPaymentChoice(false); setFirstTimeSetup(false); setPaymentPrefill(null); actions.onPaymentsChanged?.(); };
  const canAddPayment = Boolean(account.relationshipId && account.canManageBilling) && !editingBilling;
  const pauseEligible = canPauseSubscription({ canManageBilling: account.canManageBilling, lifecycleStatus: account.status, planStatus: account.planStatus });
  const currentPauseEvent = currentPauseEventForResume(account.lifecycleEvents, account.relationshipId);
  const retiredResumeComponent = currentPauseEvent
    ? account.retiredBillingComponents?.find((component) => component.id === currentPauseEvent.previousBillingComponentId)
    : undefined;
  const resumeEligible = canResumeSubscription({
    canManageBilling: account.canManageBilling,
    lifecycleStatus: account.status,
    planStatus: account.planStatus,
    retiredBillingType: retiredResumeComponent?.billingType ?? "",
    retiredComponentId: retiredResumeComponent?.id ?? "",
  });
  const activeRenewalNeedsReview = account.status === "Active" && account.billingComponents.some((component) => (
    (component.billingType === "Monthly" || component.billingType === "Yearly") && !component.nextRenewalDate
  ));
  const currentBillingUpdateEligible = account.canManageBilling
    && account.status === "Active"
    && (account.planStatus === "Active" || account.planStatus === "Paid")
    && account.state === "Complete";
  const requestPaymentBillingUpdate = (relationshipId: string, billingType: string, currency: string, amount: string, choice: Exclude<PaymentBillingDifferenceChoice, "unknown">) => {
    if (!currentBillingUpdateEligible || !isTrustedCurrentBillingRevision(account.currentBillingRevision) || relationshipId !== account.relationshipId) return;
    const componentIndex = account.billingComponents.findIndex((component) => component.billingType === billingType);
    if (componentIndex < 0) return;
    const components = account.billingComponents.map((component, index) => index === componentIndex ? { ...component, currency, amount } : component);
    setPaymentBillingUpdate({ components, mode: choice });
    setContinueToPaymentAfterBilling(false);
    setPaymentMode(null);
    setEditingBilling(true);
  };
  const saveInitialCurrentBilling = async (relationshipId: string, planName: string, components: BillingAmount[]) => {
    if (relationshipId !== account.relationshipId) throw new Error("The selected relationship changed.");
    if (!isTrustedCurrentBillingRevision(account.currentBillingRevision)) {
      throw new Error("Current Billing could not be verified. Reopen setup before saving.");
    }
    const signature = JSON.stringify({
      components,
      expectedRevision: account.currentBillingRevision,
      planName: planName.trim(),
      relationshipId,
    });
    if (setupSubmission.current?.signature !== signature) {
      const requestId = globalThis.crypto?.randomUUID?.();
      if (!requestId) throw new Error("A stable Current Billing request ID could not be created.");
      const localDate = localBillingToday();
      setupSubmission.current = {
        input: {
          components: components.map((component) => ({ ...component })),
          effectiveDate: localDate,
          expectedRevision: account.currentBillingRevision,
          localDate,
          mode: "change",
          planName: planName.trim(),
          reason: null,
          relationshipId,
          requestId,
        },
        signature,
      };
    }
    return actions.onSaveBilling(setupSubmission.current.input);
  };
  const showLastBillingSetup = Boolean(account.lastBillingSetup)
    && (!account.canManageBilling || account.status !== "Active");
  const displayedBillingComponents = showLastBillingSetup
    ? account.lastBillingSetup?.components ?? []
    : account.billingComponents;
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
        <span className="tool-status-chip">{account.status}</span>
      </div>
      <div className="subscription-account-header-section subscription-callout-action">
        {account.canManageBilling ? pauseEligible || resumeEligible ? <DropdownControl ariaLabel="Manage Subscription" className="subscription-lifecycle-dropdown" id="subscription-manage" isOpen={manageOpen} onOpenChange={(id) => setManageOpen(Boolean(id))} onChange={(value) => { if (value === "pause") setPauseOpen(true); if (value === "resume" && currentPauseEvent && retiredResumeComponent) setResumeContext({ pauseEvent: currentPauseEvent, retiredComponent: retiredResumeComponent }); }} placeholder="Manage Subscription" selectedLabel="Manage Subscription" value="" options={pauseEligible ? [{ value: "pause", label: "Pause subscription" }] : [{ value: "resume", label: "Resume subscription" }]} />
          : <button aria-label="Manage Subscription" className="subscription-manage-trigger" disabled title="No lifecycle actions are currently available" type="button"><span>Manage Subscription</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg></button>
          : null}
      </div>
    </section>

    <section className="subscription-account-section" aria-labelledby="subscription-current-billing">
      <div className="subscription-section-heading"><h3 id="subscription-current-billing">{showLastBillingSetup ? "Last Billing Setup" : "Current Billing"}</h3>{!showLastBillingSetup && account.state === "Incomplete" && account.billingComponents.length && account.canManageBilling ? <button className="btn-primary" type="button" onClick={() => { setContinueToPaymentAfterBilling(true); setEditingBilling(true); }}>Complete setup</button> : null}</div>
      {activeRenewalNeedsReview ? <div className="subscription-resume-review-warning"><strong>Next renewal needs review.</strong><span>Add the confirmed date before relying on renewal reminders.</span></div> : null}
      {!displayedBillingComponents.length ? <div className="subscription-detail-empty subscription-setup-helper">
        <svg aria-hidden="true" className="subscription-warning-icon" viewBox="0 0 24 24"><path d="M12 3 22 21H2L12 3Z" /><path d="M12 9v5M12 17v1" /></svg>
        <div><strong>Your billing information is incomplete.</strong><p>Please complete the setup to keep track of your subscription.</p></div>
        {!showLastBillingSetup ? <button className="btn-primary" disabled={!account.canManageBilling} type="button" onClick={() => { setFirstTimeSetup(true); setPaymentChoice(true); }}>Set up billing</button> : null}
      </div> : <div className="subscription-current-components">
        {!showLastBillingSetup && currentBillingUpdateEligible && !editingBilling ? <button aria-label="Edit Current Billing" className="subscription-current-edit" type="button" onClick={() => { setContinueToPaymentAfterBilling(false); setEditingBilling(true); }}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 4.25-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.25 16 4 20Z" /><path d="m14.5 7.5 3 3" /></svg></button> : null}
        {displayedBillingComponents.map((component, index) => {
          const date = componentDate(component, showLastBillingSetup);
          return <dl className="subscription-current-component" key={component.id || `${component.billingType}-${index}`}>
            <div><dt>Plan Name</dt><dd>{account.planName.trim() ? <span className="tool-status-chip">{account.planName.trim()}</span> : "Not set"}</dd></div>
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

    <SubscriptionPayments account={account} canAdd={canAddPayment} currencyOptions={actions.currencyOptions} onChanged={actions.onPaymentsChanged} onRequestCurrentBillingUpdate={currentBillingUpdateEligible && isTrustedCurrentBillingRevision(account.currentBillingRevision) ? requestPaymentBillingUpdate : undefined} />

    <section className="subscription-account-section" aria-labelledby="subscription-account-activity">
      <h3 id="subscription-account-activity">Account Activity</h3>
      <AccountActivityTable
        billingEvents={account.billingEvents}
        historicalEntries={account.activity}
        lifecycleEvents={account.lifecycleEvents}
        relationshipId={account.relationshipId}
        renewalActivities={account.renewalActivities}
        renewalPeriods={account.renewalPeriods}
        transactions={account.payments}
      />
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
    {resumeContext ? <ResumeSubscriptionModal
      currencyOptions={actions.currencyOptions}
      onCancel={() => setResumeContext(null)}
      onComplete={() => setResumeContext(null)}
      onRecordPayment={(lifecycleEventId, input) => actions.onRecordResumePayment(account.relationshipId, lifecycleEventId, input)}
      onResume={(requestId, pauseEventId, input) => actions.onResumeSubscription(account.relationshipId, requestId, pauseEventId, input)}
      pauseEventId={resumeContext.pauseEvent.id}
      planName={resumeContext.pauseEvent.planNameSnapshot || resumeContext.pauseEvent.previousPlanName || account.planName}
      previousAmount={resumeContext.retiredComponent.amount}
      previousBillingType={resumeContext.retiredComponent.billingType as ResumeBillingType}
      previousCurrency={resumeContext.retiredComponent.currency}
    /> : null}
    {editingBilling ? <div className="welcome-modal-overlay" role="presentation"><section className="welcome-modal subscription-current-billing-modal" role="dialog" aria-modal="true" aria-labelledby="subscription-current-billing-modal-title">
      <h2 id="subscription-current-billing-modal-title">Edit Current Billing</h2>
      <SubscriptionBillingEditor account={account} {...actions} preparedUpdate={currentBillingUpdateEligible && !continueToPaymentAfterBilling ? { initialComponents: paymentBillingUpdate?.components, initialMode: paymentBillingUpdate?.mode, onSubmit: actions.onUpdateCurrentBilling, revision: account.currentBillingRevision } : undefined} onClose={() => { setEditingBilling(false); setContinueToPaymentAfterBilling(false); setPaymentBillingUpdate(null); }} onSaved={(planName, billingComponents) => {
        setEditingBilling(false);
        setPaymentBillingUpdate(null);
        if (continueToPaymentAfterBilling) {
          setPaymentPrefill({ planName, billingComponents });
          setPaymentChoice(true);
        }
        setContinueToPaymentAfterBilling(false);
      }} />
    </section></div> : null}
    {paymentChoice ? <BillingPastEntryModal relationships={[paymentAccount]} initialRelationshipId={account.relationshipId} lockedRelationshipId={account.relationshipId} billingComponents={paymentAccount.billingComponents} onCancel={() => { setPaymentChoice(false); setFirstTimeSetup(false); setPaymentPrefill(null); }} onContinue={(relationship, mode, billingType) => { if (relationship.relationshipId !== account.relationshipId) return; setPaymentChoice(false); setPaymentComponentType(billingType); setPaymentMode(mode); }} /> : null}
    {paymentMode ? <BillingHistoryPanel prefillCurrentBilling selectedBillingType={paymentComponentType} onEstablishCurrentBilling={firstTimeSetup ? async (relationshipId, planName, components) => { if (relationshipId !== account.relationshipId) throw new Error("The selected relationship changed."); const merged = paymentAccount.billingComponents.map((existing) => {
        const updated = components.find((component) => component.billingType === existing.billingType);
        return updated ? { ...updated, id: existing.id } : existing;
      });
      merged.push(...components.filter((component) => !paymentAccount.billingComponents.some((existing) => existing.billingType === component.billingType)));
      await saveInitialCurrentBilling(relationshipId, planName, merged); } : undefined} onRequestCurrentBillingUpdate={!firstTimeSetup && paymentMode === "period" && currentBillingUpdateEligible && isTrustedCurrentBillingRevision(account.currentBillingRevision) ? requestPaymentBillingUpdate : undefined} onPaymentsSaved={!firstTimeSetup && paymentMode === "period" ? actions.onPaymentsChanged : undefined} onSetupComplete={firstTimeSetup ? finishPaymentFlow : undefined} accounts={[{ accountActivity: paymentAccount.activity, accountEmail: paymentAccount.accountEmail, accountLabel: paymentAccount.accountLabel, accountTag: paymentAccount.accountTag, billingAmounts: paymentAccount.billingComponents, billingEvents: paymentAccount.billingEvents, lifecycleEvents: paymentAccount.lifecycleEvents, planName: paymentAccount.planName, relationshipId: paymentAccount.relationshipId, renewalActivities: paymentAccount.renewalActivities, renewalPeriods: paymentAccount.renewalPeriods }]} initialRelationshipId={account.relationshipId} initialEntryMode={paymentMode} toolName={account.toolName} toolLogo={account.logo} toolLogoBackground={account.logoBackground}
      onClose={finishPaymentFlow}
      onChangeRelationship={() => { setPaymentMode(null); setPaymentChoice(true); }} /> : null}
  </div>;
}
