import DateFieldControl from "@/components/DateFieldControl";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import type { BillingHistoryEntry } from "@/types/billingHistory";
import type { ReactNode } from "react";

export type PendingBillingAction = {
  accountLabel: string;
  entry: BillingHistoryEntry;
  recordKey: string;
  tool?: {
    name: string;
  };
};

type PendingBillingActionsPanelProps = {
  actions: PendingBillingAction[];
  displayToolName: (name: string) => string;
  onCancel: () => void;
  onConfirm: (action: PendingBillingAction) => void;
  onDateChange: (value: string) => void;
  onStartResolving: (entryId: string) => void;
  pendingResolutionDate: string;
  renderOutcomeDropdown: (action: PendingBillingAction) => ReactNode;
  resolvingPendingActionId: string;
};

export default function PendingBillingActionsPanel({
  actions,
  displayToolName,
  onCancel,
  onConfirm,
  onDateChange,
  onStartResolving,
  pendingResolutionDate,
  renderOutcomeDropdown,
  resolvingPendingActionId,
}: PendingBillingActionsPanelProps) {
  return (
    <section aria-label="Pending billing actions" className="pending-actions-panel">
      <div className="pending-actions-panel-heading">
        <strong>Pending actions</strong>
        <span>Confirm the outcome without changing the original Billing History entry.</span>
      </div>
      <div className="pending-actions-list">
        {actions.map((action) => {
          const { accountLabel, entry, recordKey, tool } = action;
          const isResolving = resolvingPendingActionId === entry.id;
          const toolName = displayToolName(tool?.name ?? "Tool");

          return (
            <article className="pending-action-row" key={`${recordKey}-${entry.id}`}>
              <div className="pending-action-copy">
                <div className="pending-action-title-row">
                  <strong>{entry.event === "Double Charged" ? "Double charged" : entry.event}</strong>
                  <span className="pending-action-status">Unresolved</span>
                </div>
                <span>
                  {toolName} · {accountLabel} · {billingHistoryDisplayDate(entry.date)} · Original entry stays unchanged
                </span>
              </div>
              {isResolving ? (
                <div className="pending-action-resolution">
                  {renderOutcomeDropdown(action)}
                  <DateFieldControl
                    ariaLabel={`Resolution date for ${toolName} ${accountLabel}`}
                    className="pending-action-date"
                    onChange={onDateChange}
                    value={pendingResolutionDate}
                  />
                  <button
                    className="btn-sm btn-sm-primary"
                    disabled={!pendingResolutionDate}
                    onClick={() => onConfirm(action)}
                    type="button"
                  >
                    Confirm
                  </button>
                  <button className="btn-sm btn-sm-ghost" onClick={onCancel} type="button">
                    Cancel
                  </button>
                </div>
              ) : (
                <button className="pending-action-resolve" onClick={() => onStartResolving(entry.id)} type="button">
                  Resolve
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
