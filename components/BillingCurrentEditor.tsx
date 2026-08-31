"use client";

import { useRef, useState } from "react";
import DateFieldControl from "@/components/DateFieldControl";
import { DropdownControl, type DropdownOption } from "@/components/DropdownControls";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import { estimateCurrentPayment, hasCurrentPayment, localBillingToday, type CurrentPaymentEstimate, type RecurringBillingSettings } from "@/lib/currentBilling";
import type { BillingTransaction } from "@/types/billingTransaction";
import type { BillingAmount } from "@/types/toolDetail";

export type BillingCurrentActions = {
  currencyOptions: DropdownOption[];
  onSaveCurrentBilling: (relationshipId: string, originalType: string | null, settings: RecurringBillingSettings) => Promise<void>;
  onAddCurrentPayment: (relationshipId: string, estimate: CurrentPaymentEstimate) => Promise<void>;
};

export default function BillingCurrentEditor({ component, relationshipId, transactions, currencyOptions, onSaveCurrentBilling, onAddCurrentPayment }: BillingCurrentActions & {
  component?: BillingAmount;
  relationshipId: string;
  transactions: BillingTransaction[];
}) {
  const saved: RecurringBillingSettings = {
    billingType: component?.billingType === "Yearly" ? "Yearly" : "Monthly",
    currency: component?.currency ?? "",
    amount: component?.amount ?? "",
    nextRenewalDate: component?.nextRenewalDate ?? "",
  };
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [confirmation, setConfirmation] = useState<CurrentPaymentEstimate | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const estimate = component ? estimateCurrentPayment(relationshipId, saved) : null;
  const suggestion = estimate && estimate.paymentDate <= localBillingToday() && !hasCurrentPayment(transactions, relationshipId, estimate) ? estimate : null;
  const pending = confirmation && !hasCurrentPayment(transactions, relationshipId, confirmation) ? confirmation : null;

  const save = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setOpenDropdown(null);
    try {
      const settings = { ...draft, amount: draft.amount.trim(), currency: draft.currency.trim().toUpperCase() };
      await onSaveCurrentBilling(relationshipId, component?.billingType ?? null, settings);
      setEditing(false);
      const nextEstimate = estimateCurrentPayment(relationshipId, settings);
      setConfirmation(nextEstimate && !hasCurrentPayment(transactions, relationshipId, nextEstimate) ? nextEstimate : null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save current billing."); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const addPayment = async () => {
    if (!pending || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try { await onAddCurrentPayment(relationshipId, pending); setConfirmation(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not record payment. Your billing settings remain saved."); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const dropdown = (field: "billingType" | "currency", options: DropdownOption[]) => <DropdownControl
    ariaLabel={field === "currency" ? "Currency" : "Billing type"}
    className="billing-past-dropdown"
    id={`current-${relationshipId}-${component?.id ?? "new"}-${field}`}
    isOpen={openDropdown === field}
    onOpenChange={(id) => setOpenDropdown(id ? field : null)}
    onChange={(value) => setDraft((current) => ({ ...current, [field]: value }))}
    options={options}
    placeholder="Select currency"
    value={draft[field]}
  />;

  return <div className="billing-current-editor">
    {editing ? <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy} className="billing-current-fields">
        <div className="tool-detail-field-row">
          <label className="form-field"><span>Billing type</span>{dropdown("billingType", ["Monthly", "Yearly"].map((value) => ({ label: value, value })))}</label>
          <label className="form-field"><span>Currency</span>{dropdown("currency", currencyOptions)}</label>
        </div>
        <div className="tool-detail-field-row">
          <label className="form-field"><span>Amount</span><input className="field-input" inputMode="decimal" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="Not recorded" /></label>
          <label className="form-field"><span>Next renewal</span><DateFieldControl ariaLabel="Next renewal" className="field-input" value={draft.nextRenewalDate} onChange={(nextRenewalDate) => setDraft({ ...draft, nextRenewalDate })} /></label>
        </div>
      </fieldset>
      <div className="welcome-modal-actions"><button className="btn-sm" disabled={busy} onClick={() => { setEditing(false); setError(""); }} type="button">Cancel</button><button className="billing-details-primary-action" disabled={busy} type="submit">{busy ? "Saving…" : "Save current billing"}</button></div>
    </form> : <button className="inline-text-link" disabled={busy || Boolean(pending)} onClick={() => { setDraft(saved); setEditing(true); setError(""); }} type="button">{component ? `Edit ${component.billingType} billing` : "Set up recurring billing"}</button>}

    {pending ? <section className="billing-details-empty billing-current-payment" aria-label="Add current payment?">
      <strong>Add current payment?</strong>
      <span>Estimated {billingHistoryDisplayDate(pending.paymentDate)} · {pending.currency} {pending.amount}</span>
      <span>This is an estimate. Add it only if this payment occurred.</span>
      {pending.paymentDate > localBillingToday() ? <span>The estimated payment date is still in the future; it cannot be recorded as a past payment yet.</span> : null}
      <div className="welcome-modal-actions"><button className="btn-sm" disabled={busy} onClick={() => { setConfirmation(null); setError(""); }} type="button">Not now</button><button className="billing-details-primary-action" disabled={busy || pending.paymentDate > localBillingToday()} onClick={() => void addPayment()} type="button">{busy ? "Adding…" : "Add payment"}</button></div>
    </section> : !editing && suggestion ? <div className="billing-details-empty billing-current-payment">
      <strong>Current payment not recorded</strong><span>Estimated {billingHistoryDisplayDate(suggestion.paymentDate)} · {suggestion.currency} {suggestion.amount}</span>
      <button className="inline-text-link" onClick={() => { setConfirmation(suggestion); setError(""); }} type="button">Add payment</button>
    </div> : null}
    {error ? <small className="field-feedback error" role="alert">{error}</small> : null}
  </div>;
}
