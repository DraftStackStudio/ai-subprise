import { Fragment, useRef, useState } from "react";
import { DropdownControl } from "@/components/DropdownControls";
import type { DropdownOption } from "@/components/DropdownControls";
import type { SubscriptionRow } from "@/components/SubscriptionsView";
import type { BillingTransaction, BillingTransactionStatus, BillingTransactionType } from "@/types/billingTransaction";
import { createBillingTransaction, updateBillingTransaction } from "@/lib/supabase/billingTransactions";
import { subscriptionPaymentPrefill } from "@/lib/subscriptionPaymentPrefill";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import { validBillingDate } from "@/lib/currentBilling";

const types: BillingTransactionType[] = ["Monthly", "Yearly", "Lifetime", "One-time", "Top-up"];
type Draft = Pick<BillingTransaction, "paymentDate" | "planNameSnapshot" | "billingTypeSnapshot" | "currency" | "amount" | "status"> & { id?: string; sourceKey: string; relationshipId: string; syncCurrency: boolean };

export default function SubscriptionPayments({ account, canAdd, currencyOptions, onChanged }: {
  account: SubscriptionRow; canAdd: boolean; currencyOptions: DropdownOption[]; onChanged?: () => void;
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
  const clearDraft = (key: string) => {
    setDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
    setErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  };
  const add = () => {
    if (!canAdd || drafts.new) return;
    const prefill = subscriptionPaymentPrefill(account.billingComponents, "single");
    setDrafts((current) => ({ ...current, new: { relationshipId: account.relationshipId, sourceKey: `single-payment:${account.relationshipId}:${crypto.randomUUID()}`,
      planNameSnapshot: account.planName, billingTypeSnapshot: prefill?.billingType ?? "", currency: entryCurrency || prefill?.currency || "",
      amount: prefill?.amount ?? "", paymentDate: prefill?.paymentDate ?? "", status: "Paid", syncCurrency: true } }));
  };
  const save = async (key: string) => {
    const draft = drafts[key];
    if (!draft || saving.current.has(key)) return;
    const setError = (message: string) => setErrors((current) => ({ ...current, [key]: message }));
    setError("");
    if (!canAdd || draft.relationshipId !== account.relationshipId || (draft.id && !rows.some((row) => row.id === draft.id && row.source === "manual"))) {
      setError("This payment is no longer editable for this account."); return;
    }
    if (!validBillingDate(draft.paymentDate) || !types.includes(draft.billingTypeSnapshot as BillingTransactionType)
      || !/^[A-Z]{3}$/.test(draft.currency.trim()) || !/^\d+(\.\d+)?$/.test(draft.amount.trim())) {
      setError("Enter a valid payment date, billing type, three-letter currency and non-negative amount."); return;
    }
    saving.current.add(key); setBusyRows((current) => ({ ...current, [key]: true }));
    try {
      const { id, sourceKey, relationshipId, paymentDate, planNameSnapshot, billingTypeSnapshot, currency, amount, status } = draft;
      const values = { paymentDate, planNameSnapshot, billingTypeSnapshot, currency, amount, status };
      const result = id ? await updateBillingTransaction(id, values) : await createBillingTransaction({ ...values, relationshipId, sourceKey });
      setSaved((current) => [...current.filter((row) => row.id !== result.id), result]);
      clearDraft(key);
      onChanged?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save payment. Please retry."); }
    finally { saving.current.delete(key); setBusyRows((current) => ({ ...current, [key]: false })); }
  };
  const editor = (value: Draft) => {
    const key = value.id ?? "new";
    const busy = Boolean(busyRows[key]);
    const patch = (updates: Partial<Draft>) => {
      if (updates.currency) setEntryCurrency(updates.currency);
      setDrafts((current) => {
      if (!current[key]) return current;
      if (updates.currency) {
        const currency = updates.currency;
        return Object.fromEntries(Object.entries(current).map(([draftKey, draft]) => [draftKey, { ...draft, ...(draftKey === key ? updates : {}), ...(draftKey === key || draft.syncCurrency ? { currency } : {}) }]));
      }
      return { ...current, [key]: { ...current[key], ...updates } };
      });
    };
    return <Fragment key={key}><tr className="subscription-payment-edit-row" data-transaction-id={value.id} data-draft-key={key}>
    <td><input aria-label="Payment Date" className="field-input" type="date" disabled={busy} value={value.paymentDate} onChange={(event) => patch({ paymentDate: event.target.value })} /></td>
    <td><input aria-label="Plan Name" className="field-input" disabled={busy} value={value.planNameSnapshot} onChange={(event) => patch({ planNameSnapshot: event.target.value })} /></td>
    <td><fieldset className="subscription-payment-dropdown" disabled={busy}><DropdownControl ariaLabel="Billing Type" id={`payment-type-${key}`} isOpen={!busy && openDropdown === `payment-type-${key}`} onOpenChange={setOpenDropdown} value={value.billingTypeSnapshot} placeholder="Select billing type" options={types.map((type) => ({ value: type, label: type === "Top-up" ? "Top-up credit" : type === "One-time" ? "One-time payment" : type }))} onChange={(selected) => {
      const type = selected as BillingTransactionType;
      const prefill = !value.id ? subscriptionPaymentPrefill(account.billingComponents, "single", type) : null;
      patch({ billingTypeSnapshot: type, ...(!value.id ? { currency: entryCurrency || prefill?.currency || value.currency, amount: prefill?.amount ?? "", paymentDate: prefill?.paymentDate ?? "" } : {}) });
    }} /></fieldset></td>
    <td><div className="subscription-payment-amount-inputs"><fieldset className="subscription-payment-dropdown" disabled={busy}><DropdownControl ariaLabel="Currency" id={`payment-currency-${key}`} isOpen={!busy && openDropdown === `payment-currency-${key}`} onOpenChange={setOpenDropdown} value={value.currency} placeholder="Currency" options={currencyOptions} onChange={(currency) => patch({ currency })} /></fieldset><input aria-label="Amount" className="field-input" inputMode="decimal" disabled={busy} value={value.amount} onChange={(event) => patch({ amount: event.target.value })} /></div></td>
    <td><fieldset className="subscription-payment-dropdown" disabled={busy}><DropdownControl ariaLabel="Payment Status" id={`payment-status-${key}`} isOpen={!busy && openDropdown === `payment-status-${key}`} onOpenChange={setOpenDropdown} value={value.status} options={["Paid", "Pending", "Failed", "Refunded"].map((status) => ({ value: status, label: status }))} onChange={(status) => patch({ status: status as BillingTransactionStatus })} /></fieldset></td>
    <td><div className="subscription-payment-row-actions"><button className="btn-sm" disabled={busy} type="button" onClick={() => { if (!saving.current.has(key)) clearDraft(key); }}>Cancel</button><button className="btn-sm" disabled={busy} type="button" onClick={() => save(key)}>Save</button></div></td>
  </tr>{errors[key] ? <tr className="subscription-payment-feedback-row" data-error-key={key}><td colSpan={6}><small className="field-feedback error" role="alert">{errors[key]}</small></td></tr> : null}</Fragment>;
  };
  const cell = (payment: BillingTransaction, label: string, text: string) => <td>{payment.source === "manual" && canAdd
    ? <button className="subscription-payment-cell" type="button" aria-label={`Edit ${label}`} onClick={() => setDrafts((current) => current[payment.id] ? current : { ...current, [payment.id]: { ...payment, currency: payment.currency.trim() || entryCurrency, syncCurrency: !payment.currency.trim() } })}>{text}</button>
    : text}</td>;
  return <section className="subscription-account-section" aria-labelledby="subscription-payments">
    <div className="subscription-section-heading"><h3 id="subscription-payments">Payments</h3>{rows.length || drafts.new ? <div className="subscription-payment-add-area">
      <button className="btn-primary" disabled={!canAdd || Boolean(drafts.new)} type="button" onClick={add}>+ Add Payment</button>
      <small>{drafts.new ? "Complete the current row to add another." : ""}</small>
    </div> : null}</div>
    {rows.length || drafts.new ? <div className="subscription-payment-database"><table className="subscription-payment-table">
      <thead><tr>{["Date", "Plan", "Type", "Amount", "Status", "Action"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{drafts.new ? editor(drafts.new) : null}{rows.map((payment) => drafts[payment.id] ? editor(drafts[payment.id]) : <tr key={payment.id} data-transaction-id={payment.id}>
        {cell(payment, "Date", billingHistoryDisplayDate(payment.paymentDate))}{cell(payment, "Plan", payment.planNameSnapshot.trim() || "Not set")}{cell(payment, "Type", payment.billingTypeSnapshot || "Not set")}
        {cell(payment, "Currency/Amount", payment.currency.trim() && payment.amount.trim() ? `${payment.currency} ${payment.amount}` : "—")}{cell(payment, "Status", payment.status)}
        <td><span title={payment.source !== "manual" ? "Historical imported payments are read-only" : undefined}>—</span></td>
      </tr>)}</tbody>
    </table></div> : <div className="subscription-detail-empty subscription-setup-helper"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg><div><strong>No payments recorded yet.</strong><p>Add a payment to start building this account's payment history.</p></div><button className="btn-primary" disabled={!canAdd} type="button" onClick={add}>+ Add Payment</button></div>}
  </section>;
}
