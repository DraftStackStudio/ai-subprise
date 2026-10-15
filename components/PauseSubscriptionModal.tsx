"use client";

import { useRef, useState } from "react";
import DateFieldControl from "@/components/DateFieldControl";
import { DropdownControl } from "@/components/DropdownControls";
import { localBillingToday } from "@/lib/currentBilling";
import {
  validatePauseSubscriptionDraft,
  type LifecycleDatePrecision,
  type PauseSubscriptionDraft,
  type PauseSubscriptionInput,
} from "@/lib/subscriptionPause";

const precisionOptions = [
  { label: "Exact date", value: "exact_date" },
  { label: "Month only", value: "month_only" },
];

function DateEntry({
  ariaLabel,
  disabled = false,
  entryId,
  error,
  onCloseControl,
  onChange,
  onOpenControl,
  onPrecisionChange,
  openControlId,
  precision,
  value,
}: {
  ariaLabel: string;
  disabled?: boolean;
  entryId: string;
  error?: string;
  onCloseControl: (id: string) => void;
  onChange: (value: string) => void;
  onOpenControl: (id: string | null) => void;
  onPrecisionChange: (precision: LifecycleDatePrecision) => void;
  openControlId: string | null;
  precision: LifecycleDatePrecision;
  value: string;
}) {
  const precisionId = `${entryId}-precision`;
  const pickerId = `${entryId}-picker`;
  return <div className="pause-date-entry" onKeyDown={(event) => {
    if (event.key === "Escape") onOpenControl(null);
  }}>
    <DropdownControl ariaLabel={`${ariaLabel} precision`} className="pause-date-precision" id={precisionId} isOpen={openControlId === precisionId} onOpenChange={(id) => onOpenControl(id ? precisionId : null)} onChange={(next) => { onOpenControl(null); onPrecisionChange(next as LifecycleDatePrecision); }} options={precisionOptions} value={precision} />
    <DateFieldControl ariaLabel={ariaLabel} className={error ? "field-input input-error" : "field-input"} disabled={disabled} onChange={onChange} onClose={() => onCloseControl(pickerId)} onOpen={() => onOpenControl(pickerId)} picker={precision === "month_only" ? "month" : "date"} value={value} />
    {error ? <small className="field-feedback error" role="alert">{error}</small> : null}
  </div>;
}

export default function PauseSubscriptionModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (requestId: string, input: PauseSubscriptionInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PauseSubscriptionDraft>({
    effectiveDate: "",
    effectiveDatePrecision: "exact_date",
    plannedResumeDate: "",
    plannedResumePrecision: "exact_date",
    planningToResume: false,
    reason: "",
  });
  const [errors, setErrors] = useState<ReturnType<typeof validatePauseSubscriptionDraft>["errors"]>({});
  const [openControlId, setOpenControlId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const requestId = useRef(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
  const patch = (next: Partial<PauseSubscriptionDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setErrors({});
    setSubmitError("");
  };
  const closeControl = (id: string) => setOpenControlId((current) => current === id ? null : current);
  const confirm = async () => {
    if (submitting.current) return;
    const validation = validatePauseSubscriptionDraft(draft, localBillingToday());
    setErrors(validation.errors);
    if (!validation.input) return;
    submitting.current = true;
    setBusy(true);
    setSubmitError("");
    try {
      await onConfirm(requestId.current, validation.input);
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : "Could not pause this subscription. Try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return <div className="welcome-modal-overlay subscription-pause-overlay" role="presentation">
    <section
      className="welcome-modal subscription-pause-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-subscription-title"
      onMouseDown={(event) => {
        const target = event.target as Element;
        if (!target.closest(".pause-date-entry .custom-select") && !target.closest(".pause-date-entry .modal-date-display-control")) {
          setOpenControlId(null);
        }
      }}
    >
      <button aria-label="Close Pause Subscription" className="modal-close-button" disabled={busy} onClick={onCancel} type="button">×</button>
      <h2 id="pause-subscription-title">Pause Subscription</h2>
      <div className="modal-form subscription-pause-form">
        <div className="form-field"><span>Effective pause date</span><DateEntry ariaLabel="Effective pause date" disabled={busy} entryId="effective-pause-date" error={errors.effectiveDate} onChange={(effectiveDate) => patch({ effectiveDate })} onCloseControl={closeControl} onOpenControl={setOpenControlId} onPrecisionChange={(effectiveDatePrecision) => patch({ effectiveDate: "", effectiveDatePrecision })} openControlId={openControlId} precision={draft.effectiveDatePrecision} value={draft.effectiveDate} /></div>
        <label className="form-field"><span>Reason for pausing <small>(optional)</small></span><textarea aria-label="Reason for pausing" className="field-input subscription-pause-reason" disabled={busy} onChange={(event) => patch({ reason: event.target.value })} placeholder="e.g. Not using this service regularly" value={draft.reason} /></label>
        <fieldset className="subscription-pause-choice" disabled={busy}>
          <legend>Planning to resume?</legend>
          <div className="subscription-pause-choice-buttons">
            <button aria-pressed={draft.planningToResume} className={draft.planningToResume ? "category-view-tab active" : "category-view-tab"} onClick={() => { setOpenControlId(null); patch({ planningToResume: true }); }} type="button">Yes</button>
            <button aria-pressed={!draft.planningToResume} className={!draft.planningToResume ? "category-view-tab active" : "category-view-tab"} onClick={() => { setOpenControlId(null); patch({ plannedResumeDate: "", planningToResume: false }); }} type="button">No</button>
          </div>
        </fieldset>
        {draft.planningToResume ? <div className="form-field"><span>Planned resume date</span><DateEntry ariaLabel="Planned resume date" disabled={busy} entryId="planned-resume-date" error={errors.plannedResumeDate} onChange={(plannedResumeDate) => patch({ plannedResumeDate })} onCloseControl={closeControl} onOpenControl={setOpenControlId} onPrecisionChange={(plannedResumePrecision) => patch({ plannedResumeDate: "", plannedResumePrecision })} openControlId={openControlId} precision={draft.plannedResumePrecision} value={draft.plannedResumeDate} /></div> : null}
        <div className="subscription-pause-info"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg><p>Pausing here won&apos;t stop charges from the AI provider. Manage your subscription directly with them.</p></div>
        {submitError ? <small className="field-feedback error subscription-pause-error" role="alert">{submitError}</small> : null}
      </div>
      <div className="welcome-modal-actions subscription-pause-actions"><button className="btn-sm btn-sm-ghost" disabled={busy} onClick={onCancel} type="button">Cancel</button><button className="btn-sm btn-sm-primary" disabled={busy} onClick={() => void confirm()} type="button">{busy ? "Pausing…" : "Confirm Pause"}</button></div>
    </section>
  </div>;
}
