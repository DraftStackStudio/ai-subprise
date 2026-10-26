"use client";

import { useRef, useState } from "react";
import DateFieldControl from "@/components/DateFieldControl";
import { DropdownControl, MultiSelectDropdownControl, type DropdownOption } from "@/components/DropdownControls";
import type { BillingAmount } from "@/types/toolDetail";
import type { PauseSubscriptionInput } from "@/lib/subscriptionPause";
import type { ResumePaymentInput, ResumeSubscriptionInput } from "@/lib/subscriptionResume";
import type { ResumeSubscriptionResult } from "@/types/subscriptionLifecycleEvent";
import type { SubscriptionRow } from "@/components/SubscriptionsView";
import type { BillingRenewalExactMutationResult, BillingRenewalMutationResult, BillingRenewalPeriod, MarkBillingRenewalNotChargedInput, UpdateBillingRenewalPaymentInput, UpdateBillingRenewalPeriodSnapshotInput } from "@/types/billingRenewalPeriod";
import type { CurrentBillingChangeMode, CurrentBillingRevision, UpdateCurrentBillingInput, UpdateCurrentBillingResult } from "@/types/currentBillingChange";
import { localBillingToday } from "@/lib/currentBilling";
import { compareCurrentBilling, isTrustedCurrentBillingRevision } from "@/lib/currentBillingChange";
import { currentBillingComparisonActivityItem } from "@/lib/accountActivity";
import { validSubscriptionBillingTypes } from "@/lib/subscriptions";
import styles from "./SubscriptionBillingEditor.module.css";

export type SubscriptionActions = {
  currencyOptions: DropdownOption[];
  onConfirmRenewalPaid: (relationshipId: string, periodId: string) => Promise<BillingRenewalMutationResult>;
  onMarkRenewalNotCharged: (relationshipId: string, periodId: string, input: MarkBillingRenewalNotChargedInput) => Promise<BillingRenewalMutationResult>;
  onPauseSubscription: (relationshipId: string, requestId: string, input: PauseSubscriptionInput) => Promise<void>;
  onResumeSubscription: (relationshipId: string, requestId: string, pauseEventId: string, input: ResumeSubscriptionInput) => Promise<ResumeSubscriptionResult>;
  onRecordResumePayment: (relationshipId: string, lifecycleEventId: string, input: ResumePaymentInput) => Promise<void>;
  onSaveBilling: (input: UpdateCurrentBillingInput) => Promise<UpdateCurrentBillingResult>;
  onUpdateCurrentBilling: (input: UpdateCurrentBillingInput) => Promise<UpdateCurrentBillingResult>;
  onUndoRenewalResolution: (relationshipId: string, periodId: string) => Promise<BillingRenewalMutationResult>;
  onUpdateRenewalPayment: (relationshipId: string, periodId: string, paymentTransactionId: string, input: UpdateBillingRenewalPaymentInput) => Promise<BillingRenewalExactMutationResult>;
  onUpdateRenewalPeriodSnapshot: (relationshipId: string, periodId: string, input: UpdateBillingRenewalPeriodSnapshotInput) => Promise<BillingRenewalPeriod>;
  onPaymentsChanged?: () => void;
};

const types = ["Monthly", "Yearly", "Lifetime", "One-time", "Top-up"];
const label = (type: string) => type === "One-time" ? "One-time payment" : type === "Top-up" ? "Top-up credit" : type;
const copyRevision = (revision: CurrentBillingRevision | null) => revision ? {
  planName: revision.planName,
  components: Object.fromEntries(Object.entries(revision.components).map(([slot, component]) => [
    slot,
    component ? { ...component } : component,
  ])) as CurrentBillingRevision["components"],
} : null;

export type PreparedCurrentBillingUpdate = {
  initialComponents?: BillingAmount[];
  initialMode?: CurrentBillingChangeMode;
  onSubmit?: (input: UpdateCurrentBillingInput) => Promise<UpdateCurrentBillingResult | void>;
  revision: CurrentBillingRevision | null;
};

