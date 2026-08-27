"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createBillingTransaction, deleteManualBillingTransaction, getBillingTransactionsByRelationship, updateBillingTransaction } from "@/lib/supabase/billingTransactions";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import { DropdownControl, type DropdownOption } from "@/components/DropdownControls";
import DateFieldControl from "@/components/DateFieldControl";
import type { BillingHistoryEntry } from "@/types/billingHistory";
import type { BillingAmount } from "@/types/toolDetail";
import type { BillingTransaction, BillingTransactionStatus, BillingTransactionType } from "@/types/billingTransaction";

export type BillingHistoryAccount = {
  accountActivity: BillingHistoryEntry[];
  accountEmail: string;
  accountLabel: string;
  accountTag: string;
  billingAmounts: BillingAmount[];
  planName: string;
  relationshipId: string;
};

type EntryMode = "" | "single" | "period";
type TransactionDraft = {
  amount: string; billingType: BillingTransactionType | ""; currency: string; endDate: string;
  note: string; paymentDate: string; planName: string; startDate: string; status: BillingTransactionStatus;
};
type PeriodDraftRow = TransactionDraft & {
  id: string;
  origin: "generated" | "one-off";
  sourceKey: string;
};
type PanelProps = {
  accounts: BillingHistoryAccount[];
  initialRelationshipId: string;
  onClose: () => void;
  restoredDate?: string;
  toolName: string;
};
type AccountSectionProps = BillingHistoryAccount & {
  isExpanded: boolean;
  onToggle: () => void;
  restoredDate?: string;
};

function SummaryIcon({ name }: { name: "amount" | "billing" | "date" }) {
  return <svg aria-hidden="true" className="billing-history-summary-icon" fill="none" viewBox="0 0 20 20">
    {name === "billing" ? <><rect height="12" rx="2" stroke="currentColor" width="14" x="3" y="4"/><path d="M7 4v12M13 4v12M3 8h14M3 12h14" stroke="currentColor"/></> : null}
    {name === "amount" ? <><path d="M4 6.5h11.5a1.5 1.5 0 0 1 1.5 1.5v7H5.5A2.5 2.5 0 0 1 3 12.5v-8A1.5 1.5 0 0 1 4.5 3H15" stroke="currentColor"/><circle cx="13.5" cy="11" fill="currentColor" r="1"/></> : null}
    {name === "date" ? <><rect height="13" rx="2" stroke="currentColor" width="14" x="3" y="4"/><path d="M6 2v4M14 2v4M3 8h14" stroke="currentColor"/><circle cx="10" cy="12" fill="currentColor" r="1.5"/></> : null}
  </svg>;
}

