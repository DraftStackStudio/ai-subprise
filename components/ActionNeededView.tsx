import { LinkedAccountCell } from "@/components/ToolRowRenderer";
import type { ReactNode } from "react";

export type ActionNeededItem = {
  accountLabel: string;
  accountLogin?: string;
  accountTag: string;
  detail: string;
  issue: string;
  issueDate: string;
  kind: "confirmation";
  logo: string;
  logoBackground: string;
  relationshipId: string;
  statusLabel: string;
  toolId: string;
  toolName: string;
};

type ActionNeededViewProps = {
  items: ActionNeededItem[];
  renderAction: (item: ActionNeededItem) => ReactNode;
};

function formatActionDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ActionNeededView({ items, renderAction }: ActionNeededViewProps) {
  return <section className="table-section">
    <div className="account-table tool-database tool-database-tools tool-database-tools-flat-view tool-database-flat action-needed-database">
      <div className="account-table-head tool-table-head"><span aria-hidden="true" /><span aria-hidden="true" /><span>Tool</span><span>Account</span><span>Issue</span><span>Date</span><span>Status</span><span>Action</span></div>
      {items.length > 0 ? items.map((item) => <div className="account-table-row tool-table-row linked-tool-row is-single-account" key={item.relationshipId}>
        <span aria-hidden="true" className="linked-select-cell" />
        <span aria-hidden="true" />
        <div className="linked-tool-name-cell" data-label="Tool"><div className="tool-name-cell"><div className="tool-logo" style={{ background: item.logoBackground }}>{item.logo}</div><div className="tool-name-copy"><span className="tool-name">{item.toolName}</span></div></div></div>
        <span className="action-needed-account-cell" data-label="Account"><LinkedAccountCell accountLabel={item.accountLabel} login={item.accountLogin} tagClass={item.accountTag} /></span>
        <span className="linked-expanded-plan-cell muted-cell" data-label="Issue">{item.issue}</span>
        <span className="linked-expanded-plan-cell muted-cell small-date" data-label="Date">{formatActionDate(item.issueDate)}</span>
        <span className="linked-expanded-plan-cell" data-label="Status"><span className="tool-status-chip status-trial-danger">{item.statusLabel}</span></span>
        <span className="linked-expanded-action-cell" data-label="Action">{renderAction(item)}</span>
      </div>) : <div className="empty-state tool-onboarding-empty"><strong>Nothing needs your attention.</strong><span>Items requiring confirmation will appear here.</span></div>}
    </div>
  </section>;
}