export default function SubscriptionBillingEditor({ account, currencyOptions, onSaveBilling, onClose, onSaved, preparedUpdate }: SubscriptionActions & {
  account: SubscriptionRow;
  onClose: () => void;
  onSaved?: (planName: string, components: BillingAmount[]) => void;
  preparedUpdate?: PreparedCurrentBillingUpdate;
}) {
  const [planName, setPlanName] = useState(account.planName);
  const initialComponents = preparedUpdate?.initialComponents ?? account.billingComponents;
  const [draft, setDraft] = useState<BillingAmount[]>(initialComponents.map((item) => ({ ...item, currency: item.currency.trim() ? item.currency : initialComponents.find((component) => component.currency.trim())?.currency ?? "" })));
  const [updateMode, setUpdateMode] = useState<CurrentBillingChangeMode | null>(preparedUpdate?.initialMode ?? null);
  const [effectiveDate, setEffectiveDate] = useState(localBillingToday());
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const requestId = useRef<string | null>(null);
  const openedRevision = useRef(copyRevision(preparedUpdate ? preparedUpdate.revision : account.currentBillingRevision));
  const openedPlanName = useRef(account.planName);
  const openedComponents = useRef(account.billingComponents.map((component) => ({ ...component })));
  const openedLocalDate = useRef(localBillingToday());
  const defaultCurrency = useRef(account.billingComponents.find((item) => item.currency.trim())?.currency ?? "");
  const [error, setError] = useState("");
  const resetPreparedRequest = () => { requestId.current = null; setError(""); };
  const update = (index: number, patch: Partial<BillingAmount>) => {
    resetPreparedRequest();
    if (patch.currency?.trim()) defaultCurrency.current = patch.currency;
    setDraft((current) => current.map((item, i) => {
      const updated = i === index ? { ...item, ...patch } : item;
      // Either component updates peers sharing its previous currency.
      // Already-different currencies remain independent.
      const synchronized = !item.currency.trim() || item.currency === current[index].currency;
      return patch.currency?.trim() && synchronized ? { ...updated, currency: patch.currency } : updated;
    }));
  };
  let comparisonError = "";
  let comparison: ReturnType<typeof compareCurrentBilling> = null;
  if (preparedUpdate && updateMode) {
    try {
      comparison = compareCurrentBilling({
        editedComponents: draft,
        editedPlanName: planName,
        effectiveDate: updateMode === "correction" ? openedLocalDate.current : effectiveDate,
        isCorrection: updateMode === "correction",
        previousComponents: openedComponents.current,
        previousPlanName: openedPlanName.current,
      });
      if (updateMode === "change" && effectiveDate > openedLocalDate.current) {
        comparisonError = "Future billing changes are not supported.";
      }
    } catch (caught) {
      comparisonError = caught instanceof Error ? caught.message : "Review the Current Billing changes.";
    }
  }
  const activityPreview = comparison
    ? currentBillingComparisonActivityItem(comparison, account.relationshipId)
    : null;
  const previewDetails = activityPreview?.details.map((detail) => detail.replace(/^(Plan|Billing type|Price|Renewal date): /, "")) ?? [];
  const trustedRevision = !preparedUpdate || isTrustedCurrentBillingRevision(openedRevision.current);
  const preparedSaveReady = Boolean(preparedUpdate?.onSubmit && trustedRevision && comparison && !comparisonError);
  const save = async () => {
    if (saving.current || !draft) return;
    saving.current = true; setBusy(true); setError(""); setOpen(null);
    try {
      const savedPlanName = planName.trim();
      if (preparedUpdate) {
        if (!updateMode) throw new Error("Choose why you are updating these details before saving.");
        if (!trustedRevision || !openedRevision.current) throw new Error("Current Billing could not be verified. Reopen the editor before saving.");
        if (!comparison) throw new Error(comparisonError || "Make a change before saving.");
        if (!preparedUpdate.onSubmit) throw new Error("Current Billing update persistence is not enabled yet.");
        if (!requestId.current) {
          const nextRequestId = globalThis.crypto?.randomUUID?.();
          if (!nextRequestId) throw new Error("A stable Current Billing request ID could not be created.");
          requestId.current = nextRequestId;
        }
        await preparedUpdate.onSubmit({
          components: draft,
          effectiveDate: comparison.effectiveDate,
          expectedRevision: openedRevision.current,
          localDate: openedLocalDate.current,
          mode: comparison.mode,
          planName: savedPlanName,
          reason: reason.trim() || null,
          relationshipId: account.relationshipId,
          requestId: requestId.current,
        });
      } else {
        if (!isTrustedCurrentBillingRevision(openedRevision.current)) throw new Error("Current Billing could not be verified. Reopen the editor before saving.");
        if (!requestId.current) {
          const nextRequestId = globalThis.crypto?.randomUUID?.();
          if (!nextRequestId) throw new Error("A stable Current Billing request ID could not be created.");
          requestId.current = nextRequestId;
        }
        await onSaveBilling({
          components: draft,
          effectiveDate: openedLocalDate.current,
          expectedRevision: openedRevision.current,
          localDate: openedLocalDate.current,
          mode: "change",
          planName: savedPlanName,
          reason: null,
          relationshipId: account.relationshipId,
          requestId: requestId.current,
        });
      }
      if (onSaved) onSaved(savedPlanName, draft);
      else onClose();
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save Current Billing."); }
    finally { saving.current = false; setBusy(false); }
  };
  return <form className="modal-form billing-current-editor subscription-billing-editor" onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <fieldset className="billing-current-fields" disabled={busy}>
      {preparedUpdate ? <div className="subscription-current-update-fields">
        <fieldset className="subscription-pause-choice subscription-current-update-mode"><legend>Why are you updating these details?</legend><div className={styles.modeOptions}><label className={`${styles.modeOption}${updateMode === "change" ? ` ${styles.selected}` : ""}`}><input aria-label="My subscription details have changed" checked={updateMode === "change"} name="current-billing-update-mode" onChange={() => { resetPreparedRequest(); setUpdateMode("change"); }} type="radio" value="change" /><span className={styles.modeCopy}><strong>My subscription details have changed</strong><span>An actual change to my subscription, such as plan, price, billing type or renewal date.</span></span></label><label className={`${styles.modeOption}${updateMode === "correction" ? ` ${styles.selected}` : ""}`}><input aria-label="I'm correcting incorrect information" checked={updateMode === "correction"} name="current-billing-update-mode" onChange={() => { resetPreparedRequest(); setUpdateMode("correction"); }} type="radio" value="correction" /><span className={styles.modeCopy}><strong>I&apos;m correcting incorrect information</strong><span>Fix information previously entered incorrectly in AI Subprise.</span></span></label></div></fieldset>
      </div> : null}
      <label className="form-field"><span>Plan Name</span><input aria-label="Current Billing Plan Name" className="field-input" value={planName} placeholder="Not set" onChange={(event) => { resetPreparedRequest(); setPlanName(event.target.value); }} /></label>
      <div className="form-field"><span>Billing Type</span>
        <MultiSelectDropdownControl ariaLabel="Billing Type" id="subscription-billing-types" isOpen={open === "types"} onOpenChange={(id) => setOpen(id ? "types" : null)}
          placeholder="Select billing type" values={draft.map((item) => item.billingType)}
          removableChips
          options={types.map((value) => ({ label: label(value), value, disabled: !draft.some((item) => item.billingType === value) && !validSubscriptionBillingTypes([...draft.map((item) => item.billingType), value]) }))}
          toggleSelection={(values, value) => values.includes(value) ? values.filter((item) => item !== value) : validSubscriptionBillingTypes([...values, value]) ? [...values, value] : values}
          onChange={(values) => {
            resetPreparedRequest();
            if (values.length === 2 && validSubscriptionBillingTypes(values) && values.some((value) => !draft.some((item) => item.billingType === value))) setOpen(null);
            setDraft((current) => values.map((billingType) => {
            const existing = current.find((item) => item.billingType === billingType);
            return existing ?? { id: "", billingType, currency: current.find((item) => item.currency.trim())?.currency ?? defaultCurrency.current, amount: "" };
          })); }}
        />
      </div>
      {draft.map((component, index) => {
        const recurring = component.billingType === "Monthly" || component.billingType === "Yearly";
        const dateKey = recurring ? "nextRenewalDate" : component.billingType === "Top-up" ? "lastTopUpDate" : "purchaseDate";
        const dateLabel = recurring ? "Next renewal" : component.billingType === "Top-up" ? "Last top-up" : "Purchased on";
        const dropdown = (field: "billingType" | "currency", options: DropdownOption[]) => <DropdownControl ariaLabel={field === "currency" ? "Currency" : "Billing Type"} id={`subscription-${index}-${field}`} className="billing-past-dropdown" isOpen={open === `${index}-${field}`} onOpenChange={(id) => setOpen(id ? `${index}-${field}` : null)} onChange={(value) => update(index, { [field]: value })} options={options} placeholder="Not set" value={component[field]} />;
        return <div className="subscription-billing-draft" key={index}>
          <strong>{label(component.billingType)}</strong>
          {component.billingType ? <>
            <div className="tool-detail-field-row"><label className="form-field"><span>Currency</span>{dropdown("currency", currencyOptions)}</label><label className="form-field"><span>Amount</span><input className="field-input" inputMode="decimal" value={component.amount} placeholder="Not set" onChange={(event) => update(index, { amount: event.target.value })} /></label></div>
            <label className="form-field"><span>{dateLabel}</span><DateFieldControl ariaLabel={dateLabel} className="field-input" value={component[dateKey] ?? ""} onChange={(value) => update(index, { [dateKey]: value })} /></label>
          </> : null}
        </div>;
      })}
      {preparedUpdate ? <div className="subscription-current-update-footer">
        {updateMode === "change" ? <label className="form-field"><span>Effective date</span><DateFieldControl ariaLabel="Current Billing effective date" className={comparisonError ? "field-input input-error" : "field-input"} value={effectiveDate} onChange={(value) => { resetPreparedRequest(); setEffectiveDate(value); }} /></label> : updateMode === "correction" ? <p className="subscription-current-update-helper">Corrections use the save date.</p> : null}
        <label className="form-field"><span>Reason <small>(optional)</small></span><textarea aria-label="Current Billing update reason" className="field-input subscription-current-update-reason" onChange={(event) => { resetPreparedRequest(); setReason(event.target.value); }} placeholder={updateMode === "change" ? "Optional context for this subscription change" : updateMode === "correction" ? "Optional note about what was corrected" : "Optional context for this update"} value={reason} /></label>
        <section aria-live="polite" className="subscription-current-activity-preview">
          <span className="subscription-current-activity-preview-label">Account Activity preview</span>
          {activityPreview ? <><strong>{activityPreview.title}</strong><p>{previewDetails.join(" · ")}</p>{updateMode === "correction" && activityPreview.correctionDetails?.length ? <small>Original values will remain available through View correction details in Account Activity.</small> : null}</> : <p>{updateMode ? "No changes detected yet." : "Choose why you are updating these details to see a preview."}</p>}
        </section>
      </div> : null}
    </fieldset>
    {preparedUpdate && !trustedRevision ? <small className="field-feedback error" role="alert">Current Billing could not be verified. Reopen the editor before saving.</small> : null}
    {preparedUpdate && comparisonError ? <small className="field-feedback error" role="alert">{comparisonError}</small> : null}
    {error ? <small className="field-feedback error" role="alert">{error}</small> : null}
    <div className="welcome-modal-actions"><button className="btn-sm" disabled={busy} type="button" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || Boolean(preparedUpdate) && !preparedSaveReady} type="submit">{busy ? "Saving…" : "Save changes"}</button></div>
  </form>;
}
