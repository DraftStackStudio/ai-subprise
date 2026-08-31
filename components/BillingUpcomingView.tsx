import { Fragment } from "react";
import { LinkedAccountCell } from "@/components/ToolRowRenderer";

export type BillingUpcomingItem = {
  accountEmail: string;
  accountLabel: string;
  accountTag: string;
  amount: string;
  date: string;
  event: "Renewal" | "Trial ends";
  logo: string;
  logoBackground?: string;
  relationshipId: string;
  toolId: string;
  toolName: string;
};

export type BillingUpcomingFilter = "All" | "Renewals" | "Trials";

type BillingUpcomingViewProps = {
  eventFilter: BillingUpcomingFilter;
  items: BillingUpcomingItem[];
};

const groupLabels = ["NEXT 7 DAYS", "THIS MONTH", "NEXT MONTH", "BEYOND NEXT MONTH"] as const;
type GroupLabel = (typeof groupLabels)[number];

function localDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function groupForDate(value: string, today: Date): GroupLabel {
  const date = localDate(value);
  if (!date) return "BEYOND NEXT MONTH";

  const dayDifference = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (dayDifference <= 7) return "NEXT 7 DAYS";
  if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth()) return "THIS MONTH";

  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  if (date.getFullYear() === nextMonth.getFullYear() && date.getMonth() === nextMonth.getMonth()) return "NEXT MONTH";
  return "BEYOND NEXT MONTH";
}

function formatDate(value: string) {
  const date = localDate(value);
  return date ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : value;
}

export default function BillingUpcomingView({ eventFilter, items }: BillingUpcomingViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const filteredItems = items.filter((item) =>
    eventFilter === "All" || (eventFilter === "Renewals" ? item.event === "Renewal" : item.event === "Trial ends")
  );
  const groups = groupLabels.map((label) => ({
    items: filteredItems
      .filter((item) => groupForDate(item.date, today) === label)
      .sort((left, right) => left.date.localeCompare(right.date)),
    label,
  }));

  return <div className="account-table tool-database tool-database-linked tool-database-flat billing-upcoming-database">
    <div className="account-table-head tool-table-head billing-upcoming-head"><span /><span /><span>Tool</span><span>Account</span><span>Event</span><span>Date</span><span>Amount</span></div>
    {filteredItems.length ? groups.map((group) => group.items.length ? <Fragment key={group.label}>
      <div className="tool-category-row-header">
        <span className="category-row-label"><span>{group.label}</span><span>{group.items.length}</span></span>
      </div>
      {group.items.map((item) => <div className="billing-upcoming-row" key={`${item.relationshipId}-${item.event}-${item.date}`}>
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span className="billing-upcoming-tool-cell" data-label="Tool"><span className="tool-logo" style={{ background: item.logoBackground }}>{item.logo}</span><strong>{item.toolName}</strong></span>
        <span className="billing-upcoming-account-cell" data-label="Account"><LinkedAccountCell accountLabel={item.accountLabel} login={item.accountEmail} tagClass={item.accountTag} /></span>
        <span data-label="Event">{item.event}</span>
        <span data-label="Date">{formatDate(item.date)}</span>
        <span data-label="Amount">{item.amount}</span>
      </div>)}
    </Fragment> : null) : <div className="empty-state tool-onboarding-empty"><strong>No upcoming billing events</strong><span>Future renewals and trial end dates will appear here.</span></div>}
  </div>;
}
