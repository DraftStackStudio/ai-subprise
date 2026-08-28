import type { ReactNode } from "react";
import type { BillingTransaction } from "@/types/billingTransaction";
import type { BillingAmount } from "@/types/toolDetail";
import type { BillingHistoryEntry } from "@/types/billingHistory";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import { LinkedAccountCell } from "@/components/ToolRowRenderer";

export type BillingDetailsAccount = {
  accountActivity: BillingHistoryEntry[];
  accountEmail: string;
  accountLabel: string;
  accountTag: string;
  billingAmounts: BillingAmount[];
  planName: string;
  relationshipId: string;
  status: string;
  transactions: BillingTransaction[];
};

type BillingDetailsViewProps = {
  accounts: BillingDetailsAccount[];
  onOpenBillingHistory: (relationshipId: string) => void;
  onSelectRelationship: (relationshipId: string | null) => void;
  selectedRelationshipId: string | null;
  toolName: string;
};

const componentType = (value: string) => value === "Top-up" ? "Top-up credit" : value;

function componentDate(component: BillingAmount) {
  if (component.billingType === "Top-up") return { label: "Last topped up", value: component.lastTopUpDate };
  if (component.billingType === "Lifetime" || component.billingType === "One-time") return { label: "Purchased on", value: component.purchaseDate };
  return { label: "Next renewal", value: component.nextRenewalDate };
}

function DetailsSection({ action, children, title }: { action?: ReactNode; children: ReactNode; title: string }) {
  return <section className="billing-details-section">
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
  });
  const activity = [...account.accountActivity].sort((first, second) => second.date.localeCompare(first.date));

  return <article className="billing-history-account-card billing-details-account">
    <header className="billing-details-account-header">
      <LinkedAccountCell accountLabel={account.accountLabel} login={account.accountEmail} nameSuffix={accountPlan ? <><span className="billing-details-account-separator"> · </span><span className="billing-details-account-plan">{accountPlan}</span></> : null} tagClass={account.accountTag} />
      <span className="billing-details-status"><span className={`tag-dot ${account.accountTag}`} aria-hidden="true" />{account.status}</span>
    </header>

    <div className="billing-details-account-body">
    <DetailsSection action={<button className="billing-details-primary-action" onClick={() => onOpenBillingHistory(account.relationshipId)} type="button">Open Billing History</button>} title="Payments">
      {account.transactions.length ? <div className="billing-details-payment-list">
        <div className="billing-details-payment-head"><span>Date</span><span>Plan</span><span>Type</span><span>Amount</span><span>Status</span></div>
        {account.transactions.map((transaction) => <div className="billing-details-payment-row" key={transaction.id}><span>{billingHistoryDisplayDate(transaction.paymentDate)}</span><span>{transaction.planNameSnapshot || "Not recorded"}</span><span>{transaction.billingTypeSnapshot || "Not recorded"}</span><span>{transaction.amount ? [transaction.currency, transaction.amount].filter(Boolean).join(" ") : "Not recorded"}</span><span>{transaction.status}</span></div>)}
      </div> : <div className="billing-details-empty"><strong>No payments recorded yet.</strong><span>Historical payments for this account will appear here.</span></div>}
    </DetailsSection>

    <DetailsSection title="Account Activity">
      {activity.length ? <div className="billing-details-activity-list">{activity.map((entry) => <div key={entry.id}><span><strong>{entry.event}</strong><small>{billingHistoryDisplayDate(entry.date)}</small></span><p>{entry.note || ""}</p></div>)}</div>
        : <div className="billing-details-empty"><strong>No account activity recorded yet.</strong><span>Persisted lifecycle changes will appear here.</span></div>}
    </DetailsSection>

    <DetailsSection title="Current Billing">
      {account.billingAmounts.length ? <div className="billing-history-components billing-details-components">{account.billingAmounts.map((component) => { const date = componentDate(component); return <div className="billing-history-component billing-details-component" key={component.id}><span className="billing-history-summary-cell"><span><small>Billing type</small><strong>{componentType(component.billingType)}</strong></span></span><span className="billing-history-summary-cell"><span><small>Amount</small><strong>{component.amount ? [component.currency, component.amount].filter(Boolean).join(" ") : "Not recorded"}</strong></span></span><span className="billing-history-summary-cell"><span><small>{date.label}</small><strong>{date.value ? billingHistoryDisplayDate(date.value) : "Not recorded"}</strong></span></span></div>; })}</div>
        : <div className="billing-details-empty billing-details-setup-empty"><strong>No billing set up yet.</strong><span>Add the current billing details for this account.</span><button disabled type="button">Set up billing</button></div>}
    </DetailsSection>

    <DetailsSection title="Upcoming">
      {upcoming.length ? <div className="billing-details-upcoming-list">{upcoming.map((component) => <div key={component.id}><strong>{componentType(component.billingType)}</strong><span>{component.nextRenewalDate ? billingHistoryDisplayDate(component.nextRenewalDate) : "Not recorded"}</span><small>{component.amount ? [component.currency, component.amount].filter(Boolean).join(" ") : "Amount not recorded"}</small></div>)}</div>
        : <div className="billing-details-empty"><strong>No upcoming billing recorded.</strong><span>Reliable future renewal dates will appear here.</span></div>}
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
      {accounts.map((account) => <button className={`category-view-tab${selectedRelationshipId === account.relationshipId ? " active" : ""}`} key={account.relationshipId} onClick={() => onSelectRelationship(account.relationshipId)} type="button">{account.accountLabel}{account.planName ? ` · ${account.planName}` : ""}</button>)}
    </div> : null}
    <div className="billing-details-account-list">{visibleAccounts.map((account) => <AccountDetails account={account} key={account.relationshipId} onOpenBillingHistory={onOpenBillingHistory} />)}</div>
  </div>;
}
