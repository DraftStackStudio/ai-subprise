"use client";

import { useRef, useState } from "react";
import DateFieldControl from "@/components/DateFieldControl";
import { DropdownControl, type DropdownOption } from "@/components/DropdownControls";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import { localBillingToday } from "@/lib/currentBilling";
import {
  changeResumeBillingFrequency,
  suggestedResumeNextRenewalDate,
  validateResumePayment,
  validateResumeSubscriptionDraft,
  type ResumeBillingType,
  type ResumeChargeAnswer,
  type ResumePaymentInput,
  type ResumeSubscriptionDraft,
  type ResumeSubscriptionInput,
} from "@/lib/subscriptionResume";
import type { ResumeSubscriptionResult } from "@/types/subscriptionLifecycleEvent";

export default function ResumeSubscriptionModal({
  currencyOptions,
  onCancel,
  onComplete,
  onRecordPayment,
  onResume,
  pauseEventId,
  planName,
  previousAmount,
  previousBillingType,
  previousCurrency,
}: {
  currencyOptions: DropdownOption[];
  onCancel: () => void;
  onComplete: () => void;
  onRecordPayment: (lifecycleEventId: string, input: ResumePaymentInput) => Promise<void>;
  onResume: (requestId: string, pauseEventId: string, input: ResumeSubscriptionInput) => Promise<ResumeSubscriptionResult>;
  pauseEventId: string;
  planName: string;
  previousAmount: string;
  previousBillingType: ResumeBillingType;
  previousCurrency: string;
}) {
  const today = localBillingToday();
  const [draft, setDraft] = useState<ResumeSubscriptionDraft>(() => ({
    amount: previousAmount,
    billingType: previousBillingType,
    chargeAnswer: "unknown",
    currency: previousCurrency,
    nextRenewalConfirmed: false,
    nextRenewalDate: suggestedResumeNextRenewalDate(today, previousBillingType),
    nextRenewalMode: "suggested",
  }));
  const [errors, setErrors] = useState<ReturnType<typeof validateResumeSubscriptionDraft>["errors"]>({});
  const [paymentErrors, setPaymentErrors] = useState<ReturnType<typeof validateResumePayment>["errors"]>({});
  const [resumeResult, setResumeResult] = useState<ResumeSubscriptionResult | null>(null);
  const [payment, setPayment] = useState<ResumePaymentInput | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openControl, setOpenControl] = useState<string | null>(null);
  const submitting = useRef(false);
  const requestId = useRef(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
  const patch = (next: Partial<ResumeSubscriptionDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setErrors({});
    setSubmitError("");
  };
  const confirmResume = async () => {
    if (submitting.current) return;
    const validation = validateResumeSubscriptionDraft(draft, today);
    setErrors(validation.errors);
    if (!validation.input) return;
    submitting.current = true; setBusy(true); setSubmitError(""); setOpenControl(null);
    try {
      const result = await onResume(requestId.current, pauseEventId, validation.input);
      setResumeResult(result);
      if (draft.chargeAnswer === "yes") {
        setPayment({
          amount: validation.input.amount,
          billingType: validation.input.billingType,
          currency: validation.input.currency,
          paymentDate: today,
          planName,
        });
      } else {
        onComplete();
      }
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : "Could not resume this subscription. Try again.");
    } finally {
      submitting.current = false; setBusy(false);
    }
  };
  const confirmPayment = async () => {
    if (!resumeResult || !payment || submitting.current) return;
    const validation = validateResumePayment(payment, today);
    setPaymentErrors(validation.errors);
    if (!validation.input) return;
    submitting.current = true; setBusy(true); setSubmitError(""); setOpenControl(null);
    try {
      await onRecordPayment(resumeResult.lifecycleEventId, validation.input);
      onComplete();
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : "The subscription was resumed, but the payment was not recorded. Try the payment again.");
    } finally {
      submitting.current = false; setBusy(false);
    }
  };

  if (resumeResult && payment) return <div className="welcome-modal-overlay subscription-pause-overlay" role="presentation">
    <section className="welcome-modal subscription-pause-modal subscription-resume-modal" role="dialog" aria-modal="true" aria-labelledby="resume-payment-title">
      <button aria-label="Close Resume Payment" className="modal-close-button" disabled={busy} onClick={onComplete} type="button">×</button>
      <h2 id="resume-payment-title">Confirm Resume Payment</h2>
      <div className="subscription-resume-success" role="status"><strong>Subscription resumed.</strong><span>The payment has not been recorded yet.</span></div>
      <div className="modal-form subscription-pause-form">
        <div className="tool-detail-field-row"><label className="form-field"><span>Payment date</span><DateFieldControl ariaLabel="Resume payment date" className={paymentErrors.paymentDate ? "field-input input-error" : "field-input"} disabled={busy} onChange={(paymentDate) => { setPayment((current) => current ? { ...current, paymentDate } : current); setPaymentErrors({}); }} value={payment.paymentDate} />{paymentErrors.paymentDate ? <small className="field-feedback error" role="alert">{paymentErrors.paymentDate}</small> : null}</label>
          <div className="form-field"><span>Currency</span><DropdownControl ariaLabel="Resume payment currency" id="resume-payment-currency" isOpen={openControl === "resume-payment-currency"} onOpenChange={setOpenControl} onChange={(currency) => { setPayment((current) => current ? { ...current, currency } : current); setPaymentErrors({}); }} options={currencyOptions} value={payment.currency} />{paymentErrors.currency ? <small className="field-feedback error" role="alert">{paymentErrors.currency}</small> : null}</div></div>
        <label className="form-field"><span>Payment amount <small>(blank means unknown)</small></span><input aria-label="Resume payment amount" className={paymentErrors.amount ? "field-input input-error" : "field-input"} disabled={busy} inputMode="decimal" onChange={(event) => { setPayment((current) => current ? { ...current, amount: event.target.value } : current); setPaymentErrors({}); }} placeholder="Unknown" value={payment.amount} />{paymentErrors.amount ? <small className="field-feedback error" role="alert">{paymentErrors.amount}</small> : null}</label>
        <div className="subscription-pause-info"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg><p>Only confirm this payment if the AI provider charged you when you resumed. This is a separate record from Resume.</p></div>
        {submitError ? <small className="field-feedback error subscription-pause-error" role="alert">{submitError}</small> : null}
      </div>
      <div className="welcome-modal-actions subscription-pause-actions"><button className="btn-sm btn-sm-ghost" disabled={busy} onClick={onComplete} type="button">Not now</button><button className="btn-sm btn-sm-primary" disabled={busy} onClick={() => void confirmPayment()} type="button">{busy ? "Recording…" : "Record Payment"}</button></div>
    </section>
  </div>;

  return <div className="welcome-modal-overlay subscription-pause-overlay" role="presentation">
    <section className="welcome-modal subscription-pause-modal subscription-resume-modal" role="dialog" aria-modal="true" aria-labelledby="resume-subscription-title" onMouseDown={(event) => { if (!(event.target as Element).closest(".custom-select")) setOpenControl(null); }}>
      <button aria-label="Close Resume Subscription" className="modal-close-button" disabled={busy} onClick={onCancel} type="button">×</button>
      <h2 id="resume-subscription-title">Resume Subscription</h2>
      <div className="modal-form subscription-pause-form">
        <div className="subscription-resume-provider-check"><strong>First, resume with the AI provider.</strong><span>AI Subprise records what already happened; it cannot resume the provider subscription for you.</span></div>
        <div className="tool-detail-field-row"><label className="form-field"><span>Resume date</span><input aria-label="Resume date" className="field-input" disabled value={billingHistoryDisplayDate(today)} /></label><label className="form-field"><span>Plan</span><input aria-label="Resume plan" className="field-input" disabled value={planName || "Not set"} /></label></div>
        <div className="tool-detail-field-row"><div className="form-field"><span>Billing frequency</span><DropdownControl ariaLabel="Resume billing frequency" id="resume-billing-frequency" isOpen={openControl === "resume-billing-frequency"} onOpenChange={setOpenControl} onChange={(value) => { setDraft((current) => changeResumeBillingFrequency(current, value as ResumeBillingType, today)); setErrors({}); }} options={[{ label: "Monthly", value: "Monthly" }, { label: "Yearly", value: "Yearly" }]} value={draft.billingType} />{errors.billingType ? <small className="field-feedback error" role="alert">{errors.billingType}</small> : null}</div>
          <div className="form-field"><span>Currency</span><DropdownControl ariaLabel="Resume currency" id="resume-currency" isOpen={openControl === "resume-currency"} onOpenChange={setOpenControl} onChange={(currency) => patch({ currency })} options={currencyOptions} value={draft.currency} />{errors.currency ? <small className="field-feedback error" role="alert">{errors.currency}</small> : null}</div></div>
        <label className="form-field"><span>Amount <small>(blank means unknown)</small></span><input aria-label="Resume amount" className={errors.amount ? "field-input input-error" : "field-input"} disabled={busy} inputMode="decimal" onChange={(event) => patch({ amount: event.target.value })} placeholder="Unknown" value={draft.amount} />{errors.amount ? <small className="field-feedback error" role="alert">{errors.amount}</small> : null}</label>
        <fieldset className="subscription-pause-choice" disabled={busy}><legend>Next renewal date</legend><div className="subscription-pause-choice-buttons"><button aria-pressed={draft.nextRenewalMode !== "unknown"} className={draft.nextRenewalMode !== "unknown" ? "category-view-tab active" : "category-view-tab"} onClick={() => patch({ nextRenewalConfirmed: false, nextRenewalDate: suggestedResumeNextRenewalDate(today, draft.billingType as ResumeBillingType), nextRenewalMode: "suggested" })} type="button">Known</button><button aria-pressed={draft.nextRenewalMode === "unknown"} className={draft.nextRenewalMode === "unknown" ? "category-view-tab active" : "category-view-tab"} onClick={() => patch({ nextRenewalConfirmed: true, nextRenewalDate: "", nextRenewalMode: "unknown" })} type="button">Unknown</button></div></fieldset>
        {draft.nextRenewalMode === "unknown" ? <div className="subscription-resume-review-warning"><strong>Next renewal needs review.</strong><span>No renewal periods will be detected until you add the confirmed date.</span></div> : <div className="form-field"><span>Next renewal date</span><DateFieldControl ariaLabel="Resume next renewal date" className={errors.nextRenewalDate ? "field-input input-error" : "field-input"} disabled={busy} onChange={(nextRenewalDate) => patch({ nextRenewalConfirmed: true, nextRenewalDate, nextRenewalMode: "manual" })} value={draft.nextRenewalDate} />{draft.nextRenewalMode === "suggested" ? <label className="subscription-resume-confirm-suggestion"><input checked={draft.nextRenewalConfirmed} disabled={busy} onChange={(event) => patch({ nextRenewalConfirmed: event.target.checked })} type="checkbox" /><span>Confirm renewal date</span></label> : <small className="field-feedback">Manually entered date</small>}{errors.nextRenewalDate ? <small className="field-feedback error" role="alert">{errors.nextRenewalDate}</small> : null}</div>}
        <fieldset className="subscription-pause-choice" disabled={busy}><legend>Did the provider charge you when you resumed?</legend><div className="subscription-pause-choice-buttons">{([['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not sure']] as Array<[ResumeChargeAnswer, string]>).map(([value, label]) => <button aria-pressed={draft.chargeAnswer === value} className={draft.chargeAnswer === value ? "category-view-tab active" : "category-view-tab"} key={value} onClick={() => patch({ chargeAnswer: value })} type="button">{label}</button>)}</div></fieldset>
        <div className="subscription-pause-info"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg><p>Resume never creates a payment automatically. If you choose Yes, you will review and confirm a separate payment after Resume succeeds.</p></div>
        {submitError ? <small className="field-feedback error subscription-pause-error" role="alert">{submitError}</small> : null}
      </div>
      <div className="welcome-modal-actions subscription-pause-actions"><button className="btn-sm btn-sm-ghost" disabled={busy} onClick={onCancel} type="button">Cancel</button><button className="btn-sm btn-sm-primary" disabled={busy} onClick={() => void confirmResume()} type="button">{busy ? "Resuming…" : "Confirm Resume"}</button></div>
    </section>
  </div>;
}
