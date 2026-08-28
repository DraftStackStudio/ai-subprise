"use client";

import { useMemo, useState } from "react";
import { LinkedAccountCell } from "@/components/ToolRowRenderer";

export type BillingPastEntryRelationship = {
  accountEmail: string;
  accountLabel: string;
  accountTag: string;
  logo: string;
  logoBackground?: string;
  planName: string;
  relationshipId: string;
  toolId: string;
  toolName: string;
};

type BillingPastEntryModalProps = {
  relationships: BillingPastEntryRelationship[];
  onCancel: () => void;
  onContinue: (relationship: BillingPastEntryRelationship, mode: "single" | "period") => void;
};

export default function BillingPastEntryModal({ relationships, onCancel, onContinue }: BillingPastEntryModalProps) {
  const [mode, setMode] = useState<"single" | "period" | "">("");
  const [query, setQuery] = useState("");
  const [selectedRelationshipId, setSelectedRelationshipId] = useState("");
  const visibleRelationships = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return relationships;
    return relationships.filter((relationship) => [relationship.toolName, relationship.accountLabel, relationship.accountEmail, relationship.planName]
      .some((value) => value.toLowerCase().includes(search)));
  }, [query, relationships]);
  const selectedRelationship = relationships.find((relationship) => relationship.relationshipId === selectedRelationshipId);

  return <div className="welcome-modal-overlay billing-past-entry-overlay" onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }} role="presentation">
    <section aria-labelledby="billing-past-entry-title" aria-modal="true" className="welcome-modal billing-past-entry-modal" role="dialog">
      <div className="billing-past-modal-title-row"><h2 id="billing-past-entry-title">Add Past Billing</h2></div>
      <button aria-label="Close Add Past Billing" className="modal-close-button billing-past-entry-close" onClick={onCancel} type="button">×</button>
      <label className="form-field"><span>Tool / Account</span><span className="search-box billing-past-entry-search"><span className="search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg></span><input onChange={(event) => setQuery(event.target.value)} placeholder="Search paid tool or account" type="search" value={query}/></span></label>
      <div className="billing-past-relationship-list" role="listbox">
        {visibleRelationships.length ? visibleRelationships.map((relationship) => <button aria-selected={selectedRelationshipId === relationship.relationshipId} className={selectedRelationshipId === relationship.relationshipId ? "is-selected" : ""} key={relationship.relationshipId} onClick={() => setSelectedRelationshipId(relationship.relationshipId)} role="option" type="button">
          <span className="billing-past-entry-tool"><span className="tool-logo" style={{ background: relationship.logoBackground }}>{relationship.logo}</span><strong>{relationship.toolName}</strong></span>
          <LinkedAccountCell accountLabel={relationship.accountLabel} login={relationship.accountEmail} tagClass={relationship.accountTag}/>
          <span className="billing-directory-plan">{relationship.planName ? <span className="tool-status-chip status-paid">{relationship.planName}</span> : <span className="muted-cell">Not set</span>}</span>
          <span className="billing-past-entry-check" aria-hidden="true">{selectedRelationshipId === relationship.relationshipId ? "✓" : ""}</span>
        </button>) : <div className="billing-past-relationship-empty">No eligible Paid relationships match this search.</div>}
      </div>
      <h3 className="billing-past-entry-question">What would you like to add?</h3>
      <div className="billing-past-choice-grid billing-past-entry-choices">
        <button className={mode === "single" ? "is-selected" : ""} onClick={() => setMode("single")} type="button"><span className="billing-past-option-icon" aria-hidden="true"><svg fill="none" viewBox="0 0 20 20"><path d="M4 6.5h11.5A1.5 1.5 0 0 1 17 8v7H5.5A2.5 2.5 0 0 1 3 12.5v-8A1.5 1.5 0 0 1 4.5 3H15"/><circle cx="13.5" cy="11" fill="currentColor" r="1"/></svg></span><strong>Single Payment</strong><span>Record one previous payment, purchase or top-up.</span></button>
        <button className={mode === "period" ? "is-selected" : ""} onClick={() => setMode("period")} type="button"><span className="billing-past-option-icon" aria-hidden="true"><svg fill="none" viewBox="0 0 20 20"><rect height="13" rx="2" width="14" x="3" y="4"/><path d="M6 2v4M14 2v4M3 8h14"/><circle cx="10" cy="12" fill="currentColor" r="1.5"/></svg></span><strong>Subscription Period</strong><span>Add recurring monthly or yearly payments across a past period.</span></button>
      </div>
      <div className="welcome-modal-actions billing-past-modal-actions"><button className="btn-sm btn-sm-ghost" onClick={onCancel} type="button">Cancel</button><button className="btn-sm btn-sm-primary" disabled={!selectedRelationship || !mode} onClick={() => { if (selectedRelationship && mode) onContinue(selectedRelationship, mode); }} type="button">Continue</button></div>
    </section>
  </div>;
}
