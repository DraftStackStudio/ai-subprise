type AccountOverviewItem = {
  label: string;
  login: string;
  paidCount: number;
  tag: string;
  toolCount: number;
  trialCount: number;
  trialEndedCount: number;
};

type AccountsOverviewProps = {
  accounts: AccountOverviewItem[];
  onSelectAccount: (label: string) => void;
};

export default function AccountsOverview({ accounts, onSelectAccount }: AccountsOverviewProps) {
  return (
    <div className="accounts-overview-grid">
      {accounts.map((account) => (
        <button
          className="accounts-overview-card"
          key={account.label}
          onClick={() => onSelectAccount(account.label)}
          type="button"
        >
          <span className={`email-tag accounts-overview-name ${account.tag}`}>
            <span className="tag-dot" />
            {account.label}
          </span>
          <span className="accounts-overview-email">{account.login}</span>
          <strong className="accounts-overview-count">{account.toolCount}</strong>
          <span className="accounts-overview-count-label">tools linked</span>
          <span className="accounts-overview-badges">
            {account.paidCount > 0 ? (
              <span className="accounts-overview-badge is-paid">{account.paidCount} paid</span>
            ) : null}
            {account.trialCount > 0 ? (
              <span className="accounts-overview-badge is-trial">
                {account.trialCount} {account.trialCount === 1 ? "trial ending" : "trials ending"}
              </span>
            ) : null}
            {account.trialEndedCount > 0 ? (
              <span className="tool-status-chip status-trial-danger">
                {account.trialEndedCount} {account.trialEndedCount === 1 ? "trial ended" : "trials ended"}
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}
