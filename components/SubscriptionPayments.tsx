import { Fragment, useRef, useState } from "react";
import { DropdownControl } from "@/components/DropdownControls";
import type { DropdownOption } from "@/components/DropdownControls";
import type { SubscriptionRow } from "@/components/SubscriptionsView";
import type { BillingTransaction, BillingTransactionStatus, BillingTransactionType } from "@/types/billingTransaction";
import { correctManualBillingTransaction, createBillingTransaction } from "@/lib/supabase/billingTransactions";
import { subscriptionPaymentPrefill } from "@/lib/subscriptionPaymentPrefill";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import { validBillingDate } from "@/lib/currentBilling";
import DateFieldControl from "@/components/DateFieldControl";
import PaymentBillingDifferenceChoiceField, { type PaymentBillingDifferenceChoice } from "@/components/PaymentBillingDifferenceChoice";
import type { BillingRenewalExactMutationResult, BillingRenewalPeriod, UpdateBillingRenewalPaymentInput } from "@/types/billingRenewalPeriod";

const types: BillingTransactionType[] = ["Monthly", "Yearly", "Lifetime", "One-time", "Top-up"];
const renewalTypes: BillingTransactionType[] = ["Monthly", "Yearly"];
export type { PaymentBillingDifferenceChoice } from "@/components/PaymentBillingDifferenceChoice";
type Draft = Pick<BillingTransaction, "paymentDate" | "planNameSnapshot" | "billingTypeSnapshot" | "currency" | "amount" | "status"> & {
  billingDifferenceChoice: PaymentBillingDifferenceChoice | "";
  id?: string;
  sourceKey: string;
  relationshipId: string;
  requestId: string;
  syncCurrency: boolean;
};

