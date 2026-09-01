"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createBillingTransaction, deleteManualBillingTransaction, getBillingTransactionsByRelationship, updateBillingTransaction } from "@/lib/supabase/billingTransactions";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import { subscriptionPaymentPrefill, resolvePaymentDate } from "@/lib/subscriptionPaymentPrefill";
import { firstTimeBillingComponents } from "@/lib/firstTimeBillingSetup";
import { validSubscriptionBillingTypes } from "@/lib/subscriptions";
import { addMonthsSafely, validBillingDate, localBillingToday } from "@/lib/currentBilling";
import { DropdownControl, type DropdownOption } from "@/components/DropdownControls";
import DateFieldControl from "@/components/DateFieldControl";
import { LinkedAccountCell } from "@/components/ToolRowRenderer";
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
type SinglePaymentBillingDraft = {
  nextRenewalDate?: string;
  amount: string;
  billingType: BillingTransactionType;
  currency: string;
  paymentDate: string;
};
type AdditionalTopUpDraft = {
  amount: string;
  id: string;
  note: string;
  paymentDate: string;
  status: BillingTransactionStatus;
};
type PanelProps = {
  accounts: BillingHistoryAccount[];
  initialEntryMode?: Exclude<EntryMode, "">;
  prefillCurrentBilling?: boolean;
  onEstablishCurrentBilling?: (relationshipId: string, planName: string, components: BillingAmount[]) => Promise<void>;
  onSetupComplete?: () => void;
  selectedBillingType?: string;
  initialRelationshipId: string;
  onChangeRelationship?: () => void;
  onClose: () => void;
  restoredDate?: string;
  toolLogo?: string;
  toolLogoBackground?: string;
  toolName: string;
};
type AccountSectionProps = BillingHistoryAccount & {
  initialEntryMode?: Exclude<EntryMode, "">;
  prefillCurrentBilling?: boolean;
  onEstablishCurrentBilling?: (relationshipId: string, planName: string, components: BillingAmount[]) => Promise<void>;
  onSetupComplete?: () => void;
  selectedBillingType?: string;
  isExpanded: boolean;
  onChangeRelationship?: () => void;
  onToggle: () => void;
  restoredDate?: string;
  toolLogo?: string;
  toolLogoBackground?: string;
  toolName: string;
};

function SummaryIcon({ name }: { name: "amount" | "billing" | "date" }) {
  return <svg aria-hidden="true" className="billing-history-summary-icon" fill="none" viewBox="0 0 20 20">
    {name === "billing" ? <><rect height="12" rx="2" stroke="currentColor" width="14" x="3" y="4"/><path d="M7 4v12M13 4v12M3 8h14M3 12h14" stroke="currentColor"/></> : null}
    {name === "amount" ? <><path d="M4 6.5h11.5a1.5 1.5 0 0 1 1.5 1.5v7H5.5A2.5 2.5 0 0 1 3 12.5v-8A1.5 1.5 0 0 1 4.5 3H15" stroke="currentColor"/><circle cx="13.5" cy="11" fill="currentColor" r="1"/></> : null}
    {name === "date" ? <><rect height="13" rx="2" stroke="currentColor" width="14" x="3" y="4"/><path d="M6 2v4M14 2v4M3 8h14" stroke="currentColor"/><circle cx="10" cy="12" fill="currentColor" r="1.5"/></> : null}
  </svg>;
}

