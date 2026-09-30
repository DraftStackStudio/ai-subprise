"use client";

import { useEffect, useRef, useState } from "react";
import { DropdownControl, type DropdownOption } from "@/components/DropdownControls";
import DateFieldControl from "@/components/DateFieldControl";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import { newestFirstUnresolvedRenewalPeriods } from "@/lib/renewalPeriods";
import type {
  BillingRenewalMutationResult,
  BillingRenewalNotChargedReasonCode,
  BillingRenewalPeriod,
  MarkBillingRenewalNotChargedInput,
  UpdateBillingRenewalPeriodSnapshotInput,
} from "@/types/billingRenewalPeriod";

type Props = {
  canManage: boolean;
  currencyOptions: DropdownOption[];
  onConfirmPaid: (relationshipId: string, periodId: string) => Promise<BillingRenewalMutationResult>;
  onEdit: (relationshipId: string, periodId: string, input: UpdateBillingRenewalPeriodSnapshotInput) => Promise<BillingRenewalPeriod>;
  onNotCharged: (relationshipId: string, periodId: string, input: MarkBillingRenewalNotChargedInput) => Promise<BillingRenewalMutationResult>;
  onUndo: (relationshipId: string, periodId: string) => Promise<BillingRenewalMutationResult>;
  periods: BillingRenewalPeriod[];
  relationshipId: string;
};

type UndoState = { message: string; periodId: string };

const reasonOptions: Array<{ label: string; value: BillingRenewalNotChargedReasonCode }> = [
  { label: "Cancelled subscription", value: "cancelled_subscription" },
  { label: "Payment failed", value: "payment_failed" },
  { label: "Paused / on a break", value: "paused" },
  { label: "Free / waived", value: "free_or_waived" },
  { label: "Other", value: "other" },
];

function displayAmount(currency: string, amount: string) {
  return currency.trim() && amount.trim() ? `${currency.trim()} ${amount.trim()}` : "—";
}

const periodBillingDate = (period: BillingRenewalPeriod) => period.billingDate || period.scheduledRenewalDate;

