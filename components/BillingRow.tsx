import { LinkedAccountCell } from "@/components/ToolRowRenderer";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import type { BillingTransaction } from "@/types/billingTransaction";

export function HistoricalBillingRow({ transaction, toolVisual, accountTag = "tag-gray" }: {
  transaction: BillingTransaction;
  toolVisual?: { logo: string; logoBg: string };
  accountTag?: string;
}) {
  const amountDisplay = transaction.currency.trim() && transaction.amount.trim()
    ? `${transaction.currency.trim()} ${transaction.amount.trim()}` : "—";

  return <article className="billing-month-transaction-row" data-transaction-id={transaction.id} data-relationship-id={transaction.relationshipId || undefined}>
    <div data-label="Tool Name"><span className="linked-tool-name-cell"><span className="tool-logo" style={{ background: toolVisual?.logoBg ?? "var(--surface-raised)", color: toolVisual ? undefined : "var(--text-2)" }} aria-hidden="true">{toolVisual?.logo || (transaction.toolNameSnapshot.trim() ? transaction.toolNameSnapshot.trim().slice(0, 2).toUpperCase() : "?")}</span><strong>{transaction.toolNameSnapshot.trim() || "Unknown"}</strong></span></div>
    <div data-label="Account"><LinkedAccountCell accountLabel={transaction.accountLabelSnapshot.trim() || "Unknown"} login={transaction.accountLoginSnapshot.trim()} tagClass={accountTag} /></div>
    <span className="billing-plan-name" data-label="Plan Name">{transaction.planNameSnapshot.trim() || "Not set"}</span>
    <span data-label="Amount">{amountDisplay}</span>
    <span data-label="Billing Type">{transaction.billingTypeSnapshot.trim() || "Not set"}</span>
    <span data-label="Payment Date">{billingHistoryDisplayDate(transaction.paymentDate)}</span>
    <span data-label="Status" title="Read-only transaction"><span className={`billing-transaction-status is-${transaction.status.toLowerCase()}`}>{transaction.status}</span></span>
  </article>;
}