export default function SubscriptionPayments({ account, canAdd, currencyOptions, onChanged, onRequestCurrentBillingUpdate, onUpdateRenewalPayment }: {
  account: SubscriptionRow; canAdd: boolean; currencyOptions: DropdownOption[]; onChanged?: () => void;
  onRequestCurrentBillingUpdate?: (relationshipId: string, billingType: string, currency: string, amount: string, choice: Exclude<PaymentBillingDifferenceChoice, "unknown">) => void;
  onUpdateRenewalPayment?: (relationshipId: string, periodId: string, paymentTransactionId: string, input: UpdateBillingRenewalPaymentInput) => Promise<BillingRenewalExactMutationResult>;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyRows, setBusyRows] = useState<Record<string, boolean>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [entryCurrency, setEntryCurrency] = useState(
    account.billingComponents.find((component) => component.currency.trim())?.currency
      ?? account.payments.find((payment) => payment.source === "manual" && payment.relationshipId === account.relationshipId && payment.currency.trim())?.currency
      ?? "",
  );
  const saving = useRef(new Set<string>());
  const [saved, setSaved] = useState<BillingTransaction[]>([]);
  const rows = [...account.payments.filter((row) => !saved.some((item) => item.id === row.id)), ...saved]
    .filter((row) => row.relationshipId === account.relationshipId)
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || a.id.localeCompare(b.id));
  const linkedRenewalPeriod = (payment: BillingTransaction): BillingRenewalPeriod | null => {
    if (payment.source !== "renewal" || payment.relationshipId !== account.relationshipId) return null;
    const matches = account.renewalPeriods.filter((period) => period.relationshipId === account.relationshipId
      && period.resolution === "paid"
      && period.paymentTransactionId === payment.id
      && !period.excludedAt);
    return matches.length === 1 ? matches[0] : null;
  };
  const clearDraft = (key: string) => {
    setDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  };
  const add = () => {
    if (!canAdd || drafts.new) return;
    const prefill = subscriptionPaymentPrefill(account.billingComponents, "single");
    setDrafts((current) => ({ ...current, new: { relationshipId: account.relationshipId, requestId: crypto.randomUUID(), sourceKey: `single-payment:${account.relationshipId}:${crypto.randomUUID()}`,
      planNameSnapshot: account.planName, billingTypeSnapshot: prefill?.billingType ?? "", currency: entryCurrency || prefill?.currency || "",
      amount: prefill?.amount ?? "", billingDifferenceChoice: "", paymentDate: prefill?.paymentDate ?? "", status: "Paid", syncCurrency: true } }));
  };
  const save = async (key: string) => {
    const draft = drafts[key];
    if (!draft || saving.current.has(key)) return;
    const setError = (message: string) => setErrors((current) => ({ ...current, [key]: message }));
    setError("");
    const originalPayment = draft.id ? rows.find((row) => row.id === draft.id && row.relationshipId === account.relationshipId) : undefined;
    const renewalPeriod = originalPayment?.source === "renewal" ? linkedRenewalPeriod(originalPayment) : null;
    if (!canAdd || draft.relationshipId !== account.relationshipId || (draft.id && (!originalPayment || !["manual", "renewal"].includes(originalPayment.source)))) {
      setError("This payment is no longer editable for this account."); return;
    }
    if (originalPayment?.source === "renewal" && (!onUpdateRenewalPayment || !renewalPeriod)) {
      setError("This renewal payment is no longer linked to one exact paid billing period."); return;
    }
    if (originalPayment?.source === "renewal" && draft.status !== originalPayment.status) {
      setError("Payment status is read-only for renewal payments."); return;
    }
    if (originalPayment?.source === "renewal" && !renewalTypes.includes(draft.billingTypeSnapshot as BillingTransactionType)) {
      setError("Renewal payments can only use Monthly or Yearly billing type."); return;
    }
    if (!validBillingDate(draft.paymentDate) || !types.includes(draft.billingTypeSnapshot as BillingTransactionType)
      || !/^[A-Z]{3}$/.test(draft.currency.trim()) || (draft.amount.trim() && !/^\d+(\.\d+)?$/.test(draft.amount.trim()))) {
      setError("Enter a valid payment date, billing type, three-letter currency and non-negative amount."); return;
    }
    const hasMatchingCurrentComponent = account.billingComponents.some((component) => component.billingType === draft.billingTypeSnapshot);
    const requiresBillingDecision = Boolean(draft.id && onRequestCurrentBillingUpdate && originalPayment?.source === "manual"
      && draft.amount !== originalPayment.amount && hasMatchingCurrentComponent);
    if (requiresBillingDecision && !draft.billingDifferenceChoice) {
      setError("Choose why this payment amount differs from Current Billing."); return;
    }
    if (originalPayment?.source === "renewal" && draft.paymentDate === originalPayment.paymentDate
      && draft.planNameSnapshot === originalPayment.planNameSnapshot
      && draft.billingTypeSnapshot === originalPayment.billingTypeSnapshot
      && draft.currency === originalPayment.currency && draft.amount === originalPayment.amount) {
      clearDraft(key); return;
    }
    saving.current.add(key); setBusyRows((current) => ({ ...current, [key]: true }));
    try {
      const { id, requestId, sourceKey, relationshipId, paymentDate, planNameSnapshot, billingTypeSnapshot, currency, amount, status } = draft;
      if (id && originalPayment?.source === "renewal" && renewalPeriod && onUpdateRenewalPayment) {
        await onUpdateRenewalPayment(relationshipId, renewalPeriod.id, id, {
          amount,
          billingType: billingTypeSnapshot as "Monthly" | "Yearly",
          currency,
          expectedUpdatedAt: originalPayment.updatedAt,
          paymentDate,
          planName: planNameSnapshot,
          requestId,
        });
        clearDraft(key);
        return;
      }
      const values = { paymentDate, planNameSnapshot, billingTypeSnapshot, currency, amount, status };
      const result = id && originalPayment
        ? await correctManualBillingTransaction(originalPayment, values, requestId)
        : await createBillingTransaction({ ...values, relationshipId, sourceKey });
      setSaved((current) => [...current.filter((row) => row.id !== result.id), result]);
      clearDraft(key);
      onChanged?.();
      const billingChoice = draft.billingDifferenceChoice;
      if (requiresBillingDecision && (billingChoice === "correction" || billingChoice === "change")) {
        onRequestCurrentBillingUpdate?.(relationshipId, billingTypeSnapshot, currency, amount, billingChoice);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save payment. Please retry."); }
    finally { saving.current.delete(key); setBusyRows((current) => ({ ...current, [key]: false })); }
  };
  const editor = (value: Draft) => {
    const key = value.id ?? "new";
    const busy = Boolean(busyRows[key]);
    const originalPayment = value.id ? rows.find((row) => row.id === value.id) : undefined;
    const isRenewal = originalPayment?.source === "renewal";
    const matchingCurrentComponent = value.id ? account.billingComponents.find((component) => component.billingType === value.billingTypeSnapshot) : undefined;
    const needsBillingDecision = Boolean(onRequestCurrentBillingUpdate && matchingCurrentComponent
      && originalPayment?.source === "manual" && value.amount !== originalPayment.amount);
    const patch = (updates: Partial<Draft>) => {
      if (updates.currency) setEntryCurrency(updates.currency);
      setDrafts((current) => {
      if (!current[key]) return current;
      if (isRenewal) return { ...current, [key]: { ...current[key], ...updates } };
      if (updates.currency) {
        const currency = updates.currency;
        return Object.fromEntries(Object.entries(current).map(([draftKey, draft]) => [draftKey, { ...draft, ...(draftKey === key ? updates : {}), ...(draftKey === key || draft.syncCurrency ? { currency } : {}) }]));
      }
      return { ...current, [key]: { ...current[key], ...updates } };
      });
    };
    return <Fragment key={key}><tr className="subscription-payment-edit-row" data-transaction-id={value.id} data-draft-key={key}>
    <td><DateFieldControl ariaLabel="Payment Date" className="field-input" disabled={busy} value={value.paymentDate} onChange={(paymentDate) => patch({ paymentDate })} /></td>
    <td><input aria-label="Plan Name" className="field-input" disabled={busy} value={value.planNameSnapshot} onChange={(event) => patch({ planNameSnapshot: event.target.value })} /></td>
    <td><fieldset className="subscription-payment-dropdown" disabled={busy}><DropdownControl ariaLabel="Billing Type" id={`payment-type-${key}`} isOpen={!busy && openDropdown === `payment-type-${key}`} onOpenChange={setOpenDropdown} value={value.billingTypeSnapshot} placeholder="Select billing type" options={(isRenewal ? renewalTypes : types).map((type) => ({ value: type, label: type === "Top-up" ? "Top-up credit" : type === "One-time" ? "One-time payment" : type }))} onChange={(selected) => {
      const type = selected as BillingTransactionType;
      const prefill = !value.id ? subscriptionPaymentPrefill(account.billingComponents, "single", type) : null;
      patch({ billingDifferenceChoice: "", billingTypeSnapshot: type, ...(!value.id ? { currency: entryCurrency || prefill?.currency || value.currency, amount: prefill?.amount ?? "", paymentDate: prefill?.paymentDate ?? "" } : {}) });
    }} /></fieldset></td>
    <td><div className="subscription-payment-amount-inputs"><fieldset className="subscription-payment-dropdown" disabled={busy}><DropdownControl ariaLabel="Currency" id={`payment-currency-${key}`} isOpen={!busy && openDropdown === `payment-currency-${key}`} onOpenChange={setOpenDropdown} value={value.currency} placeholder="Currency" options={currencyOptions} onChange={(currency) => patch({ billingDifferenceChoice: "", currency })} /></fieldset><input aria-label="Amount" className="field-input" inputMode="decimal" disabled={busy} value={value.amount} onChange={(event) => patch({ amount: event.target.value, billingDifferenceChoice: "" })} /></div></td>
    <td><fieldset className="subscription-payment-dropdown" disabled={busy || isRenewal}><DropdownControl ariaLabel="Payment Status" id={`payment-status-${key}`} isOpen={!busy && !isRenewal && openDropdown === `payment-status-${key}`} onOpenChange={setOpenDropdown} value={value.status} options={["Paid", "Pending", "Failed", "Refunded"].map((status) => ({ value: status, label: status }))} onChange={(status) => patch({ status: status as BillingTransactionStatus })} /></fieldset></td>
    <td><div className="subscription-payment-row-actions"><button className="btn-sm" disabled={busy} type="button" onClick={() => { if (!saving.current.has(key)) clearDraft(key); }}>Cancel</button><button className="btn-sm" disabled={busy} type="button" onClick={() => save(key)}>Save</button></div></td>
  </tr>{needsBillingDecision ? <tr className="subscription-payment-sync-row"><td colSpan={6}><PaymentBillingDifferenceChoiceField disabled={busy} onChange={(billingDifferenceChoice) => patch({ billingDifferenceChoice })} value={value.billingDifferenceChoice} /></td></tr> : null}{errors[key] ? <tr className="subscription-payment-feedback-row" data-error-key={key}><td colSpan={6}><small className="field-feedback error" role="alert">{errors[key]}</small></td></tr> : null}</Fragment>;
  };
  const beginEdit = (payment: BillingTransaction) => {
    const renewalPeriod = linkedRenewalPeriod(payment);
    if (!canAdd || (payment.source !== "manual" && !(payment.source === "renewal" && renewalPeriod && onUpdateRenewalPayment))) return;
    setDrafts((current) => current[payment.id] ? current : { ...current, [payment.id]: { ...payment, billingDifferenceChoice: "", currency: payment.currency.trim() || entryCurrency, requestId: crypto.randomUUID(), syncCurrency: payment.source === "manual" && !payment.currency.trim() } });
  };
  const cell = (text: string) => <td>{text}</td>;
  return <section className="subscription-account-section" aria-labelledby="subscription-payments">
    <div className="subscription-section-heading"><h3 id="subscription-payments">Payments</h3>{rows.length || drafts.new ? <div className="subscription-payment-add-area">
      <button className="btn-primary" disabled={!canAdd || Boolean(drafts.new)} type="button" onClick={add}>+ Add Payment</button>
      <small>{drafts.new ? "Complete the current row to add another." : ""}</small>
    </div> : null}</div>
    {rows.length || drafts.new ? <div className="subscription-payment-database"><table className="subscription-payment-table">
      <thead><tr>{["Date", "Plan", "Type", "Amount", "Status", "Action"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{drafts.new ? editor(drafts.new) : null}{rows.map((payment) => {
        const canEditRenewal = payment.source === "renewal" && Boolean(onUpdateRenewalPayment) && Boolean(linkedRenewalPeriod(payment));
        const canEditPayment = canAdd && (payment.source === "manual" || canEditRenewal);
        return drafts[payment.id] ? editor(drafts[payment.id]) : <tr key={payment.id} data-transaction-id={payment.id}>
        {cell(billingHistoryDisplayDate(payment.paymentDate))}{cell(payment.planNameSnapshot.trim() || "Not set")}{cell(payment.billingTypeSnapshot || "Not set")}
        {cell(payment.currency.trim() && payment.amount.trim() ? `${payment.currency} ${payment.amount}` : "—")}{cell(payment.status)}
        <td>{canEditPayment ? <button aria-label={`Edit ${billingHistoryDisplayDate(payment.paymentDate)} payment`} className="subscription-payment-edit-button" onClick={() => beginEdit(payment)} title="Edit payment" type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 4.25-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.25 16 4 20Z"/><path d="m14.5 7.5 3 3"/></svg></button> : <span title={payment.source === "renewal" ? "The linked renewal period is unavailable" : payment.source !== "manual" ? "Historical imported payments are read-only" : undefined}>—</span>}</td>
      </tr>})}</tbody>
    </table></div> : <div className="subscription-detail-empty subscription-setup-helper"><div className="subscription-payment-empty-copy"><div className="subscription-payment-empty-heading"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg><strong>No payments recorded yet.</strong></div><p>Add a payment to start building this account's payment history.</p></div><button className="btn-primary" disabled={!canAdd} type="button" onClick={add}>+ Add Payment</button></div>}
  </section>;
}