const initialDraft = (): TransactionDraft => ({ amount: "", billingType: "", currency: "", endDate: "", note: "", paymentDate: "", planName: "", startDate: "", status: "Paid" });
const localDraftId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function addMonthsSafely(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function periodDates(start: string, end: string, type: BillingTransactionType | "") {
  if (!start || !end || start > end || (type !== "Monthly" && type !== "Yearly")) return [];
  const dates: string[] = [];
  for (let index = 0; index < 1200; index += 1) {
    const date = addMonthsSafely(start, index * (type === "Yearly" ? 12 : 1));
    if (date > end) break;
    dates.push(date);
  }
  return dates;
}

function displayAmount(transaction: BillingTransaction) {
  if (!transaction.amount) return "Not recorded";
  return transaction.currency ? `${transaction.currency} ${transaction.amount}` : transaction.amount;
}

function componentDate(component: BillingAmount) {
  if (component.billingType === "Monthly" || component.billingType === "Yearly") {
    return component.nextRenewalDate ? `Next renewal · ${billingHistoryDisplayDate(component.nextRenewalDate)}` : "";
  }
  if (component.billingType === "Top-up") {
    return component.lastTopUpDate ? `Last top-up · ${billingHistoryDisplayDate(component.lastTopUpDate)}` : "";
  }
  return component.purchaseDate ? `Purchased on · ${billingHistoryDisplayDate(component.purchaseDate)}` : "";
}

function componentDateLabel(component: BillingAmount) {
  if (component.billingType === "Monthly" || component.billingType === "Yearly") return "Next renewal";
  if (component.billingType === "Top-up") return "Last top-up";
  if (component.billingType === "Lifetime" || component.billingType === "One-time") return "Purchased on";
  return "Relevant date";
}

function compactSummary(billingAmounts: BillingAmount[]) {
  return billingAmounts.map((component) => {
    const amount = [component.currency, component.amount].filter(Boolean).join(" ");
    const date = componentDate(component);
    return [component.billingType, amount, date].filter(Boolean).join(" · ");
  }).join("  +  ");
}

function AccountSection({ accountActivity, accountEmail, accountLabel, accountTag, billingAmounts, isExpanded, onToggle, planName, relationshipId, restoredDate }: AccountSectionProps) {
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [detailTransactionId, setDetailTransactionId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode>("");
  const [showPastBillingModal, setShowPastBillingModal] = useState(false);
  const [draft, setDraft] = useState<TransactionDraft>(initialDraft);
  const [editingId, setEditingId] = useState("");
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [periodDraftRows, setPeriodDraftRows] = useState<PeriodDraftRow[]>([]);
  const [periodGenerationKey, setPeriodGenerationKey] = useState("");
  const [periodEditId, setPeriodEditId] = useState("");
  const [periodEditDraft, setPeriodEditDraft] = useState<TransactionDraft>(initialDraft);
  const [periodDraftDeleteId, setPeriodDraftDeleteId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const reload = async () => setTransactions(await getBillingTransactionsByRelationship(relationshipId));
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getBillingTransactionsByRelationship(relationshipId)
      .then((rows) => { if (!cancelled) setTransactions(rows); })
      .catch((caught: unknown) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load billing history."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [relationshipId]);

  const previewDates = useMemo(() => periodDates(draft.startDate, draft.endDate, draft.billingType), [draft.billingType, draft.endDate, draft.startDate]);
  useEffect(() => {
    if (entryMode !== "period") return;
    const generationKey = `${draft.startDate}|${draft.endDate}|${draft.billingType}`;
    if (generationKey === periodGenerationKey) return;
    setPeriodGenerationKey(generationKey);
    setPeriodDraftRows((current) => [
      ...previewDates.map((paymentDate): PeriodDraftRow => ({
        ...initialDraft(),
        amount: draft.amount,
        billingType: draft.billingType,
        currency: draft.currency,
        id: `generated-${draft.billingType}-${paymentDate}`,
        note: draft.note,
        origin: "generated",
        paymentDate,
        planName: draft.planName,
        sourceKey: `subscription-period:${relationshipId}:${draft.billingType}:${paymentDate}`,
        status: "Paid",
      })),
      ...current.filter((row) => row.origin === "one-off"),
    ]);
  }, [draft.amount, draft.billingType, draft.currency, draft.endDate, draft.note, draft.planName, draft.startDate, entryMode, periodGenerationKey, previewDates, relationshipId]);
  const previewTotals = useMemo(() => periodDraftRows.reduce<Record<string, number>>((totals, row) => {
    const amount = Number(row.amount);
    if (!row.amount || !Number.isFinite(amount)) return totals;
    const currency = row.currency || "Amount";
    totals[currency] = (totals[currency] ?? 0) + amount;
    return totals;
  }, {}), [periodDraftRows]);
  const previewTotal = Object.entries(previewTotals).map(([currency, total]) => `${currency === "Amount" ? "" : `${currency} `}${total.toFixed(2).replace(/\.00$/, "")}`).join(" + ");
  const activity = restoredDate
    ? [{ date: restoredDate, event: "Restored", id: `restored-${relationshipId}`, note: "Restored by you" }, ...accountActivity]
    : accountActivity;
  const visibleTransactions = showAllPayments ? transactions : transactions.slice(0, 5);
  const hiddenPaymentCount = Math.max(0, transactions.length - visibleTransactions.length);

  const closeForm = () => { setShowPastBillingModal(false); setShowDeleteConfirmation(false); setEntryMode(""); setEditingId(""); setDraft(initialDraft()); setPeriodDraftRows([]); setPeriodGenerationKey(""); setPeriodEditId(""); setPeriodEditDraft(initialDraft()); setPeriodDraftDeleteId(""); setError(""); setOpenDropdownId(null); };
  const openForm = () => { closeForm(); setShowPastBillingModal(true); };
  const field = (key: keyof TransactionDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const periodField = (key: keyof TransactionDraft, value: string) => {
    field(key, value);
    if (key === "amount" || key === "currency" || key === "note" || key === "planName") {
      setPeriodDraftRows((current) => current.map((row) => row.origin === "generated" ? { ...row, [key]: value } : row));
    }
  };
  const updatePeriodDraft = (id: string, patch: Partial<TransactionDraft>) => setPeriodDraftRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  const renderPastDropdown = (id: string, value: string, placeholder: string, options: DropdownOption[], onChange: (value: string) => void) => <DropdownControl ariaLabel={placeholder} className="billing-past-dropdown" id={`${id}-${relationshipId}`} isOpen={openDropdownId === `${id}-${relationshipId}`} onChange={onChange} onOpenChange={setOpenDropdownId} options={options} placeholder={placeholder} value={value}/>;
  const currencyOptions = ["AUD", "EUR", "GBP", "SGD", "USD"].map((value) => ({ label: value, value }));
  const statusOptions = ["Paid", "Pending", "Failed", "Refunded"].map((value) => ({ label: value, value }));
  const singleBillingTypeOptions = [{ label: "Not recorded", value: "" }, ...["Monthly", "Yearly", "Lifetime", "One-time", "Top-up"].map((value) => ({ label: value === "One-time" ? "One-time payment" : value === "Top-up" ? "Top-up credit" : value, value }))];
  const draftBillingTypeOptions = singleBillingTypeOptions.slice(1);
  const recurringBillingTypeOptions = ["Monthly", "Yearly"].map((value) => ({ label: value, value }));

  const saveSingle = async () => {
    if (!draft.paymentDate) return setError("Payment date is required.");
    setIsSaving(true); setError("");
    try {
      const input = { amount: draft.amount, billingTypeSnapshot: draft.billingType, currency: draft.currency, note: draft.note, paymentDate: draft.paymentDate, planNameSnapshot: draft.planName, status: draft.status };
      if (editingId) await updateBillingTransaction(editingId, input);
      else await createBillingTransaction({ ...input, relationshipId });
      await reload(); closeForm();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not save billing transaction."); }
    finally { setIsSaving(false); }
  };

  const savePeriod = async () => {
    if (!periodDraftRows.length) return setError("Generate at least one billing record before confirming.");
    setIsSaving(true); setError("");
    try {
      await Promise.all(periodDraftRows.map((row) => createBillingTransaction({ amount: row.amount, billingTypeSnapshot: row.billingType, currency: row.currency, note: row.note, paymentDate: row.paymentDate, planNameSnapshot: row.planName, relationshipId, sourceKey: row.sourceKey, status: row.status })));
      await reload(); closeForm();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not save subscription period."); }
    finally { setIsSaving(false); }
  };

  const beginEdit = (transaction: BillingTransaction) => {
    setEntryMode("single"); setEditingId(transaction.id); setShowPastBillingModal(true);
    setDraft({ amount: transaction.amount, billingType: transaction.billingTypeSnapshot, currency: transaction.currency, endDate: "", note: transaction.note, paymentDate: transaction.paymentDate, planName: transaction.planNameSnapshot, startDate: "", status: transaction.status });
  };
  const beginPeriodDraftEdit = (row: PeriodDraftRow) => {
    setPeriodEditId(row.id);
    setPeriodEditDraft({ ...row, endDate: "", startDate: "" });
    setError(""); setOpenDropdownId(null);
  };
  const beginOneOffDraft = () => {
    setPeriodEditId("new-one-off");
    setPeriodEditDraft({ ...initialDraft(), amount: draft.amount, currency: draft.currency, note: draft.note, planName: draft.planName });
    setError(""); setOpenDropdownId(null);
  };
  const closePeriodDraftEdit = () => { setPeriodEditId(""); setPeriodEditDraft(initialDraft()); setPeriodDraftDeleteId(""); setError(""); setOpenDropdownId(null); };
  const savePeriodDraftEdit = () => {
    if (!periodEditDraft.paymentDate) return setError("Payment date is required.");
    if (periodEditId === "new-one-off") {
      const id = localDraftId();
      setPeriodDraftRows((current) => [...current, { ...periodEditDraft, id, origin: "one-off", sourceKey: `subscription-period:${relationshipId}:one-off:${id}` }]);
    } else {
      updatePeriodDraft(periodEditId, periodEditDraft);
    }
    closePeriodDraftEdit();
  };
  const removePeriodDraft = () => {
    setPeriodDraftRows((current) => current.filter((row) => row.id !== periodDraftDeleteId));
    closePeriodDraftEdit();
  };
  const removeEditedTransaction = async () => {
    const transaction = transactions.find((entry) => entry.id === editingId);
    if (!transaction || transaction.source !== "manual") return;
    setIsSaving(true); setError("");
    try {
      const deleted = await deleteManualBillingTransaction(transaction.id);
      if (!deleted) throw new Error("Only manually created billing records can be deleted.");
      await reload(); closeForm();
    } catch (caught: unknown) {
      setShowDeleteConfirmation(false);
      setError(caught instanceof Error ? caught.message : "Could not delete billing transaction.");
    } finally { setIsSaving(false); }
  };

  return <section className={isExpanded ? "billing-history-account-card is-expanded" : "billing-history-account-card"}>
    <button aria-expanded={isExpanded} className="billing-history-account-toggle" onClick={onToggle} type="button">
      <span className={isExpanded ? "row-toggle-control linked-row-toggle is-open" : "row-toggle-control linked-row-toggle"}><span /></span>
      <span className="billing-history-account-identity"><span className="billing-history-account-title-line"><span className={`billing-history-account-dot ${accountTag}`} aria-hidden="true" /><strong><span className={`billing-history-account-nickname ${accountTag}`}>{accountLabel}</span>{planName ? <><span className="billing-history-account-separator"> · </span><span className="billing-history-account-plan">{planName}</span></> : null}</strong></span>{accountEmail ? <small>{accountEmail}</small> : null}</span>
      {!isExpanded ? <span className="billing-history-collapsed-summary">{compactSummary(billingAmounts)}</span> : null}
    </button>
    {isExpanded ? <div className="billing-history-account-body">
      {billingAmounts.length ? <div className="billing-history-components">{billingAmounts.map((component) => {
        const dateText = componentDate(component);
        const [dateLabel, dateValue] = dateText.split(" · ");
        return <div className="billing-history-component" key={component.id}>
          <div className="billing-history-summary-cell"><SummaryIcon name="billing"/><span><small>Billing type</small><strong>{component.billingType === "Top-up" ? "Top-up credit" : component.billingType}</strong></span></div>
          <div className="billing-history-summary-cell"><SummaryIcon name="amount"/><span><small>Amount</small><strong>{component.amount ? [component.currency, component.amount].filter(Boolean).join(" ") : "Not recorded"}</strong></span></div>
          <div className="billing-history-summary-cell"><SummaryIcon name="date"/><span><small>{dateLabel || componentDateLabel(component)}</small><strong>{dateValue || "Not recorded"}</strong></span></div>
        </div>;
      })}</div> : null}

      <div className="billing-history-section-title-row"><h3>Payments</h3>{transactions.length ? <button className="billing-history-add-button" onClick={openForm} type="button">+ Add Past Billing</button> : null}</div>
      {error ? <p className="billing-history-error" role="alert">{error}</p> : null}
      {isLoading ? <p className="billing-history-loading">Loading payments...</p> : transactions.length ? <>
        <div className="billing-history-table-wrap"><table className="billing-history-table"><thead><tr><th>Date</th><th>Plan</th><th>Type</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleTransactions.map((transaction) => <Fragment key={transaction.id}><tr><td>{billingHistoryDisplayDate(transaction.paymentDate)}</td><td>{transaction.planNameSnapshot || "Not recorded"}</td><td>{transaction.billingTypeSnapshot || "—"}</td><td>{displayAmount(transaction)}</td><td><span className={`billing-transaction-status is-${transaction.status.toLowerCase()}`}>{transaction.status}</span></td><td><button aria-label={transaction.source === "manual" ? `Edit ${billingHistoryDisplayDate(transaction.paymentDate)} payment` : `View ${billingHistoryDisplayDate(transaction.paymentDate)} payment details`} className="billing-history-details-button" onClick={() => transaction.source === "manual" ? beginEdit(transaction) : setDetailTransactionId((value) => value === transaction.id ? "" : transaction.id)} type="button">•••</button></td></tr>{detailTransactionId === transaction.id ? <tr className="billing-history-detail-row"><td colSpan={6}><div><span><strong>Note</strong>{transaction.note || "No note recorded"}</span><small>Migrated history is read-only.</small></div></td></tr> : null}</Fragment>)}</tbody></table></div>
        {transactions.length > 5 ? <button className="billing-history-view-more" onClick={() => setShowAllPayments((value) => !value)} type="button">{showAllPayments ? "Show fewer payments" : `View ${hiddenPaymentCount} more payments`}</button> : null}
      </> : <div className="billing-history-empty-state"><strong>No payments recorded yet</strong><p>Add previous payments to build your billing history.</p><button className="billing-history-add-button" onClick={openForm} type="button">+ Add Past Billing</button></div>}

      {activity.length ? <section className="billing-history-activity"><h3>Account Activity</h3><div className="billing-history-activity-list">{activity.map((entry) => <div className="billing-history-activity-row" key={entry.id}><div><strong>{entry.event}</strong><span>{billingHistoryDisplayDate(entry.date)}</span></div><p>{entry.note || ""}</p></div>)}</div></section> : null}
    </div> : null}
    {showPastBillingModal ? <div className="welcome-modal-overlay billing-past-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeForm(); }} role="presentation">
      <section aria-labelledby={`billing-past-modal-title-${relationshipId}`} aria-modal="true" className={`welcome-modal billing-past-modal${entryMode === "period" && !periodEditId ? " is-period-builder" : ""}`} role="dialog">
        <button className="billing-past-header-back-button" onClick={() => { if (periodEditId) closePeriodDraftEdit(); else if (entryMode && !editingId) { setEntryMode(""); setDraft(initialDraft()); setError(""); setOpenDropdownId(null); } else closeForm(); }} type="button">← <span>Back</span></button>
        {editingId || (periodEditId && periodEditId !== "new-one-off") ? <button aria-label="Delete billing record" className="billing-past-delete-button" onClick={() => editingId ? setShowDeleteConfirmation(true) : setPeriodDraftDeleteId(periodEditId)} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg></button> : null}
        <div className="billing-past-modal-title-row">
          <h2 id={`billing-past-modal-title-${relationshipId}`}>{editingId || (periodEditId && periodEditId !== "new-one-off") ? "Edit Past Billing" : periodEditId === "new-one-off" ? "Add One-off Payment" : "Add Past Billing"}</h2>
        </div>
        {periodEditId ? <>
          {error ? <p className="billing-history-error" role="alert">{error}</p> : null}
          <div className="billing-past-form account-card">
            <label className="form-field"><span>Payment Date</span><DateFieldControl ariaLabel="Payment date" className="field-input" onChange={(value) => setPeriodEditDraft((current) => ({ ...current, paymentDate: value }))} value={periodEditDraft.paymentDate}/></label>
            <label className="form-field"><span>Plan Name</span><input className="field-input" onChange={(event) => setPeriodEditDraft((current) => ({ ...current, planName: event.target.value }))} placeholder="Not recorded" value={periodEditDraft.planName}/></label>
            <label className="form-field"><span>Billing Type</span>{renderPastDropdown("period-edit-type", periodEditDraft.billingType, "Select billing type", draftBillingTypeOptions, (value) => setPeriodEditDraft((current) => ({ ...current, billingType: value as BillingTransactionType })))}</label>
            <label className="form-field"><span>Amount</span><span className="billing-amount-field modal-amount-field field-input billing-past-amount-field">{renderPastDropdown("period-edit-currency", periodEditDraft.currency, "Currency", currencyOptions, (value) => setPeriodEditDraft((current) => ({ ...current, currency: value })))}<input className="field-input-control" inputMode="decimal" onChange={(event) => setPeriodEditDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" value={periodEditDraft.amount}/></span></label>
            <label className="form-field"><span>Transaction Status</span>{renderPastDropdown("period-edit-status", periodEditDraft.status, "Transaction Status", statusOptions, (value) => setPeriodEditDraft((current) => ({ ...current, status: value as BillingTransactionStatus })))}</label>
            <label className="form-field billing-past-note-field"><span>Note</span><textarea className="field-input" onChange={(event) => setPeriodEditDraft((current) => ({ ...current, note: event.target.value }))} value={periodEditDraft.note}/></label>
          </div>
          <div className="welcome-modal-actions billing-past-modal-actions"><button className="btn-sm btn-sm-ghost" onClick={closePeriodDraftEdit} type="button">Cancel</button><button className="btn-sm btn-sm-primary" onClick={savePeriodDraftEdit} type="button">Save draft</button></div>
        </> : !entryMode ? <>
          <p className="billing-past-modal-intro">Choose how you want to record past billing for {accountLabel}.</p>
          <div className="billing-past-choice-grid">
            <button onClick={() => setEntryMode("single")} type="button"><SummaryIcon name="amount"/><strong>Single Payment</strong><span>Record one previous payment, purchase or top-up.</span></button>
            <button onClick={() => setEntryMode("period")} type="button"><SummaryIcon name="date"/><strong>Subscription Period</strong><span>Add recurring monthly or yearly payments across a past period.</span></button>
          </div>
          <div className="welcome-modal-actions billing-past-modal-actions"><button className="btn-sm btn-sm-ghost" onClick={closeForm} type="button">Cancel</button></div>
        </> : <>
          {error ? <p className="billing-history-error" role="alert">{error}</p> : null}
          <div className="billing-past-form account-card">
            {entryMode === "single" ? <>
              <label className="form-field"><span>Plan Name</span><input className="field-input" onChange={(event) => field("planName", event.target.value)} placeholder="Not recorded" value={draft.planName}/></label>
              <label className="form-field"><span>Transaction Status</span>{renderPastDropdown("past-status", draft.status, "Transaction Status", statusOptions, (value) => field("status", value))}</label>
              <label className="form-field"><span>Billing Type</span>{renderPastDropdown("past-billing-type", draft.billingType, "Not recorded", singleBillingTypeOptions, (value) => field("billingType", value))}</label>
              <label className="form-field"><span>Amount</span><span className="billing-amount-field modal-amount-field field-input billing-past-amount-field">{renderPastDropdown("past-currency", draft.currency, "Currency", currencyOptions, (value) => field("currency", value))}<input className="field-input-control" inputMode="decimal" onChange={(event) => field("amount", event.target.value)} placeholder="0.00" value={draft.amount}/></span></label>
              <label className="form-field"><span>Payment Date</span><DateFieldControl ariaLabel="Payment date" className="field-input" onChange={(value) => field("paymentDate", value)} value={draft.paymentDate}/></label>
              <label className="form-field billing-past-note-field"><span>Note</span><textarea className="field-input" onChange={(event) => field("note", event.target.value)} value={draft.note}/></label>
            </> : <>
              <div className="tool-detail-field-row"><label className="form-field"><span>Start Payment Date</span><DateFieldControl ariaLabel="Start payment date" className="field-input" onChange={(value) => field("startDate", value)} value={draft.startDate}/></label><label className="form-field"><span>End Payment Date</span><DateFieldControl ariaLabel="End payment date" className="field-input" onChange={(value) => field("endDate", value)} value={draft.endDate}/></label></div>
              <label className="form-field"><span>Plan Name</span><input className="field-input" onChange={(event) => periodField("planName", event.target.value)} placeholder="Not recorded" value={draft.planName}/></label>
              <label className="form-field"><span>Billing Type</span>{renderPastDropdown("past-recurring-type", draft.billingType, "Select billing type", recurringBillingTypeOptions, (value) => field("billingType", value))}</label>
              <label className="form-field"><span>Amount</span><span className="billing-amount-field modal-amount-field field-input billing-past-amount-field">{renderPastDropdown("past-period-currency", draft.currency, "Currency", currencyOptions, (value) => periodField("currency", value))}<input className="field-input-control" inputMode="decimal" onChange={(event) => periodField("amount", event.target.value)} placeholder="0.00" value={draft.amount}/></span></label>
              <label className="form-field billing-past-note-field"><span>Note</span><textarea className="field-input" onChange={(event) => periodField("note", event.target.value)} value={draft.note}/></label>
              <section className="billing-history-period-preview"><div className="billing-history-period-preview-header"><div><strong>Billing Records</strong><span>Edit any generated payment before confirming.</span></div><button onClick={beginOneOffDraft} type="button">+ Add One-off Payment</button></div>
                {periodDraftRows.length ? <div className="billing-period-draft-table"><div className="billing-period-draft-head"><span>Date</span><span>Plan</span><span>Type</span><span>Amount</span><span>Status</span><span>Action</span></div>{periodDraftRows.map((row) => <div className="billing-period-draft-row" key={row.id}><span data-label="Date">{billingHistoryDisplayDate(row.paymentDate)}</span><span data-label="Plan">{row.planName || "Not recorded"}</span><span data-label="Type">{renderPastDropdown(`period-row-type-${row.id}`, row.billingType, "Select type", draftBillingTypeOptions, (value) => updatePeriodDraft(row.id, { billingType: value as BillingTransactionType }))}</span><span className="billing-period-inline-amount" data-label="Amount"><small>{row.currency || "—"}</small><input aria-label={`Amount for ${billingHistoryDisplayDate(row.paymentDate)}`} inputMode="decimal" onChange={(event) => updatePeriodDraft(row.id, { amount: event.target.value })} value={row.amount}/></span><span data-label="Status">{renderPastDropdown(`period-row-status-${row.id}`, row.status, "Status", statusOptions, (value) => updatePeriodDraft(row.id, { status: value as BillingTransactionStatus }))}</span><span data-label="Action"><button aria-label={`Edit ${billingHistoryDisplayDate(row.paymentDate)} draft`} className="billing-history-details-button" onClick={() => beginPeriodDraftEdit(row)} type="button">•••</button></span></div>)}</div> : <p className="billing-period-draft-empty">Choose a valid start date, end date and Monthly or Yearly billing type to generate records.</p>}
                <strong className="billing-period-draft-summary">{periodDraftRows.length} billing records{previewTotal ? ` · ${previewTotal}` : ""}</strong>
              </section>
            </>}
          </div>
          <div className="welcome-modal-actions billing-past-modal-actions"><button className="btn-sm btn-sm-ghost" onClick={closeForm} type="button">Cancel</button><button className="btn-sm btn-sm-primary" disabled={isSaving} onClick={entryMode === "period" ? savePeriod : saveSingle} type="button">{isSaving ? "Saving..." : entryMode === "period" ? "Confirm records" : "Save"}</button></div>
        </>}
      </section>
      {showDeleteConfirmation ? <div className="welcome-modal-overlay billing-past-delete-overlay" role="presentation"><section aria-labelledby={`billing-delete-modal-title-${relationshipId}`} aria-modal="true" className="welcome-modal delete-account-modal billing-past-delete-modal" role="dialog"><h2 id={`billing-delete-modal-title-${relationshipId}`}>Delete billing record?</h2><p>This will permanently remove this payment from billing history.</p><div className="welcome-modal-actions"><button className="btn-sm btn-sm-ghost" disabled={isSaving} onClick={() => setShowDeleteConfirmation(false)} type="button">Cancel</button><button className="btn-sm btn-sm-danger" disabled={isSaving} onClick={removeEditedTransaction} type="button">{isSaving ? "Deleting..." : "Delete"}</button></div></section></div> : null}
      {periodDraftDeleteId ? <div className="welcome-modal-overlay billing-past-delete-overlay" role="presentation"><section aria-labelledby={`billing-draft-delete-modal-title-${relationshipId}`} aria-modal="true" className="welcome-modal delete-account-modal billing-past-delete-modal" role="dialog"><h2 id={`billing-draft-delete-modal-title-${relationshipId}`}>Delete draft record?</h2><p>This will remove this unsaved payment from the billing preview.</p><div className="welcome-modal-actions"><button className="btn-sm btn-sm-ghost" onClick={() => setPeriodDraftDeleteId("")} type="button">Cancel</button><button className="btn-sm btn-sm-danger" onClick={removePeriodDraft} type="button">Delete</button></div></section></div> : null}
    </div> : null}
  </section>;
}

export default function BillingHistoryPanel({ accounts, initialRelationshipId, onClose, restoredDate, toolName }: PanelProps) {
  const [expandedRelationshipIds, setExpandedRelationshipIds] = useState(() => new Set([initialRelationshipId]));
  const toggleRelationship = (relationshipId: string) => setExpandedRelationshipIds((current) => {
    const next = new Set(current);
    if (next.has(relationshipId)) next.delete(relationshipId);
    else next.add(relationshipId);
    return next;
  });
  return <div className="billing-history-backdrop" onClick={onClose} role="presentation"><aside aria-label="Billing History" className="billing-history-panel" onClick={(event) => event.stopPropagation()}>
    <div className="billing-history-panel-actions"><button aria-label="Close billing history" className="modal-close-button" onClick={onClose} type="button">x</button></div>
    <h2 className="billing-history-heading">Billing History</h2>
    <div className="billing-history-tool-row"><h3 className="billing-history-tool-heading">{toolName}</h3>{accounts.length > 1 ? <div className="billing-history-expand-controls"><button onClick={() => setExpandedRelationshipIds(new Set(accounts.map((account) => account.relationshipId)))} type="button">Expand all</button><button onClick={() => setExpandedRelationshipIds(new Set())} type="button">Collapse all</button></div> : null}</div>
    <div className="billing-history-account-list">{accounts.map((account) => <AccountSection {...account} isExpanded={expandedRelationshipIds.has(account.relationshipId)} key={account.relationshipId} onToggle={() => toggleRelationship(account.relationshipId)} restoredDate={account.relationshipId === initialRelationshipId ? restoredDate : undefined}/>)}</div>
  </aside></div>;
}
