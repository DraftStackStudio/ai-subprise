import { LinkedAccountCell } from "@/components/ToolRowRenderer";
import { Fragment } from "react";
import type { ManageStatus } from "@/types/toolDetail";

export type BillingDirectoryAccount = {
  accountEmail: string;
  accountLabel: string;
  accountTag: string;
  isHistorical: boolean;
  planName: string;
  relationshipId: string;
  status: ManageStatus;
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

const billingStatusGroups = ["Active", "Paused", "Goodbye"] as const;

export default function BillingDirectory({
  groups,
  isLoading,
  onClearSearch,
  onOpenAccount,
  onOpenTool,
  searchTerm,
}: BillingDirectoryProps) {
  const groupAccounts = (predicate: (account: BillingDirectoryAccount) => boolean) => groups
    .map((group) => ({ ...group, accounts: group.accounts.filter(predicate) }))
    .filter((group) => group.accounts.length > 0)
    .sort((left, right) => left.toolName.localeCompare(right.toolName));
  const groupedByStatus = [
    ...billingStatusGroups.map((status) => ({
      groups: groupAccounts((account) => !account.isHistorical && account.status === status),
      status,
    })),
    { groups: groupAccounts((account) => account.isHistorical), status: "History" },
  ];

  return <div className="account-table tool-database tool-database-linked tool-database-flat billing-directory">
    <div className="account-table-head tool-table-head billing-directory-head"><span /><span /><span>Tool Name</span><span>Account</span><span>Plan</span><span>Status</span></div>
    {isLoading ? <div className="empty-state tool-onboarding-empty"><strong>Loading billing</strong><span>Getting your billing relationships ready.</span></div>
      : groups.length ? groupedByStatus.map(({ groups: statusGroups, status }) => statusGroups.length ? <Fragment key={status}>
        <div className="tool-category-row-header">
          <span className="category-row-label">
            <span>{status}</span>
            <span>{statusGroups.reduce((count, group) => count + group.accounts.length, 0)}</span>
          </span>
        </div>
        {statusGroups.map((group) => <div className="billing-directory-group" key={`${status}-${group.toolId}`}>
          <button className="billing-directory-tool" onClick={() => onOpenTool(group.toolId)} type="button">
            <span className="tool-logo" style={{ background: group.logoBackground }}>{group.logo}</span><strong>{group.toolName}</strong>
          </button>
          <div className="billing-directory-accounts">
            {group.accounts.map((account) => <button className="billing-directory-account-row" key={account.relationshipId} onClick={() => onOpenAccount(group.toolId, account.relationshipId)} type="button">
              <span className="billing-directory-account-identity"><LinkedAccountCell accountLabel={account.accountLabel} login={account.accountEmail} tagClass={account.accountTag} /></span>
              <span className="billing-directory-plan">{account.planName ? <span className="tool-status-chip status-paid">{account.planName}</span> : <span className="muted-cell">Not set</span>}</span>
              <span className="billing-directory-status linked-expanded-status-cell"><span className="linked-status-readonly">{account.isHistorical ? "Historical" : account.status}</span></span>
            </button>)}
          </div>
        </div>)}
      </Fragment> : null) : <div className="empty-state tool-onboarding-empty">
        {searchTerm ? <><strong>{`No billing relationships match '${searchTerm}'`}</strong><button className="inline-text-link" onClick={onClearSearch} type="button">Clear search</button></>
          : <><strong>No billing relationships yet</strong><span>Paid accounts and accounts with payment history will appear here.</span></>}
      </div>}
  </div>;
}
