"use client";

import { useState } from "react";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import {
  accountActivityRecordedDateValue,
  buildAccountActivityReadModel,
  type AccountActivityItem,
  type BuildAccountActivityInput,
} from "@/lib/accountActivity";

type AccountActivityTableProps = BuildAccountActivityInput & {
  emptyMessage?: string;
};

function recordedValue(item: AccountActivityItem) {
  const value = accountActivityRecordedDateValue(item);
  if (value === "—" || value === "Not recorded") return "—";
  return billingHistoryDisplayDate(value);
}

function correctionRegionId(item: AccountActivityItem) {
  return `account-activity-correction-${item.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export default function AccountActivityTable({ emptyMessage = "No recorded account activity for this account.", ...input }: AccountActivityTableProps) {
  const [expandedCorrections, setExpandedCorrections] = useState<Set<string>>(() => new Set());
  const groups = buildAccountActivityReadModel(input);
  const toggleCorrection = (id: string) => setExpandedCorrections((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  if (!groups.length) return <p className="account-activity-empty">{emptyMessage}</p>;

  return <div className="account-activity-table-frame">
    <table className="account-activity-table">
      <colgroup><col className="account-activity-effective-column"/><col/><col className="account-activity-recorded-column"/></colgroup>
      <thead><tr><th scope="col">Effective date</th><th scope="col">Activity</th><th scope="col">Recorded date</th></tr></thead>
      <tbody>{groups.map((group) => <tr key={group.effectiveDate}>
        <td className="account-activity-effective-date" data-label="Effective date">{billingHistoryDisplayDate(group.effectiveDate)}</td>
        <td className="account-activity-group-cell" colSpan={2}>{group.items.map((item) => {
          const expanded = expandedCorrections.has(item.id);
          const correctionId = correctionRegionId(item);
          return <div className="account-activity-entry" data-event-id={item.id} key={item.id}>
            <div className="account-activity-copy">
              <strong>{item.title}</strong>
              {item.details.length ? <p>{item.details.join(" · ")}</p> : null}
              {item.note ? <p className="account-activity-note">{item.note}</p> : null}
              {item.explanation ? <p className="account-activity-note">{item.explanation}</p> : null}
              {item.correctionDetails?.length ? <>
                <button aria-controls={correctionId} aria-expanded={expanded} className="account-activity-correction-toggle" onClick={() => toggleCorrection(item.id)} type="button">{expanded ? "Hide correction details" : "View correction details"}</button>
                {expanded ? <div className="account-activity-correction-details" id={correctionId}>
                  {item.correctionDetails.map((detail, index) => <div key={`${detail.field}-${index}`}><strong>{detail.label}</strong><span>{detail.before}</span><span aria-hidden="true">→</span><span>{detail.after}</span></div>)}
                </div> : null}
              </> : null}
            </div>
            <div className="account-activity-recorded-date"><span>Recorded date</span>{recordedValue(item)}</div>
          </div>;
        })}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
