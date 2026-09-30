import type { ReactNode } from "react";
import type { BillingTransaction } from "@/types/billingTransaction";
import type { BillingAmount } from "@/types/toolDetail";
import type { BillingHistoryEntry } from "@/types/billingHistory";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import { LinkedAccountCell } from "@/components/ToolRowRenderer";
import type { BillingCurrentActions } from "@/components/BillingCurrentEditor";
import { billingRelationshipSelectorLabel } from "@/lib/billingRelationshipPresentation";
import { planPillTone } from "@/lib/planPresentation";

export type BillingDetailsAccount = {
  accountActivity: BillingHistoryEntry[];
  accountEmail: string;
  accountLabel: string;
  accountTag: string;
  billingAmounts: BillingAmount[];
  canEditCurrentBilling: boolean;
  isHistorical: boolean;
  plan: string;
  planName: string;
  relationshipId: string;
  status: string;
  transactions: BillingTransaction[];
};

type BillingDetailsViewProps = BillingCurrentActions & {
  accounts: BillingDetailsAccount[];
  onOpenBillingHistory: (relationshipId: string) => void;
  onSelectRelationship: (relationshipId: string | null) => void;
  selectedRelationshipId: string | null;
  toolName: string;
};

const componentType = (value: string) => value === "Top-up" ? "Top-up credit" : value;

function componentDate(component: BillingAmount, isHistorical = false) {
  if (component.billingType === "Top-up") return { label: "Last topped up", value: component.lastTopUpDate };
  if (component.billingType === "Lifetime" || component.billingType === "One-time") return { label: "Purchased on", value: component.purchaseDate };
  return { label: isHistorical ? "Last recorded renewal" : "Next renewal", value: component.nextRenewalDate };
}

function DetailsSection({ action, children, title, className = "" }: { action?: ReactNode; children: ReactNode; title: string; className?: string }) {
  return <section className={`billing-details-section ${className}`}>
    <div className="billing-details-section-heading">
      <h3>{title}</h3>
      {action}
    </div>
    {children}
  </section>;
}

