"use client";

import { Fragment, useState } from "react";
import { DropdownControl } from "@/components/DropdownControls";
import { LinkedAccountCell } from "@/components/ToolRowRenderer";
import type { SubscriptionState } from "@/lib/subscriptions";
import SubscriptionAccountView from "@/components/SubscriptionAccountView";
import type { BillingAmount } from "@/types/toolDetail";
import type { BillingTransaction } from "@/types/billingTransaction";
import type { BillingHistoryEntry } from "@/types/billingHistory";
import type { SubscriptionActions } from "@/components/SubscriptionBillingEditor";

export type SubscriptionRow = {
  relationshipId: string;
  canManageBilling: boolean;
  toolId: string;
  toolName: string;
  logo: string;
  logoBackground: string;
  accountLabel: string;
  accountEmail: string;
  accountTag: string;
  plan: string;
  status: string;
  billing: string[];
  state: SubscriptionState;
  planName: string;
  billingComponents: BillingAmount[];
  payments: BillingTransaction[];
  activity: BillingHistoryEntry[];
};

const statuses = ["Active", "On a Break", "Goodbye"];
const states = ["All", "Not started", "Incomplete", "Complete"] as const;

export default function SubscriptionsView({ rows, isLoading, ...actions }: SubscriptionActions & { rows: SubscriptionRow[]; isLoading: boolean }) {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<(typeof states)[number]>("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedRelationshipId, setSelectedRelationshipId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const toggleGroup = (key: string) => setExpandedGroups((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const selected = rows.find((row) => row.relationshipId === selectedRelationshipId);
  const visible = rows.filter((row) => (stateFilter === "All" || row.state === stateFilter)
    && [row.toolName, row.accountLabel, row.accountEmail, row.plan].some((value) => value.toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a, b) => a.toolName.localeCompare(b.toolName) || a.accountLabel.localeCompare(b.accountLabel));

  if (selectedRelationshipId) return <section className="table-section" data-relationship-id={selectedRelationshipId}>
    <button aria-label="Back to Subscriptions" className="btn-sm btn-sm-ghost" onClick={() => setSelectedRelationshipId(null)} type="button">← Back</button>
    {selected ? <SubscriptionAccountView key={selected.relationshipId} account={selected} {...actions} />
      : <div className="empty-state"><strong>This linked account is no longer available.</strong></div>}
  </section>;

  return <section className="table-section">
    <div className="category-view-action-row subscriptions-toolbar">
      <DropdownControl ariaLabel="Filter subscriptions by state" className="linked-plan-filter" id="subscriptions-state" isOpen={filterOpen} onOpenChange={(id) => setFilterOpen(Boolean(id))} onChange={(value) => setStateFilter(value as typeof stateFilter)} options={states.map((value) => ({ label: `State: ${value}`, value }))} value={stateFilter} />
      <label className="search-box"><span className="search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg></span><input aria-label="Search subscriptions" onChange={(event) => setQuery(event.target.value)} placeholder="search tool" type="search" value={query} /></label>
    </div>
    <div className="account-table tool-database tool-database-linked tool-database-flat subscriptions-database">
      <div className="account-table-head subscriptions-head"><span /><span /><span>Tool Name</span><span>Account</span><span>Plan</span><span>Billing</span><span>State</span><span>Action</span></div>
      {isLoading ? <div className="empty-state"><strong>Loading subscriptions</strong></div> : visible.length ? statuses.map((status) => {
        const group = visible.filter((row) => row.status === status);
        return group.length ? <Fragment key={status}>
          <div className="tool-category-row-header"><span className="category-row-label"><span>{status === "On a Break" ? "On a break" : status}</span><span>{group.length}</span></span></div>
          {[...new Set(group.map((row) => row.toolId))].map((toolId) => {
            const accounts = group.filter((row) => row.toolId === toolId);
            const tool = accounts[0];
            const groupKey = `${status}-${toolId}`;
            const multiple = accounts.length > 1;
            const expanded = expandedGroups.includes(groupKey);
            return <Fragment key={groupKey}>
              {multiple ? <div className="subscriptions-row subscriptions-parent-row" onClick={() => toggleGroup(groupKey)}>
                <span aria-hidden="true" /><span aria-hidden="true" />
                <span className="linked-tool-name-cell" title={tool.toolName}><span className="tool-logo" style={{ background: tool.logoBackground }}>{tool.logo}</span><strong>{tool.toolName}</strong></span>
                <span className="linked-account-summary-cell"><span className="linked-account-count-pill">{accounts.length} accounts</span><button aria-label={`${expanded ? "Collapse" : "Expand"} ${tool.toolName} ${status} accounts`} aria-expanded={expanded} className={`row-toggle-control linked-row-toggle${expanded ? " is-open" : ""}`} onClick={(event) => { event.stopPropagation(); toggleGroup(groupKey); }} type="button"><span /></button></span>
                <span /><span /><span /><span />
              </div> : null}
          {(!multiple || expanded) ? accounts.map((row) => <div className={`subscriptions-row${multiple ? " subscriptions-child-row" : ""}`} key={row.relationshipId} data-relationship-id={row.relationshipId}>
            <span aria-hidden="true" /><span aria-hidden="true" />
            {multiple ? <span aria-hidden="true" /> : <span className="linked-tool-name-cell" title={row.toolName}><span className="tool-logo" style={{ background: row.logoBackground }}>{row.logo}</span><strong>{row.toolName}</strong></span>}
            <span><LinkedAccountCell accountLabel={row.accountLabel} login={row.accountEmail} tagClass={row.accountTag} /></span>
            <span title={row.plan}><span className="tool-status-chip">{row.plan}</span></span>
            <span className="subscriptions-billing" title={row.billing.join(" + ") || "Not set"}><span>{row.billing[0] || "Not set"}</span>{row.billing.length > 1 ? <small>+ {row.billing.slice(1).join(" + ")}</small> : null}</span>
            <span><span className={`subscription-state-label state-${row.state.toLowerCase().replace(" ", "-")}`}>{row.state}</span></span>
            <span><button className="linked-text-action" onClick={() => setSelectedRelationshipId(row.relationshipId)} type="button">View</button></span>
          </div>) : null}
            </Fragment>;
          })}
        </Fragment> : null;
      }) : <div className="empty-state subscriptions-empty-state"><strong>{rows.length ? "No subscriptions match your filters." : "No linked accounts yet."}</strong></div>}
    </div>
  </section>;
}