export default function UnconfirmedBillingSection({ canManage, currencyOptions, onConfirmPaid, onEdit, onNotCharged, onUndo, periods, relationshipId }: Props) {
  const [busyPeriodId, setBusyPeriodId] = useState("");
  const [error, setError] = useState("");
  const [notChargedPeriod, setNotChargedPeriod] = useState<BillingRenewalPeriod | null>(null);
  const [reasonCode, setReasonCode] = useState<BillingRenewalNotChargedReasonCode | "">("");
  const [reasonText, setReasonText] = useState("");
  const [note, setNote] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [editPeriod, setEditPeriod] = useState<BillingRenewalPeriod | null>(null);
  const [editPlanName, setEditPlanName] = useState("");
  const [editCurrency, setEditCurrency] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editBillingDate, setEditBillingDate] = useState("");
  const [dateScopePrompt, setDateScopePrompt] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const undoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unresolved = newestFirstUnresolvedRenewalPeriods(periods.filter((period) => period.relationshipId === relationshipId));

  useEffect(() => () => {
    if (undoTimeout.current) clearTimeout(undoTimeout.current);
  }, []);

  const showUndo = (state: UndoState) => {
    if (undoTimeout.current) clearTimeout(undoTimeout.current);
    setUndoState(state);
    undoTimeout.current = setTimeout(() => {
      setUndoState(null);
      undoTimeout.current = null;
    }, 12000);
  };

  const confirmPaid = async (period: BillingRenewalPeriod) => {
    if (!canManage || period.relationshipId !== relationshipId) return;
    setBusyPeriodId(period.id); setError("");
    try {
      await onConfirmPaid(relationshipId, period.id);
      showUndo({
        message: `Payment confirmed — ${displayAmount(period.currencySnapshot, period.amountSnapshot)} on ${billingHistoryDisplayDate(periodBillingDate(period))}`,
        periodId: period.id,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not confirm this billing period.");
    } finally {
      setBusyPeriodId("");
    }
  };

  const openNotCharged = (period: BillingRenewalPeriod) => {
    if (!canManage || period.relationshipId !== relationshipId) return;
    setNotChargedPeriod(period); setReasonCode(""); setReasonText(""); setNote(""); setReasonOpen(false); setError("");
  };

  const saveNotCharged = async () => {
    if (!notChargedPeriod || !reasonCode || notChargedPeriod.relationshipId !== relationshipId) return;
    if (reasonCode === "other" && !reasonText.trim()) return;
    const period = notChargedPeriod;
    setBusyPeriodId(period.id); setError("");
    try {
      await onNotCharged(relationshipId, period.id, { reasonCode, reasonText, note });
      setNotChargedPeriod(null);
      showUndo({ message: `Marked as not charged — ${billingHistoryDisplayDate(periodBillingDate(period))}`, periodId: period.id });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this billing period.");
    } finally {
      setBusyPeriodId("");
    }
  };

  const openEdit = (period: BillingRenewalPeriod) => {
    if (!canManage || period.relationshipId !== relationshipId) return;
    setEditPeriod(period); setEditPlanName(period.planNameSnapshot); setEditCurrency(period.currencySnapshot); setEditAmount(period.amountSnapshot); setEditBillingDate(periodBillingDate(period)); setCurrencyOpen(false); setDateScopePrompt(false); setError("");
  };

  const saveEdit = async (dateScope: UpdateBillingRenewalPeriodSnapshotInput["dateScope"]) => {
    if (!editPeriod || editPeriod.relationshipId !== relationshipId) return;
    setBusyPeriodId(editPeriod.id); setError("");
    try {
      await onEdit(relationshipId, editPeriod.id, { planName: editPlanName, currency: editCurrency, amount: editAmount, billingDate: editBillingDate, dateScope });
      setEditPeriod(null);
      setDateScopePrompt(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this billing period.");
    } finally {
      setBusyPeriodId("");
    }
  };

  const undo = async () => {
    if (!undoState) return;
    const state = undoState;
    setUndoState(null); setBusyPeriodId(state.periodId); setError("");
    if (undoTimeout.current) { clearTimeout(undoTimeout.current); undoTimeout.current = null; }
    try {
      await onUndo(relationshipId, state.periodId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not undo this billing decision.");
    } finally {
      setBusyPeriodId("");
    }
  };

  const undoToast = undoState ? <div className="app-toast app-toast-success trial-resolution-undo-toast" role="status"><svg aria-hidden="true" className="toast-success-check" fill="none" height="16" viewBox="0 0 24 24" width="16"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg><span className="trial-resolution-undo-message">{undoState.message}</span><span aria-hidden="true" className="trial-resolution-undo-divider" /><button disabled={Boolean(busyPeriodId)} onClick={() => void undo()} type="button"><svg aria-hidden="true" fill="none" viewBox="0 0 24 24"><path d="M8 7H4v-4"/><path d="M4.5 7.5A8 8 0 1 1 5 17"/></svg>Undo</button></div> : null;

  if (!unresolved.length) return undoToast;

  return <section className="subscription-account-section subscription-unconfirmed-section" aria-labelledby="subscription-unconfirmed-billing">
    <div className="subscription-section-heading subscription-unconfirmed-heading">
      <div><h3 id="subscription-unconfirmed-billing">Unconfirmed Billing</h3><p>These billing periods have passed but haven&apos;t been confirmed yet.</p></div>
      <span className="tool-status-chip status-trial">{unresolved.length} to review</span>
    </div>
    <div className="subscription-unconfirmed-database">
      <table className="subscription-payment-table subscription-unconfirmed-table">
        <colgroup><col /><col /><col /><col /></colgroup>
        <thead><tr>{["Date", "Billing Type", "Amount", "Action"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{unresolved.map((period) => <tr key={period.id} data-period-id={period.id}>
          <td>{billingHistoryDisplayDate(periodBillingDate(period))}</td>
          <td>{period.billingTypeSnapshot}</td>
          <td>{displayAmount(period.currencySnapshot, period.amountSnapshot)}</td>
          <td><div className="subscription-unconfirmed-actions">
            <button disabled={!canManage || Boolean(busyPeriodId)} onClick={() => void confirmPaid(period)} type="button">Confirm paid</button>
            <button disabled={!canManage || Boolean(busyPeriodId)} onClick={() => openNotCharged(period)} type="button">Not charged</button>
            <button disabled={!canManage || Boolean(busyPeriodId)} onClick={() => openEdit(period)} type="button">Edit</button>
          </div></td>
        </tr>)}</tbody>
      </table>
    </div>
    {error ? <small className="field-feedback error subscription-unconfirmed-error" role="alert">{error}</small> : null}

    {notChargedPeriod ? <div className="welcome-modal-overlay" role="presentation"><section aria-labelledby="not-charged-title" aria-modal="true" className="welcome-modal subscription-renewal-modal" role="dialog">
      <h2 id="not-charged-title">Mark as not charged</h2>
      <p>{billingHistoryDisplayDate(periodBillingDate(notChargedPeriod))} · {notChargedPeriod.billingTypeSnapshot} · {displayAmount(notChargedPeriod.currencySnapshot, notChargedPeriod.amountSnapshot)}</p>
      <fieldset className="billing-current-fields" disabled={busyPeriodId === notChargedPeriod.id}>
        <label className="form-field"><span>Reason</span><DropdownControl ariaLabel="Not charged reason" id="not-charged-reason" isOpen={reasonOpen} onOpenChange={(id) => setReasonOpen(Boolean(id))} onChange={(value) => { setReasonCode(value as BillingRenewalNotChargedReasonCode); setReasonText(""); setReasonOpen(false); }} options={reasonOptions} placeholder="Select a reason" value={reasonCode} /></label>
        {reasonCode === "other" ? <label className="form-field"><span>Reason</span><input aria-label="Other reason" className="field-input" value={reasonText} onChange={(event) => setReasonText(event.target.value)} placeholder="Enter a reason" /></label> : null}
        <label className="form-field"><span>Note <small>(optional)</small></span><textarea aria-label="Not charged note" className="field-input subscription-renewal-note" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      </fieldset>
      <div className="welcome-modal-actions"><button className="btn-sm" disabled={busyPeriodId === notChargedPeriod.id} onClick={() => setNotChargedPeriod(null)} type="button">Cancel</button><button className="btn-primary" disabled={!reasonCode || (reasonCode === "other" && !reasonText.trim()) || busyPeriodId === notChargedPeriod.id} onClick={() => void saveNotCharged()} type="button">{busyPeriodId === notChargedPeriod.id ? "Saving…" : "Confirm"}</button></div>
    </section></div> : null}

    {editPeriod ? <div className="welcome-modal-overlay" role="presentation"><section aria-labelledby="renewal-edit-title" aria-modal="true" className="welcome-modal subscription-renewal-modal" role="dialog">
      <h2 id="renewal-edit-title">Edit billing period</h2>
      <fieldset className="billing-current-fields" disabled={busyPeriodId === editPeriod.id}>
        <label className="form-field"><span>Plan Name</span><input aria-label="Billing period Plan Name" className="field-input" value={editPlanName} onChange={(event) => setEditPlanName(event.target.value)} /></label>
        <div className="tool-detail-field-row"><label className="form-field"><span>Billing Type</span><input aria-label="Billing period Billing Type" className="field-input" disabled value={editPeriod.billingTypeSnapshot} /></label><label className="form-field"><span>Billing Date</span><DateFieldControl ariaLabel="Billing Date" value={editBillingDate} onChange={setEditBillingDate} /></label></div>
        <div className="tool-detail-field-row"><label className="form-field"><span>Currency</span><DropdownControl ariaLabel="Billing period Currency" id="renewal-period-currency" isOpen={currencyOpen} onOpenChange={(id) => setCurrencyOpen(Boolean(id))} onChange={(value) => { setEditCurrency(value); setCurrencyOpen(false); }} options={currencyOptions} placeholder="Not set" value={editCurrency} /></label><label className="form-field"><span>Amount</span><input aria-label="Billing period Amount" className="field-input" inputMode="decimal" placeholder="Not set" value={editAmount} onChange={(event) => setEditAmount(event.target.value)} /></label></div>
      </fieldset>
      <div className="welcome-modal-actions"><button className="btn-sm" disabled={busyPeriodId === editPeriod.id} onClick={() => setEditPeriod(null)} type="button">Cancel</button><button className="btn-primary" disabled={!editBillingDate || busyPeriodId === editPeriod.id} onClick={() => editBillingDate === periodBillingDate(editPeriod) ? void saveEdit("period_only") : setDateScopePrompt(true)} type="button">{busyPeriodId === editPeriod.id ? "Saving…" : "Save changes"}</button></div>
    </section></div> : null}

    {dateScopePrompt && editPeriod ? <div className="welcome-modal-overlay subscription-renewal-scope-overlay" role="presentation"><section aria-labelledby="billing-date-scope-title" aria-modal="true" className="welcome-modal subscription-renewal-modal" role="dialog">
      <h2 id="billing-date-scope-title">Billing date changed</h2>
      <p>Apply this new billing date to:</p>
      <div className="subscription-renewal-scope-actions">
        <button className="btn-sm" disabled={busyPeriodId === editPeriod.id} onClick={() => void saveEdit("period_only")} type="button"><strong>This billing period only</strong><span>Keep the ongoing recurring schedule unchanged.</span></button>
        <button className="btn-sm" disabled={busyPeriodId === editPeriod.id} onClick={() => void saveEdit("this_and_future")} type="button"><strong>This and future billing periods</strong><span>Use this date as the new recurring schedule anchor.</span></button>
      </div>
      <div className="welcome-modal-actions"><button className="btn-sm" disabled={busyPeriodId === editPeriod.id} onClick={() => setDateScopePrompt(false)} type="button">Back</button></div>
    </section></div> : null}

    {undoToast}
  </section>;
}