function AccountDetails({ account, onOpenBillingHistory }: { account: BillingDetailsAccount; onOpenBillingHistory: (relationshipId: string) => void }) {
  const accountPlan = account.planName;
  const upcoming = account.billingAmounts.filter((component) => {
    if (component.billingType !== "Monthly" && component.billingType !== "Yearly") return false;
    return Boolean(component.nextRenewalDate && component.nextRenewalDate >= new Date().toISOString().slice(0, 10));
  }).map((component) => ({ id: component.id, date: component.nextRenewalDate!, billingType: componentType(component.billingType), amount: component.amount ? [component.currency, component.amount].filter(Boolean).join(" ") : "—" }));
  const activity = [...account.accountActivity].sort((first, second) => second.date.localeCompare(first.date));

  return <article className="billing-history-account-card billing-details-account">
    <header className="billing-details-account-header">
      <LinkedAccountCell accountLabel={account.accountLabel} login={account.accountEmail} nameSuffix={accountPlan ? <span className={`tool-status-chip current-plan-pill ${planPillTone(account.plan)}`}>{accountPlan}</span> : null} tagClass={account.accountTag} />
      {account.isHistorical ? <span className="billing-details-status">Historical</span> : <span className="tool-status-chip status-muted billing-details-status-pill">{account.status === "On a Break" ? "On a break" : account.status}</span>}
    </header>

    <div className="billing-details-account-body">
    <DetailsSection className="billing-details-current-section" title={account.isHistorical ? "Last Billing Setup" : "Current Billing"}>
      {account.billingAmounts.length ? <div className="billing-details-components">{account.billingAmounts.map((component) => { const date = componentDate(component, account.isHistorical); return <div className="billing-details-stat-row billing-details-current-row" key={component.id}><span className="billing-details-stat"><span><small>{date.label}</small><strong>{date.value ? billingHistoryDisplayDate(date.value) : "Not recorded"}</strong></span></span><span className="billing-details-stat"><span><small>Billing type</small><strong>{componentType(component.billingType)}</strong></span></span><span className="billing-details-stat"><span><small>Amount</small><strong>{component.amount ? [component.currency, component.amount].filter(Boolean).join(" ") : "—"}</strong></span></span></div>; })}</div>
        : <div className="billing-details-empty billing-details-setup-empty"><strong>{account.isHistorical ? "No billing setup was recorded." : "No billing set up yet."}</strong><span>{account.isHistorical ? "No saved billing setup is available for this historical relationship." : "Current billing details for this account will appear here."}</span></div>}
    </DetailsSection>

    {!account.isHistorical ? <DetailsSection title="Upcoming">
      {upcoming.length ? <div className="billing-details-upcoming-list">{upcoming.map((event) => <div className="billing-details-stat-row billing-details-upcoming-row" key={event.id}>
        <span className="billing-details-stat"><span><small>Date</small><strong>{billingHistoryDisplayDate(event.date)}</strong></span></span>
        <span className="billing-details-stat"><span><small>Billing type</small><strong>{event.billingType}</strong></span></span>
        <span className="billing-details-stat"><span><small>Amount</small><strong>{event.amount}</strong></span></span>
      </div>)}</div> : <div className="billing-details-empty"><strong>No upcoming billing recorded.</strong><span>Reliable future renewal dates will appear here.</span></div>}
    </DetailsSection> : null}

    <DetailsSection action={<button className="billing-details-primary-action" onClick={() => onOpenBillingHistory(account.relationshipId)} type="button">Open Billing History</button>} title="Payments">
      {account.transactions.length ? <div className="billing-details-payment-list"><table className="subscription-payment-table">
        <thead><tr>{["Date", "Plan", "Type", "Amount", "Status"].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>
        {account.transactions.map((transaction) => <tr key={transaction.id}><td>{billingHistoryDisplayDate(transaction.paymentDate)}</td><td>{transaction.planNameSnapshot || "Not recorded"}</td><td>{transaction.billingTypeSnapshot || "Not recorded"}</td><td>{transaction.amount ? [transaction.currency, transaction.amount].filter(Boolean).join(" ") : "—"}</td><td>{transaction.status}</td></tr>)}
      </tbody></table></div> : <div className="billing-details-empty"><strong>No payments recorded yet.</strong><span>Historical payments for this account will appear here.</span></div>}
    </DetailsSection>

    <DetailsSection title="Account Activity">
      {activity.length ? <div className="billing-details-activity-list">{activity.map((entry) => <div key={entry.id}><span><strong>{entry.event}</strong><small>{billingHistoryDisplayDate(entry.date)}</small></span><p>{entry.note || ""}</p></div>)}</div>
        : <div className="billing-details-empty"><strong>No account activity recorded yet.</strong><span>Persisted lifecycle changes will appear here.</span></div>}
    </DetailsSection>

    </div>
  </article>;
}

export default function BillingDetailsView({ accounts, onOpenBillingHistory, onSelectRelationship, selectedRelationshipId, toolName }: BillingDetailsViewProps) {
  const visibleAccounts = selectedRelationshipId ? accounts.filter((account) => account.relationshipId === selectedRelationshipId) : accounts;
  return <div className="billing-details-view">
    <header className="billing-details-header"><h2>{toolName}</h2><p>Billing Details</p></header>
    {accounts.length > 1 ? <div className="category-view-tab-list billing-details-account-selector" aria-label="Billing account view">
      <button className={`category-view-tab${!selectedRelationshipId ? " active" : ""}`} onClick={() => onSelectRelationship(null)} type="button">All accounts</button>
      {accounts.map((account) => <button className={`category-view-tab${selectedRelationshipId === account.relationshipId ? " active" : ""}`} key={account.relationshipId} onClick={() => onSelectRelationship(account.relationshipId)} type="button">{billingRelationshipSelectorLabel(account.accountLabel, account.planName, account.isHistorical)}</button>)}
    </div> : null}
    <div className="billing-details-account-list">{visibleAccounts.map((account) => <AccountDetails account={account} key={account.relationshipId} onOpenBillingHistory={onOpenBillingHistory} />)}</div>
  </div>;
}
