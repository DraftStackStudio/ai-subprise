"use client";

import {
  billingHistoryDisplayAmount,
  billingHistoryDisplayDate,
} from "@/lib/billingHistory";
import type {
  BillingHistoryEntry,
  BillingHistorySection,
  BillingHistoryTarget,
} from "@/types/billingHistory";

type BillingHistoryPanelProps = {
  historyEntries: BillingHistorySection[];
  onClose: () => void;
  onUpdateNote: (recordKey: string, entry: BillingHistoryEntry, note: string) => void;
  selectedToolAccount: BillingHistoryTarget;
  toolName: string;
};

export default function BillingHistoryPanel({
  historyEntries,
  onClose,
  onUpdateNote,
  selectedToolAccount,
  toolName,
}: BillingHistoryPanelProps) {
  return (
    <div
      className="billing-history-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <aside
        aria-label="Billing History"
        className="billing-history-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="billing-history-panel-actions">
          <button
            aria-label="Close billing history"
            className="modal-close-button"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>
        <h2 className="billing-history-heading">Billing History</h2>
        <h3 className="billing-history-tool-heading">{toolName}</h3>
        <div className="billing-history-sections">
          {historyEntries.map((section) => {
            const recordKey = `${selectedToolAccount.toolId}::${section.accountLabel}`;
            return (
              <section className="billing-history-account-section" key={section.accountLabel}>
                <p className="billing-history-account-context">
                  {section.accountLabel}{section.planName ? ` · ${section.planName}` : ""}
                </p>
                <div className="billing-history-table-wrap">
                  <table className="billing-history-table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Plan Name</th>
                        <th scope="col">Billing Type</th>
                        <th scope="col">Status</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.entries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{billingHistoryDisplayDate(entry.date)}</td>
                          <td>{entry.planName || section.planName || "—"}</td>
                          <td>{entry.billingType || "—"}</td>
                          <td>{entry.event}</td>
                          <td>{billingHistoryDisplayAmount(entry)}</td>
                          <td>
                            <span className="billing-history-note-editor">
                              <input
                                aria-label={`Note for ${entry.event}`}
                                className="billing-history-note-input"
                                onChange={(event) => onUpdateNote(recordKey, entry, event.target.value)}
                                placeholder="Add note"
                                type="text"
                                value={entry.note ?? ""}
                              />
                            </span>
                          </td>
                        </tr>
                      ))}
                      {section.entries.length === 0 ? (
                        <tr><td className="billing-history-empty" colSpan={6}>No billing history yet.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
