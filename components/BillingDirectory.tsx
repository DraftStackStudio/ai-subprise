import { LinkedAccountCell } from "@/components/ToolRowRenderer";

export type BillingDirectoryAccount = {
  accountEmail: string;
  accountLabel: string;
  accountTag: string;
  planName: string;
  relationshipId: string;
  status: string;
};

export type BillingDirectoryGroup = {
  accounts: BillingDirectoryAccount[];
  logo: string;
  logoBackground?: string;
  toolId: string;
  toolName: string;
};

type BillingDirectoryProps = {
  groups: BillingDirectoryGroup[];
  isLoading: boolean;
  onClearSearch: () => void;
  onOpenAccount: (toolId: string, relationshipId: string) => void;
  onOpenTool: (toolId: string) => void;
  searchTerm: string;
};

export default function BillingDirectory({
  groups,
  isLoading,
  onClearSearch,
  onOpenAccount,
  onOpenTool,
  searchTerm,
}: BillingDirectoryProps) {
  return <div className="account-table tool-database tool-database-linked tool-database-flat billing-directory">
    <div className="account-table-head tool-table-head billing-directory-head"><span /><span /><span>Tool Name</span><span>Account</span><span>Plan</span><span>Status</span></div>
    {isLoading ? <div className="empty-state tool-onboarding-empty"><strong>Loading billing</strong><span>Getting your billing relationships ready.</span></div>
      : groups.length ? groups.map((group) => <div className="billing-directory-group" key={group.toolId}>
        <button className="billing-directory-tool" onClick={() => onOpenTool(group.toolId)} type="button">
          <span className="tool-logo" style={{ background: group.logoBackground }}>{group.logo}</span><strong>{group.toolName}</strong>
        </button>
        <div className="billing-directory-accounts">
          {group.accounts.map((account) => <button className="billing-directory-account-row" key={account.relationshipId} onClick={() => onOpenAccount(group.toolId, account.relationshipId)} type="button">
            <span className="billing-directory-account-identity"><LinkedAccountCell accountLabel={account.accountLabel} login={account.accountEmail} tagClass={account.accountTag} /></span>
            <span className="billing-directory-plan">{account.planName ? <span className="tool-status-chip status-paid">{account.planName}</span> : <span className="muted-cell">Not set</span>}</span>
            <span className="billing-directory-status linked-expanded-status-cell"><span className="linked-status-readonly">{account.status === "On a Break" ? "On a break" : account.status}</span></span>
          </button>)}
        </div>
      </div>) : <div className="empty-state tool-onboarding-empty">
        {searchTerm ? <><strong>{`No billing relationships match '${searchTerm}'`}</strong><button className="inline-text-link" onClick={onClearSearch} type="button">Clear search</button></>
          : <><strong>No billing relationships yet</strong><span>Paid accounts and accounts with payment history will appear here.</span></>}
      </div>}
  </div>;
}
