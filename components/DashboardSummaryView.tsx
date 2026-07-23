type TrialConfirmationItem = {
  accountLabel: string;
  toolId: string;
  toolName: string;
};

type TrialEndingItem = TrialConfirmationItem & {
  expiryDate: string;
};

type DashboardSummaryViewProps = {
  accountCount: number;
  paidToolCount: number;
  reminderDays: string;
  toolCount: number;
  trialToolCount: number;
  trialsEndingSoon: TrialEndingItem[];
  trialsNeedingConfirmation: TrialConfirmationItem[];
};

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardSummaryView({
  accountCount,
  paidToolCount,
  reminderDays,
  toolCount,
  trialToolCount,
  trialsEndingSoon,
  trialsNeedingConfirmation,
}: DashboardSummaryViewProps) {
  return (
    <section className="dashboard-overview" aria-label="Dashboard summary">
      {trialsNeedingConfirmation.length > 0 ? (
        <aside className="trial-alert-banner trial-confirmation-banner" aria-label="Trials needing status confirmation">
          <div>
            <strong>
              {trialsNeedingConfirmation.length}{" "}
              {trialsNeedingConfirmation.length === 1 ? "trial needs" : "trials need"} confirmation
            </strong>
            <span>Confirm whether each ended trial became Paid or was not continued.</span>
          </div>
          <div className="trial-alert-list">
            {trialsNeedingConfirmation.slice(0, 3).map((trial) => (
              <span key={`${trial.toolId}-${trial.accountLabel}`}>
                {trial.toolName} · {trial.accountLabel} · Confirm status
              </span>
            ))}
          </div>
        </aside>
      ) : null}
      {trialsEndingSoon.length > 0 ? (
        <aside className="trial-alert-banner" aria-label="Trials ending soon">
          <div>
            <strong>
              {trialsEndingSoon.length} {trialsEndingSoon.length === 1 ? "trial" : "trials"} ending soon
            </strong>
            <span>Review trial accounts that expire within {reminderDays} days.</span>
          </div>
          <div className="trial-alert-list">
            {trialsEndingSoon.slice(0, 3).map((trial) => (
              <span key={`${trial.toolId}-${trial.accountLabel}`}>
                {trial.toolName} · {trial.accountLabel} · {formatShortDate(trial.expiryDate)}
              </span>
            ))}
          </div>
        </aside>
      ) : null}
      <div className="stats-grid">
        <article className="stat-card accent">
          <div className="stat-icon">A</div>
          <div className="stat-value">{toolCount}</div>
          <div className="stat-label">Total AI tools</div>
        </article>
        <article className="stat-card">
          <div className="stat-icon">P</div>
          <div className="stat-value">{paidToolCount}</div>
          <div className="stat-label">Paid plans</div>
        </article>
        <article className="stat-card">
          <div className="stat-icon">T</div>
          <div className="stat-value">{trialToolCount}</div>
          <div className="stat-label">Active trials</div>
        </article>
        <article className="stat-card">
          <div className="stat-icon">E</div>
          <div className="stat-value">{accountCount}</div>
          <div className="stat-label">Accounts</div>
        </article>
      </div>
    </section>
  );
}