const initialDraft = (): TransactionDraft => ({ amount: "", billingType: "", currency: "", endDate: "", note: "", paymentDate: "", planName: "", startDate: "", status: "Paid" });
const singlePaymentBillingDraft = (billingType: BillingTransactionType): SinglePaymentBillingDraft => ({ amount: "", billingType, currency: "", paymentDate: "" });
const localDraftId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function periodDates(start: string, end: string, type: BillingTransactionType | "") {
  if (!validBillingDate(start) || !validBillingDate(end) || start >= end || (type !== "Monthly" && type !== "Yearly")) return [];
  const dates: string[] = [];
  for (let index = 0; index < 1200; index += 1) {
    const date = addMonthsSafely(start, index * (type === "Yearly" ? 12 : 1));
    if (date >= end || date > localBillingToday()) break;
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

function InvoiceUploadField({ fileName, onChange }: { fileName: string; onChange: (fileName: string) => void }) {
  return <>
    <label className="form-field billing-past-invoice-field">
      <span>Invoice (optional)</span>
      <span className="billing-past-invoice-control">
        <input accept="application/pdf,image/jpeg,image/png" onChange={(event) => onChange(event.target.files?.[0]?.name ?? "")} type="file"/>
        <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20"><path d="M8 17H6a4 4 0 0 1-.6-7.96A6.5 6.5 0 0 1 18 10.5h.5a3.5 3.5 0 0 1 .5 6.96M12 12v8m0-8-3 3m3-3 3 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/></svg>
        <strong>{fileName || "Upload invoice"}</strong>
        <small>PNG, JPG, PDF up to 10MB</small>
      </span>
    </label>
    <div className="billing-past-or-pill" aria-hidden="true">or</div>
  </>;
}

function PastBillingAccountSummary({ accountEmail, accountLabel, accountTag, onChangeRelationship, planName, toolLogo, toolLogoBackground, toolName }: Pick<AccountSectionProps, "accountEmail" | "accountLabel" | "accountTag" | "onChangeRelationship" | "planName" | "toolLogo" | "toolLogoBackground" | "toolName">) {
  return <div className="billing-past-account-summary">
    <div className="billing-past-account-summary-copy">
      <span className="billing-past-account-tool"><span className="tool-logo" style={{ background: toolLogoBackground }}>{toolLogo}</span><strong>{toolName}</strong>{planName ? <span className="tool-status-chip status-paid billing-past-plan-name-display">{planName}</span> : <span className="muted-cell">Not set</span>}</span>
      <LinkedAccountCell accountLabel={accountLabel} login={accountEmail} tagClass={accountTag}/>
    </div>
    {onChangeRelationship ? <button className="btn-sm btn-sm-ghost" onClick={onChangeRelationship} type="button">Change</button> : null}
  </div>;
}

function AccountSection({ accountActivity, accountEmail, accountLabel, accountTag, billingAmounts, initialEntryMode, prefillCurrentBilling, onEstablishCurrentBilling, onSetupComplete, selectedBillingType, isExpanded, onChangeRelationship, onToggle, planName, relationshipId, restoredDate, toolLogo, toolLogoBackground, toolName }: AccountSectionProps) {
  const prefill = prefillCurrentBilling && initialEntryMode ? subscriptionPaymentPrefill(billingAmounts, initialEntryMode, selectedBillingType) : null;
  const [setupRenewalDate, setSetupRenewalDate] = useState(prefill?.nextRenewalDate ?? "");
  const [setupBillingSaved, setSetupBillingSaved] = useState(false);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [detailTransactionId, setDetailTransactionId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode>(initialEntryMode ?? "");
  const [showPastBillingModal, setShowPastBillingModal] = useState(Boolean(initialEntryMode));
  const [draft, setDraft] = useState<TransactionDraft>(() => ({ ...initialDraft(), planName, ...(prefill ? { ...prefill, startDate: initialEntryMode === "period" ? prefill.paymentDate : "", endDate: initialEntryMode === "period" ? prefill.paymentDate : "" } : {}) }));
  const [editingId, setEditingId] = useState("");
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [periodDraftRows, setPeriodDraftRows] = useState<PeriodDraftRow[]>([]);
  const [periodGenerationKey, setPeriodGenerationKey] = useState("");
  const [periodEditId, setPeriodEditId] = useState("");
  const [periodEditDraft, setPeriodEditDraft] = useState<TransactionDraft>(initialDraft);
  const [periodDraftDeleteId, setPeriodDraftDeleteId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [invoiceFileName, setInvoiceFileName] = useState("");
  const [showPeriodPreview, setShowPeriodPreview] = useState(false);
  const [singlePaymentBillingDrafts, setSinglePaymentBillingDrafts] = useState<SinglePaymentBillingDraft[]>(() => prefill && initialEntryMode === "single" ? [{ ...prefill }] : []);
  const [singlePaymentKey, setSinglePaymentKey] = useState(localDraftId);
  const [additionalTopUpDrafts, setAdditionalTopUpDrafts] = useState<AdditionalTopUpDraft[]>([]);

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

  const previewDates = useMemo(() => periodDates(draft.startDate, setupRenewalDate, draft.billingType), [draft.billingType, setupRenewalDate, draft.startDate]);
  useEffect(() => {
    if (entryMode !== "period") return;
    const generationKey = `${draft.startDate}|${setupRenewalDate}|${draft.billingType}`;
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
        status: draft.status,
      })),
      ...current.filter((row) => row.origin === "one-off"),
    ]);
  }, [draft.amount, draft.billingType, draft.currency, setupRenewalDate, draft.note, draft.planName, draft.startDate, draft.status, entryMode, periodGenerationKey, previewDates, relationshipId]);
  const previewTotals = useMemo(() => periodDraftRows.reduce<Record<string, number>>((totals, row) => {
    const amount = Number(row.amount);
    if (!row.amount || !Number.isFinite(amount)) return totals;
    const currency = row.currency || "Amount";
    totals[currency] = (totals[currency] ?? 0) + amount;
    return totals;
  }, {}), [periodDraftRows]);
  const previewTotal = Object.entries(previewTotals).map(([currency, total]) => `${currency === "Amount" ? "" : `${currency} `}${total.toFixed(2).replace(/\.00$/, "")}`).join(" + ");
  const reviewPeriodDraftRows = useMemo(() => [...periodDraftRows].sort((left, right) => right.paymentDate.localeCompare(left.paymentDate)), [periodDraftRows]);
  const activity = restoredDate
    ? [{ date: restoredDate, event: "Restored", id: `restored-${relationshipId}`, note: "Restored by you" }, ...accountActivity]
    : accountActivity;
  const visibleTransactions = showAllPayments ? transactions : transactions.slice(0, 5);
  const hiddenPaymentCount = Math.max(0, transactions.length - visibleTransactions.length);

  const closeForm = () => { setShowPastBillingModal(false); setShowDeleteConfirmation(false); setEntryMode(""); setEditingId(""); setDraft(initialDraft()); setPeriodDraftRows([]); setPeriodGenerationKey(""); setPeriodEditId(""); setPeriodEditDraft(initialDraft()); setPeriodDraftDeleteId(""); setError(""); setOpenDropdownId(null); setInvoiceFileName(""); setShowPeriodPreview(false); setSinglePaymentBillingDrafts([]); setSinglePaymentKey(localDraftId()); setAdditionalTopUpDrafts([]); };
  const returnToEntrySelector = () => { closeForm(); onChangeRelationship?.(); };
  const openForm = () => { onChangeRelationship?.(); };
  const field = (key: keyof TransactionDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const periodField = (key: keyof TransactionDraft, value: string) => {
    field(key, value);
    if (key === "amount" || key === "currency" || key === "note" || key === "planName" || key === "status") {
      setPeriodDraftRows((current) => current.map((row) => row.origin === "generated" ? { ...row, [key]: value } : row));
    }
  };
  const updatePeriodDraft = (id: string, patch: Partial<TransactionDraft>) => setPeriodDraftRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  const updatePeriodDraftCurrency = (currency: string) => {
    field("currency", currency);
    setPeriodDraftRows((current) => current.map((candidate) => ({ ...candidate, currency })));
    setPeriodEditDraft((current) => ({ ...current, currency }));
  };
  const renderPastDropdown = (id: string, value: string, placeholder: string, options: DropdownOption[], onChange: (value: string) => void) => <DropdownControl ariaLabel={placeholder} className="billing-past-dropdown" id={`${id}-${relationshipId}`} isOpen={openDropdownId === `${id}-${relationshipId}`} onChange={onChange} onOpenChange={setOpenDropdownId} options={options} placeholder={placeholder} value={value}/>;
  const currencyOptions = ["AUD", "EUR", "GBP", "SGD", "USD"].map((value) => ({ label: value, value }));
  const statusOptions = ["Paid", "Pending", "Failed", "Refunded"].map((value) => ({ label: value, value }));
  const singleBillingTypeOptions = [{ label: "Not recorded", value: "" }, ...["Monthly", "Yearly", "Lifetime", "One-time", "Top-up"].map((value) => ({ label: value === "One-time" ? "One-time payment" : value === "Top-up" ? "Top-up credit" : value, value }))];
  const draftBillingTypeOptions = singleBillingTypeOptions.slice(1);
  const recurringBillingTypeOptions = ["Monthly", "Yearly"].map((value) => ({ label: value, value }));
  const billingTypeLabel = (value: BillingTransactionType) => value === "One-time" ? "One-time payment" : value === "Top-up" ? "Top-up credit" : value;
  const canAddSingleBillingType = (selectedTypes: BillingTransactionType[], candidate: BillingTransactionType) => {
    if (selectedTypes.includes(candidate)) return true;
    if (onEstablishCurrentBilling) return validSubscriptionBillingTypes([...selectedTypes, candidate]);
    if (selectedTypes.length === 0) return true;
    if (selectedTypes.length >= 2) return false;
    const selected = selectedTypes[0];
    return (candidate === "Top-up" && (selected === "Monthly" || selected === "Yearly" || selected === "Lifetime"))
      || (selected === "Top-up" && (candidate === "Monthly" || candidate === "Yearly" || candidate === "Lifetime"));
  };
  const toggleSingleBillingType = (billingType: BillingTransactionType) => {
    if (billingType === "Top-up" && singlePaymentBillingDrafts.some((component) => component.billingType === billingType)) setAdditionalTopUpDrafts([]);
    setSinglePaymentBillingDrafts((current) => {
      const isSelected = current.some((component) => component.billingType === billingType);
      if (isSelected) return current.filter((component) => component.billingType !== billingType);
      return canAddSingleBillingType(current.map((component) => component.billingType), billingType)
        ? [...current, { ...singlePaymentBillingDraft(billingType), currency: current[0]?.currency ?? "" }]
        : current;
    });
  };
  const updateSingleBillingDraft = (billingType: BillingTransactionType, patch: Partial<SinglePaymentBillingDraft>) => setSinglePaymentBillingDrafts((current) => current.map((component) => component.billingType === billingType ? { ...component, ...patch } : component));
  const updateSingleBillingCurrency = (currency: string) => setSinglePaymentBillingDrafts((current) => current.map((component) => ({ ...component, currency })));
  const addTopUpDraft = () => setAdditionalTopUpDrafts((current) => [...current, { amount: "", id: localDraftId(), note: "", paymentDate: "", status: draft.status }]);
  const updateAdditionalTopUpDraft = (id: string, patch: Partial<AdditionalTopUpDraft>) => setAdditionalTopUpDrafts((current) => current.map((component) => component.id === id ? { ...component, ...patch } : component));
  const removeAdditionalTopUpDraft = (id: string) => setAdditionalTopUpDrafts((current) => current.filter((component) => component.id !== id));
  const hasTopUpBillingType = singlePaymentBillingDrafts.some((component) => component.billingType === "Top-up");
  const singlePaymentCount = singlePaymentBillingDrafts.length + additionalTopUpDrafts.length;
  const singleBillingTypeDropdownId = `past-billing-types-${relationshipId}`;
  const renderSingleBillingTypeDropdown = () => {
    const selectedTypes = singlePaymentBillingDrafts.map((component) => component.billingType);
    const isOpen = openDropdownId === singleBillingTypeDropdownId;
    return <div className={`custom-select multi-select billing-past-dropdown billing-past-type-dropdown${isOpen ? " is-open" : ""}`} id={singleBillingTypeDropdownId} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenDropdownId(null); }}>
      <div aria-expanded={isOpen} aria-label="Billing Type" className={`custom-select-trigger billing-past-type-trigger${selectedTypes.length ? "" : " is-placeholder"}`} onClick={() => setOpenDropdownId(isOpen ? null : singleBillingTypeDropdownId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpenDropdownId(isOpen ? null : singleBillingTypeDropdownId); } }} role="button" tabIndex={0}>
        <span className="billing-past-selected-types">{selectedTypes.length ? selectedTypes.map((billingType) => <button aria-label={`Remove ${billingTypeLabel(billingType)}`} className="preset-tool-pill is-added billing-past-selected-type-chip" key={billingType} onClick={(event) => { event.stopPropagation(); toggleSingleBillingType(billingType); }} type="button">{billingTypeLabel(billingType)}<span aria-hidden="true">×</span></button>) : <span>Select billing type</span>}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>
      </div>
      {isOpen ? <div className="custom-select-options">{draftBillingTypeOptions.map((option) => {
        const billingType = option.value as BillingTransactionType;
        const isSelected = selectedTypes.includes(billingType);
        const isDisabled = !canAddSingleBillingType(selectedTypes, billingType);
        return <button className={isSelected ? "custom-select-option multi-select-option is-selected" : "custom-select-option multi-select-option"} disabled={isDisabled} key={billingType} onClick={(event) => { event.stopPropagation(); if (!isDisabled) toggleSingleBillingType(billingType); }} onMouseDown={(event) => event.preventDefault()} type="button"><input checked={isSelected} readOnly type="checkbox"/><span>{billingTypeLabel(billingType)}</span></button>;
      })}</div> : null}
    </div>;
  };

  const directPaymentDates = Boolean((prefillCurrentBilling || onEstablishCurrentBilling) && !editingId);
  const singleDateLabel = (_type: BillingTransactionType) => "Payment Date (optional)";
  const saveSingle = async () => {
    if (!singlePaymentBillingDrafts.length) return setError("Select at least one billing type.");
    if (singlePaymentBillingDrafts.some((component) => !resolvePaymentDate(component))) return setError("Enter a valid Payment Date, or provide Next renewal for a Monthly/Yearly payment.");
    if (additionalTopUpDrafts.some((component) => !component.paymentDate)) return setError("A top-up date is required for each additional payment.");
    const transactionDates = singlePaymentBillingDrafts.map(resolvePaymentDate);
    const today = new Date().toISOString().slice(0, 10);
    if (transactionDates.some((paymentDate, index) => (singlePaymentBillingDrafts[index].billingType === "Monthly" || singlePaymentBillingDrafts[index].billingType === "Yearly") && paymentDate > today)) return setError(directPaymentDates ? "The payment date is in the future. Review it before saving." : "The inferred current-cycle payment is still in the future. Review the Next renewal date.");
    if (isSaving) return;
    setIsSaving(true); setError("");
    try {
      if (onEstablishCurrentBilling && !editingId) {
        const components = firstTimeBillingComponents(singlePaymentBillingDrafts.map((component, index) => ({ ...component, paymentDate: transactionDates[index] })));
        if ([...transactionDates, ...additionalTopUpDrafts.map((item) => item.paymentDate)].some((date) => !validBillingDate(date) || date > today)) throw new Error("Enter valid past or current payment dates.");
        if (additionalTopUpDrafts.some((item) => !/^\d+(\.\d+)?$/.test(item.amount.trim()))) throw new Error("Enter an amount for each additional payment.");
        await onEstablishCurrentBilling(relationshipId, draft.planName, components);
        setSetupBillingSaved(true);
      }
      const sharedCurrency = singlePaymentBillingDrafts[0]?.currency ?? "";
      const baseInputs = singlePaymentBillingDrafts.map((component, index) => ({ amount: component.amount, billingTypeSnapshot: component.billingType, currency: component.currency, note: draft.note, paymentDate: transactionDates[index], planNameSnapshot: draft.planName, status: draft.status }));
      const extraInputs = additionalTopUpDrafts.map((component) => ({ amount: component.amount, billingTypeSnapshot: "Top-up" as const, currency: sharedCurrency, draftId: component.id, note: component.note, paymentDate: component.paymentDate, planNameSnapshot: draft.planName, status: component.status }));
      if (editingId) {
        await updateBillingTransaction(editingId, baseInputs[0]);
        await Promise.all([
          ...baseInputs.slice(1).map((input) => createBillingTransaction({ ...input, relationshipId, sourceKey: `single-payment-edit:${editingId}:${input.billingTypeSnapshot}` })),
          ...extraInputs.map(({ draftId, ...input }) => createBillingTransaction({ ...input, relationshipId, sourceKey: `single-payment-edit:${editingId}:Top-up-extra:${draftId}` })),
        ]);
      } else {
        await Promise.all([
          ...baseInputs.map((input) => createBillingTransaction({ ...input, relationshipId, sourceKey: `single-payment:${relationshipId}:${singlePaymentKey}:${input.billingTypeSnapshot}` })),
          ...extraInputs.map(({ draftId, ...input }) => createBillingTransaction({ ...input, relationshipId, sourceKey: `single-payment:${relationshipId}:${singlePaymentKey}:Top-up-extra:${draftId}` })),
        ]);
      }
      await reload(); closeForm();
      if (onEstablishCurrentBilling && !editingId) onSetupComplete?.();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not save billing transaction."); }
    finally { setIsSaving(false); }
  };

  const savePeriod = async () => {
    if (isSaving) return;
    if (!periodDraftRows.length) return setError("Generate at least one billing record before confirming.");
    setIsSaving(true); setError("");
    try {
      if (onEstablishCurrentBilling) {
        const components = firstTimeBillingComponents([{ ...draft, paymentDate: previewDates.at(-1) ?? "", nextRenewalDate: setupRenewalDate }]);
        const today = new Date().toISOString().slice(0, 10);
        if (periodDraftRows.some((row) => !validBillingDate(row.paymentDate) || row.paymentDate > today || !/^[A-Z]{3}$/.test(row.currency.trim().toUpperCase()) || !/^\d+(\.\d+)?$/.test(row.amount.trim()))) throw new Error("Review payment dates, currencies and amounts before saving.");
        await onEstablishCurrentBilling(relationshipId, draft.planName, components);
        setSetupBillingSaved(true);
      }
      await Promise.all(periodDraftRows.map((row) => createBillingTransaction({ amount: row.amount, billingTypeSnapshot: row.billingType, currency: row.currency, note: row.note, paymentDate: row.paymentDate, planNameSnapshot: row.planName, relationshipId, sourceKey: row.sourceKey, status: row.status })));
      await reload(); closeForm();
      if (onEstablishCurrentBilling) onSetupComplete?.();
    } catch (caught: unknown) { setError(caught instanceof Error ? caught.message : "Could not save subscription period."); }
    finally { setIsSaving(false); }
  };

  const reviewPeriod = () => {
    setError("");
    if (draft.billingType !== "Monthly" && draft.billingType !== "Yearly") return setError("Select Monthly or Yearly billing type.");
    if (!validBillingDate(draft.startDate) || !validBillingDate(setupRenewalDate) || draft.startDate >= setupRenewalDate) return setError("Enter a valid Start Date before Next renewal.");
    if (!periodDraftRows.length) return setError("Choose a valid billing period to generate payments.");
    setOpenDropdownId(null);
    if (onEstablishCurrentBilling) {
      try { firstTimeBillingComponents([{ ...draft, paymentDate: previewDates.at(-1) ?? "", nextRenewalDate: setupRenewalDate }]); }
      catch (caught) { return setError(caught instanceof Error ? caught.message : "Complete Current Billing details."); }
    }
    setShowPeriodPreview(true);
  };

  const beginEdit = (transaction: BillingTransaction) => {
    setEntryMode("single"); setEditingId(transaction.id); setShowPastBillingModal(true);
    setDraft({ amount: transaction.amount, billingType: transaction.billingTypeSnapshot, currency: transaction.currency, endDate: "", note: transaction.note, paymentDate: transaction.paymentDate, planName: transaction.planNameSnapshot, startDate: "", status: transaction.status });
    if (transaction.billingTypeSnapshot) setSinglePaymentBillingDrafts([{ amount: transaction.amount, billingType: transaction.billingTypeSnapshot, currency: transaction.currency, paymentDate: transaction.paymentDate }]);
    else setSinglePaymentBillingDrafts([]);
    setAdditionalTopUpDrafts([]);
    setSinglePaymentKey(`edit-${transaction.id}`);
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
    const sharedPeriodDraft = { ...periodEditDraft, currency: draft.currency };
    if (periodEditId === "new-one-off") {
      const id = localDraftId();
      setPeriodDraftRows((current) => [...current, { ...sharedPeriodDraft, id, origin: "one-off", sourceKey: `subscription-period:${relationshipId}:one-off:${id}` }]);
    } else {
      updatePeriodDraft(periodEditId, sharedPeriodDraft);
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

      <div className="billing-history-section-title-row"><h3>Payments</h3>{transactions.length ? <button className="billing-history-add-button" onClick={openForm} type="button">+ Add Payment</button> : null}</div>
      {error ? <p className="billing-history-error" role="alert">{error}</p> : null}
      {isLoading ? <p className="billing-history-loading">Loading payments...</p> : transactions.length ? <>
        <div className="billing-history-table-wrap"><table className="billing-history-table"><thead><tr><th>Date</th><th>Plan</th><th>Type</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleTransactions.map((transaction) => <Fragment key={transaction.id}><tr><td>{billingHistoryDisplayDate(transaction.paymentDate)}</td><td>{transaction.planNameSnapshot || "Not recorded"}</td><td>{transaction.billingTypeSnapshot || "—"}</td><td>{displayAmount(transaction)}</td><td><span className={`billing-transaction-status is-${transaction.status.toLowerCase()}`}>{transaction.status}</span></td><td><button aria-label={transaction.source === "manual" ? `Edit ${billingHistoryDisplayDate(transaction.paymentDate)} payment` : `View ${billingHistoryDisplayDate(transaction.paymentDate)} payment details`} className="billing-history-details-button" onClick={() => transaction.source === "manual" ? beginEdit(transaction) : setDetailTransactionId((value) => value === transaction.id ? "" : transaction.id)} type="button">•••</button></td></tr>{detailTransactionId === transaction.id ? <tr className="billing-history-detail-row"><td colSpan={6}><div><span><strong>Note</strong>{transaction.note || "No note recorded"}</span><small>Migrated history is read-only.</small></div></td></tr> : null}</Fragment>)}</tbody></table></div>
        {transactions.length > 5 ? <button className="billing-history-view-more" onClick={() => setShowAllPayments((value) => !value)} type="button">{showAllPayments ? "Show fewer payments" : `View ${hiddenPaymentCount} more payments`}</button> : null}
      </> : <div className="billing-history-empty-state"><strong>No payments recorded yet</strong><p>Add previous payments to build your billing history.</p><button className="billing-history-add-button" onClick={openForm} type="button">+ Add Payment</button></div>}

      {activity.length ? <section className="billing-history-activity"><h3>Account Activity</h3><div className="billing-history-activity-list">{activity.map((entry) => <div className="billing-history-activity-row" key={entry.id}><div><strong>{entry.event}</strong><span>{billingHistoryDisplayDate(entry.date)}</span></div><p>{entry.note || ""}</p></div>)}</div></section> : null}
    </div> : null}
    {showPastBillingModal ? <div className="welcome-modal-overlay billing-past-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeForm(); }} role="presentation">
      <section aria-labelledby={`billing-past-modal-title-${relationshipId}`} aria-modal="true" className={`welcome-modal billing-past-modal${entryMode === "period" && !periodEditId ? ` is-period-builder${showPeriodPreview ? " is-period-review" : ""}` : entryMode === "single" ? " is-single-payment" : ""}`} role="dialog">
        <button className="billing-past-header-back-button" onClick={() => { if (periodEditId) closePeriodDraftEdit(); else if (entryMode === "period" && showPeriodPreview) { setShowPeriodPreview(false); setError(""); setOpenDropdownId(null); } else if (entryMode && !editingId) returnToEntrySelector(); else closeForm(); }} type="button">← <span>Back</span></button>
        {editingId || (periodEditId && periodEditId !== "new-one-off") ? <button aria-label="Delete billing record" className="billing-past-delete-button" onClick={() => editingId ? setShowDeleteConfirmation(true) : setPeriodDraftDeleteId(periodEditId)} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg></button> : null}
        <div className="billing-past-modal-title-row">
          <h2 id={`billing-past-modal-title-${relationshipId}`}>{editingId || (periodEditId && periodEditId !== "new-one-off") ? "Edit Past Billing" : periodEditId === "new-one-off" ? "Add One-off Payment" : "Add Payment"}</h2>
        </div>
        {periodEditId ? <>
          {error ? <p className="billing-history-error" role="alert">{error}</p> : null}
          <div className="billing-past-form account-card">
            <label className="form-field"><span>Payment Date</span><DateFieldControl ariaLabel="Payment date" className="field-input" onChange={(value) => setPeriodEditDraft((current) => ({ ...current, paymentDate: value }))} value={periodEditDraft.paymentDate}/></label>
            <label className="form-field"><span>Plan Name</span><input className="field-input" onChange={(event) => setPeriodEditDraft((current) => ({ ...current, planName: event.target.value }))} placeholder="Not recorded" value={periodEditDraft.planName}/></label>
            <label className="form-field"><span>Billing Type</span>{renderPastDropdown("period-edit-type", periodEditDraft.billingType, "Select billing type", draftBillingTypeOptions, (value) => setPeriodEditDraft((current) => ({ ...current, billingType: value as BillingTransactionType })))}</label>
            <label className="form-field"><span>Amount</span><span className="billing-amount-field modal-amount-field field-input billing-past-amount-field"><span className="billing-past-shared-currency">{draft.currency || "Currency"}</span><input className="field-input-control" inputMode="decimal" onChange={(event) => setPeriodEditDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" value={periodEditDraft.amount}/></span></label>
            <label className="form-field"><span>Transaction Status</span>{renderPastDropdown("period-edit-status", periodEditDraft.status, "Transaction Status", statusOptions, (value) => setPeriodEditDraft((current) => ({ ...current, status: value as BillingTransactionStatus })))}</label>
            <label className="form-field billing-past-note-field"><span>Note</span><textarea className="field-input" onChange={(event) => setPeriodEditDraft((current) => ({ ...current, note: event.target.value }))} value={periodEditDraft.note}/></label>
          </div>
          <div className="welcome-modal-actions billing-past-modal-actions"><button className="btn-sm btn-sm-ghost" onClick={closePeriodDraftEdit} type="button">Cancel</button><button className="btn-sm btn-sm-primary" onClick={savePeriodDraftEdit} type="button">Save draft</button></div>
        </> : entryMode ? <>
          {error ? <p className="billing-history-error" role="alert">{error}</p> : null}
          {!editingId ? <h3 className="billing-past-form-heading category-view-title">{entryMode === "period" ? "Subscription Period" : "Single Payment"}</h3> : null}
          <PastBillingAccountSummary accountEmail={accountEmail} accountLabel={accountLabel} accountTag={accountTag} planName={planName} toolLogo={toolLogo} toolLogoBackground={toolLogoBackground} toolName={toolName}/>
          <div className={`billing-past-form billing-past-payment-details${entryMode === "period" && showPeriodPreview ? " billing-period-review" : ""}`}>
            {entryMode === "single" ? <>
              <h4 className="billing-past-section-heading category-view-title">Payment Details</h4>
              <InvoiceUploadField fileName={invoiceFileName} onChange={setInvoiceFileName}/>
              <div className="tool-detail-field-row"><label className="form-field"><span>Plan Name</span><input className="field-input billing-past-plan-name-input" onChange={(event) => field("planName", event.target.value)} placeholder="Not recorded" value={draft.planName}/></label><div className="form-field billing-past-type-field"><span className="billing-past-field-label">Billing Type <small>(Select up to 2)</small></span>{renderSingleBillingTypeDropdown()}</div></div>
              <div className="billing-past-single-components">{singlePaymentBillingDrafts.map((component) => <section className="billing-past-single-component" key={component.billingType}>
                <h5>{billingTypeLabel(component.billingType)}</h5>
                {(component.billingType === "Monthly" || component.billingType === "Yearly") ? <label className="form-field"><span>Next renewal</span><DateFieldControl ariaLabel="Next renewal" className="field-input" value={component.nextRenewalDate ?? ""} onChange={(value) => updateSingleBillingDraft(component.billingType, { nextRenewalDate: value })} /></label> : null}
                <div className="tool-detail-field-row"><label className="form-field"><span>{singleDateLabel(component.billingType)}</span><DateFieldControl ariaLabel={`${billingTypeLabel(component.billingType)} ${singleDateLabel(component.billingType).toLowerCase()}`} className="field-input" onChange={(value) => updateSingleBillingDraft(component.billingType, { paymentDate: value })} value={component.paymentDate}/></label><label className="form-field"><span>Currency + Amount</span><span className="billing-amount-field modal-amount-field field-input billing-past-amount-field">{renderPastDropdown(`past-currency-${component.billingType}`, component.currency, "Currency", currencyOptions, updateSingleBillingCurrency)}<input aria-label={`${billingTypeLabel(component.billingType)} amount`} className="field-input-control" inputMode="decimal" onChange={(event) => updateSingleBillingDraft(component.billingType, { amount: event.target.value })} placeholder="0.00" value={component.amount}/></span></label></div>
              </section>)}</div>
              <div className="tool-detail-field-row billing-past-status-notes-row"><label className="form-field"><span>Status</span>{renderPastDropdown("past-status", draft.status, "Status", statusOptions, (value) => field("status", value))}</label><label className="form-field billing-past-note-field"><span>Notes</span><input className="field-input" onChange={(event) => field("note", event.target.value)} placeholder="Add a note..." value={draft.note}/></label></div>
              {additionalTopUpDrafts.map((component, index) => <section className="billing-past-additional-payment" key={component.id}><div className="billing-past-additional-payment-heading"><h5>Top-up payment {index + 2}</h5><button aria-label={`Remove top-up payment ${index + 2}`} onClick={() => removeAdditionalTopUpDraft(component.id)} type="button">Remove</button></div><div className="tool-detail-field-row"><label className="form-field"><span>Last top-up</span><DateFieldControl ariaLabel={`Additional top-up date ${index + 2}`} className="field-input" onChange={(value) => updateAdditionalTopUpDraft(component.id, { paymentDate: value })} value={component.paymentDate}/></label><label className="form-field"><span>Currency + Amount</span><span className="billing-amount-field modal-amount-field field-input billing-past-amount-field"><span className="billing-past-shared-currency">{singlePaymentBillingDrafts[0]?.currency || "Currency"}</span><input aria-label={`Additional top-up amount ${index + 2}`} className="field-input-control" inputMode="decimal" onChange={(event) => updateAdditionalTopUpDraft(component.id, { amount: event.target.value })} placeholder="0.00" value={component.amount}/></span></label></div><div className="tool-detail-field-row billing-past-status-notes-row"><label className="form-field"><span>Status</span>{renderPastDropdown(`past-extra-status-${component.id}`, component.status, "Status", statusOptions, (value) => updateAdditionalTopUpDraft(component.id, { status: value as BillingTransactionStatus }))}</label><label className="form-field billing-past-note-field"><span>Notes</span><input className="field-input" onChange={(event) => updateAdditionalTopUpDraft(component.id, { note: event.target.value })} placeholder="Add a note..." value={component.note}/></label></div></section>)}
              {hasTopUpBillingType ? <button className="billing-past-add-another-payment" onClick={addTopUpDraft} type="button">+ Add Another Payment</button> : null}
            </> : showPeriodPreview ? <>
              <div className="billing-period-review-header"><h4>Preview Payments ({periodDraftRows.length} payments)</h4><button onClick={beginOneOffDraft} type="button">+ Add Extra Payment</button></div>
              <p className="billing-period-review-helper">AI Subprise generated these payments from your billing details. Review and edit anything before saving to Billing History.</p>
              <label className="form-field billing-period-review-currency"><span>Currency</span>{renderPastDropdown("past-period-review-currency", draft.currency, "Currency", currencyOptions, updatePeriodDraftCurrency)}</label>
              {reviewPeriodDraftRows.length ? <div className="billing-period-draft-table"><div className="billing-period-draft-head"><span>Date</span><span>Type</span><span>Amount</span><span>Status</span><span>Action</span></div>{reviewPeriodDraftRows.map((row) => <div className="billing-period-draft-row" key={row.id}><span data-label="Date"><DateFieldControl ariaLabel={`Payment date for ${billingHistoryDisplayDate(row.paymentDate)}`} className="field-input billing-period-inline-date" onChange={(value) => updatePeriodDraft(row.id, { paymentDate: value })} value={row.paymentDate}/></span><span data-label="Type">{renderPastDropdown(`period-row-type-${row.id}`, row.billingType, "Select type", draftBillingTypeOptions, (value) => updatePeriodDraft(row.id, { billingType: value as BillingTransactionType }))}</span><span className="billing-period-inline-amount" data-label="Amount"><span className="billing-period-inline-currency">{row.currency || "—"}</span><input aria-label={`Amount for ${billingHistoryDisplayDate(row.paymentDate)}`} inputMode="decimal" onChange={(event) => updatePeriodDraft(row.id, { amount: event.target.value })} value={row.amount}/></span><span data-label="Status">{renderPastDropdown(`period-row-status-${row.id}`, row.status, "Status", statusOptions, (value) => updatePeriodDraft(row.id, { status: value as BillingTransactionStatus }))}</span><span data-label="Action"><button aria-label={`Edit ${billingHistoryDisplayDate(row.paymentDate)} draft`} className="billing-history-details-button" onClick={() => beginPeriodDraftEdit(row)} type="button">•••</button></span></div>)}</div> : <p className="billing-period-draft-empty">Choose a valid start date, next renewal and Monthly or Yearly billing type to generate records.</p>}
              <p className="billing-period-review-order">Payments are generated from newest to oldest.</p>
              </> : <>
              <h4 className="billing-past-section-heading category-view-title">Payment Details</h4>
              <InvoiceUploadField fileName={invoiceFileName} onChange={setInvoiceFileName}/>
              <div className="tool-detail-field-row"><label className="form-field"><span>Plan Name</span><input className="field-input billing-past-plan-name-input" onChange={(event) => periodField("planName", event.target.value)} placeholder="Not recorded" value={draft.planName}/></label><label className="form-field"><span>Billing Type</span>{renderPastDropdown("past-recurring-type", draft.billingType, "Select billing type", recurringBillingTypeOptions, (value) => field("billingType", value))}</label></div>

              <div className="tool-detail-field-row"><label className="form-field"><span>Start Date</span><DateFieldControl ariaLabel="Start date" className="field-input" onChange={(value) => field("startDate", value)} value={draft.startDate}/></label><label className="form-field"><span>Next renewal</span><DateFieldControl ariaLabel="Next renewal" className="field-input" onChange={setSetupRenewalDate} value={setupRenewalDate}/></label></div>
              <label className="form-field"><span>Currency + Amount</span><span className="billing-amount-field modal-amount-field field-input billing-past-amount-field">{renderPastDropdown("past-period-currency", draft.currency, "Currency", currencyOptions, (value) => periodField("currency", value))}<input aria-label="Amount per payment" className="field-input-control" inputMode="decimal" onChange={(event) => periodField("amount", event.target.value)} placeholder="0.00" value={draft.amount}/></span></label>
              <div className="tool-detail-field-row billing-past-status-notes-row"><label className="form-field"><span>Status</span>{renderPastDropdown("past-period-status", draft.status, "Status", statusOptions, (value) => periodField("status", value))}</label><label className="form-field billing-past-note-field"><span>Notes</span><input className="field-input" onChange={(event) => periodField("note", event.target.value)} placeholder="Add a note..." value={draft.note}/></label></div>
              <div className="billing-period-preview-actions"><span>{periodDraftRows.length} total payments{previewTotal ? ` · ${previewTotal}` : ""}</span></div>
              </>}
          </div>
          {setupBillingSaved && error ? <p role="status">Current Billing was saved. Payment recording may be incomplete. Retry this form to finish; existing duplicate protection remains in place.</p> : null}
          <div className="billing-past-footer-row">
            <div className="billing-past-payment-info"><span aria-hidden="true">i</span><p>{entryMode === "period" ? `${periodDraftRows.length} payment${periodDraftRows.length === 1 ? "" : "s"} will be added to billing history for` : `${singlePaymentCount} payment${singlePaymentCount === 1 ? "" : "s"} will be added to billing history for`}<br/><strong>{toolName} · {accountLabel}</strong>{accountEmail ? <small> ({accountEmail})</small> : null}</p></div>
            <div className="welcome-modal-actions billing-past-modal-actions"><button className="btn-sm btn-sm-ghost" onClick={returnToEntrySelector} type="button">Cancel</button><button className="btn-sm btn-sm-primary" disabled={isSaving} onClick={entryMode === "period" ? showPeriodPreview ? savePeriod : reviewPeriod : saveSingle} type="button">{isSaving ? "Saving..." : entryMode === "period" ? showPeriodPreview ? "Save Period" : "Review Payments" : singlePaymentCount > 1 ? `Save ${singlePaymentCount} Payments` : "Save Payment"}</button></div>
          </div>
        </> : null}
      </section>
      {showDeleteConfirmation ? <div className="welcome-modal-overlay billing-past-delete-overlay" role="presentation"><section aria-labelledby={`billing-delete-modal-title-${relationshipId}`} aria-modal="true" className="welcome-modal delete-account-modal billing-past-delete-modal" role="dialog"><h2 id={`billing-delete-modal-title-${relationshipId}`}>Delete billing record?</h2><p>This will permanently remove this payment from billing history.</p><div className="welcome-modal-actions"><button className="btn-sm btn-sm-ghost" disabled={isSaving} onClick={() => setShowDeleteConfirmation(false)} type="button">Cancel</button><button className="btn-sm btn-sm-danger" disabled={isSaving} onClick={removeEditedTransaction} type="button">{isSaving ? "Deleting..." : "Delete"}</button></div></section></div> : null}
      {periodDraftDeleteId ? <div className="welcome-modal-overlay billing-past-delete-overlay" role="presentation"><section aria-labelledby={`billing-draft-delete-modal-title-${relationshipId}`} aria-modal="true" className="welcome-modal delete-account-modal billing-past-delete-modal" role="dialog"><h2 id={`billing-draft-delete-modal-title-${relationshipId}`}>Delete draft record?</h2><p>This will remove this unsaved payment from the billing preview.</p><div className="welcome-modal-actions"><button className="btn-sm btn-sm-ghost" onClick={() => setPeriodDraftDeleteId("")} type="button">Cancel</button><button className="btn-sm btn-sm-danger" onClick={removePeriodDraft} type="button">Delete</button></div></section></div> : null}
    </div> : null}
  </section>;
}

export default function BillingHistoryPanel({ accounts, initialEntryMode, prefillCurrentBilling, onEstablishCurrentBilling, onSetupComplete, selectedBillingType, initialRelationshipId, onChangeRelationship, onClose, restoredDate, toolLogo, toolLogoBackground, toolName }: PanelProps) {
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
    <div className="billing-history-account-list">{accounts.map((account) => <AccountSection {...account} onEstablishCurrentBilling={account.relationshipId === initialRelationshipId ? onEstablishCurrentBilling : undefined} onSetupComplete={onSetupComplete} prefillCurrentBilling={account.relationshipId === initialRelationshipId && prefillCurrentBilling} selectedBillingType={account.relationshipId === initialRelationshipId ? selectedBillingType : undefined} initialEntryMode={account.relationshipId === initialRelationshipId ? initialEntryMode : undefined} isExpanded={expandedRelationshipIds.has(account.relationshipId)} key={account.relationshipId} onChangeRelationship={onChangeRelationship} onToggle={() => toggleRelationship(account.relationshipId)} restoredDate={account.relationshipId === initialRelationshipId ? restoredDate : undefined} toolLogo={toolLogo} toolLogoBackground={toolLogoBackground} toolName={toolName}/>)}</div>
  </aside></div>;
}
