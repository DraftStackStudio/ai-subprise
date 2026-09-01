"use client";

import { useRef, useState } from "react";
import DateFieldControl from "@/components/DateFieldControl";
import { DropdownControl, MultiSelectDropdownControl, type DropdownOption } from "@/components/DropdownControls";
import type { BillingAmount, ManageStatus } from "@/types/toolDetail";
import type { SubscriptionRow } from "@/components/SubscriptionsView";
import { validSubscriptionBillingTypes } from "@/lib/subscriptions";

export type SubscriptionActions = {
  currencyOptions: DropdownOption[];
  onSaveBilling: (relationshipId: string, planName: string, components: BillingAmount[]) => Promise<void>;
  onSaveStatus: (relationshipId: string, status: ManageStatus) => Promise<void>;
  onPaymentsChanged?: () => void;
};

const types = ["Monthly", "Yearly", "Lifetime", "One-time", "Top-up"];
const label = (type: string) => type === "One-time" ? "One-time payment" : type === "Top-up" ? "Top-up credit" : type;

export default function SubscriptionBillingEditor({ account, currencyOptions, onSaveBilling, onClose }: SubscriptionActions & { account: SubscriptionRow; onClose: () => void }) {
  const [planName, setPlanName] = useState(account.planName);
  const [draft, setDraft] = useState<BillingAmount[]>(account.billingComponents.map((item) => ({ ...item, currency: item.currency.trim() ? item.currency : account.billingComponents.find((component) => component.currency.trim())?.currency ?? "" })));
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const defaultCurrency = useRef(account.billingComponents.find((item) => item.currency.trim())?.currency ?? "");
  const [error, setError] = useState("");
  const update = (index: number, patch: Partial<BillingAmount>) => {
    if (patch.currency?.trim()) defaultCurrency.current = patch.currency;
    setDraft((current) => current.map((item, i) => {
      const updated = i === index ? { ...item, ...patch } : item;
      // Either component updates peers sharing its previous currency.
      // Already-different currencies remain independent.
      const synchronized = !item.currency.trim() || item.currency === current[index].currency;
      return patch.currency?.trim() && synchronized ? { ...updated, currency: patch.currency } : updated;
    }));
  };
  const save = async () => {
    if (saving.current || !draft) return;
    saving.current = true; setBusy(true); setError(""); setOpen(null);
    try { await onSaveBilling(account.relationshipId, planName.trim(), draft); onClose(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save Current Billing."); }
    finally { saving.current = false; setBusy(false); }
  };
  return <form className="modal-form billing-current-editor subscription-billing-editor" onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <fieldset className="billing-current-fields" disabled={busy}>
      <label className="form-field"><span>Plan Name</span><input aria-label="Current Billing Plan Name" className="field-input" value={planName} placeholder="Not set" onChange={(event) => setPlanName(event.target.value)} /></label>
      <div className="form-field"><span>Billing Type</span>
        <MultiSelectDropdownControl ariaLabel="Billing Type" id="subscription-billing-types" isOpen={open === "types"} onOpenChange={(id) => setOpen(id ? "types" : null)}
          placeholder="Select billing type" values={draft.map((item) => item.billingType)}
          removableChips
          options={types.map((value) => ({ label: label(value), value, disabled: !draft.some((item) => item.billingType === value) && !validSubscriptionBillingTypes([...draft.map((item) => item.billingType), value]) }))}
          toggleSelection={(values, value) => values.includes(value) ? values.filter((item) => item !== value) : validSubscriptionBillingTypes([...values, value]) ? [...values, value] : values}
          onChange={(values) => {
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
    </fieldset>
    {error ? <small className="field-feedback error" role="alert">{error}</small> : null}
    <div className="welcome-modal-actions"><button className="btn-sm" disabled={busy} type="button" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy} type="submit">{busy ? "Saving…" : "Save changes"}</button></div>
  </form>;
}
