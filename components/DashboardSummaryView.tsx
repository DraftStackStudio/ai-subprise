import type { ActionNeededItem } from "@/components/ActionNeededView";

type DashboardToolIdentity = {
  accountLabel: string;
  accountLogin?: string;
  accountTag: string;
  logo: string;
  logoBackground: string;
  toolId: string;
  toolName: string;
};

type TrialEndingItem = DashboardToolIdentity & { daysRemaining?: number; expiryDate: string; relationshipId: string };
type UpcomingRenewalItem = Pick<DashboardToolIdentity, "accountLabel" | "accountTag" | "toolName"> & {
  amount: string;
  date: string;
  relationshipId: string;
};

type DashboardSummaryViewProps = {
  actionNeededItems: ActionNeededItem[];
  connectedToolCount: number;
  onSeeUpcoming: (filter: "Renewals" | "Trials") => void;
  onViewAllActionNeeded: () => void;
  paidToolCount: number;
  toolCount: number;
  trialToolCount: number;
  trialsEndingSoon: TrialEndingItem[];
  upcomingRenewals: UpcomingRenewalItem[];
};

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function ToolAvatar({ item }: { item: DashboardToolIdentity }) {
  return <span className="tool-logo dashboard-tool-avatar" style={{ background: item.logoBackground }}>{item.logo}</span>;
}

function DashboardEmptyIcon() {
  return <span className="dashboard-empty-icon" aria-hidden="true"><svg className="billing-history-summary-icon" fill="none" viewBox="0 0 20 20"><rect height="13" rx="2" stroke="currentColor" width="14" x="3" y="4"/><path d="M6 2v4M14 2v4M3 8h14" stroke="currentColor"/></svg></span>;
}

function DateTile({ value }: { value: string }) {
  const date = new Date(`${value}T00:00:00`);
  const isValid = !Number.isNaN(date.getTime());
  const day = isValid ? date.toLocaleDateString("en-GB", { day: "2-digit" }) : "--";
  const month = isValid ? date.toLocaleDateString("en-GB", { month: "short" }).slice(0, 3).toUpperCase() : "---";
  return <span className="dashboard-date-tile" aria-label={isValid ? formatShortDate(value) : "Date not recorded"}><strong>{day}</strong><small>{month}</small></span>;
}

function DashboardListIdentity({ item }: { item: Pick<DashboardToolIdentity, "accountLabel" | "accountTag" | "toolName"> }) {
  return <div className="dashboard-list-identity"><strong>{item.toolName}</strong><span className="dashboard-account-neutral"><span className={`email-dot ${item.accountTag}`} />{item.accountLabel}</span></div>;
}

export default function DashboardSummaryView({ actionNeededItems, connectedToolCount, onSeeUpcoming, onViewAllActionNeeded, paidToolCount, toolCount, trialToolCount, trialsEndingSoon, upcomingRenewals }: DashboardSummaryViewProps) {
  const summaryCards = [
    { caption: "All AI tools", label: "Total AI tools", value: toolCount },
    { caption: "Tools with accounts", label: "Connected", value: connectedToolCount },
    { caption: "Paid plans", label: "Paid", value: paidToolCount },
    { caption: "Active trials", label: "Trial", value: trialToolCount },
  ];

  return (
    <section className="dashboard-overview" aria-label="Dashboard summary">
      <div className="dashboard-stats-grid">
        {summaryCards.map((card) => <article className="dashboard-stat-card" key={card.label}><div className="dashboard-stat-heading">{card.label}</div><strong className="dashboard-stat-value">{card.value}</strong><span className="dashboard-stat-caption">{card.caption}</span></article>)}
      </div>

      <section className="dashboard-panel dashboard-attention-panel" aria-labelledby="dashboard-attention-title">
        <header className="dashboard-panel-header"><div className="dashboard-panel-title"><span className="dashboard-attention-mark" aria-hidden="true">!</span><h3 id="dashboard-attention-title">Action needed</h3>{actionNeededItems.length > 0 ? <span className="dashboard-count-badge">{actionNeededItems.length}</span> : null}</div><button className="inline-text-link dashboard-view-all" onClick={onViewAllActionNeeded} type="button">View all</button></header>
        {actionNeededItems.length > 0 ? <div className="dashboard-compact-list">{actionNeededItems.slice(0, 4).map((item) => <div className="dashboard-compact-row" key={item.relationshipId}><ToolAvatar item={item} /><DashboardListIdentity item={item} /><span className="dashboard-row-detail">{item.detail}</span><span className="tool-status-chip status-trial-danger">{item.statusLabel}</span></div>)}</div> : <div className="dashboard-empty-copy"><strong>Nothing needs your attention.</strong><span>Trial reminders and confirmations will appear here.</span></div>}
      </section>

      <div className="dashboard-bottom-grid">
        <section className="dashboard-panel" aria-labelledby="dashboard-renewals-title"><header className="dashboard-panel-header"><h3 id="dashboard-renewals-title">Upcoming renewals</h3><button className="inline-text-link dashboard-view-all" onClick={() => onSeeUpcoming("Renewals")} type="button">See upcoming</button></header>{upcomingRenewals.length > 0 ? <div className="dashboard-compact-list">{upcomingRenewals.map((renewal) => <div className="dashboard-compact-row dashboard-renewal-row" key={`${renewal.relationshipId}-${renewal.date}`}><DateTile value={renewal.date} /><DashboardListIdentity item={renewal} /><span className="dashboard-renewal-amount">{renewal.amount}</span></div>)}</div> : <div className="dashboard-empty-copy dashboard-card-empty"><DashboardEmptyIcon /><strong>No upcoming renewals yet.</strong><span>Renewals will appear when scheduling data is available.</span></div>}</section>
        <section className="dashboard-panel" aria-labelledby="dashboard-trials-title"><header className="dashboard-panel-header"><h3 id="dashboard-trials-title">Trials</h3><button className="inline-text-link dashboard-view-all" onClick={() => onSeeUpcoming("Trials")} type="button">See upcoming</button></header>{trialsEndingSoon.length > 0 ? <div className="dashboard-compact-list">{trialsEndingSoon.slice(0, 4).map((trial) => <div className="dashboard-compact-row dashboard-trial-row" key={trial.relationshipId}><DateTile value={trial.expiryDate} /><DashboardListIdentity item={trial} />{typeof trial.daysRemaining === "number" ? <span className={`tool-status-chip ${trial.daysRemaining <= 3 ? "status-trial-danger" : "status-trial"}`}>{trial.daysRemaining === 0 ? "Ends today" : `${trial.daysRemaining} ${trial.daysRemaining === 1 ? "day" : "days"} left`}</span> : null}</div>)}</div> : <div className="dashboard-empty-copy dashboard-card-empty"><DashboardEmptyIcon /><strong>No trials ending soon.</strong><span>Active trial reminders will appear here.</span></div>}</section>
      </div>
    </section>
  );
}
