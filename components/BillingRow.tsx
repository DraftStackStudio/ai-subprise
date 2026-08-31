import { BillingToolNameCell, LinkedAccountCell } from "@/components/ToolRowRenderer";
import { useState, type ReactNode } from "react";
import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import type { BillingTransaction, UpdateBillingTransactionInput } from "@/types/billingTransaction";

export function HistoricalBillingRow({ transaction, toolVisual, accountTag = "tag-gray", onChange, currencyControl, typeControl, statusControl }: {
  transaction: BillingTransaction;
  toolVisual?: { logo: string; logoBg: string };
  accountTag?: string;
  onChange: (patch: UpdateBillingTransactionInput) => Promise<boolean>;
  currencyControl: ReactNode;
  typeControl: ReactNode;
  statusControl: ReactNode;
}) {
  const editable = transaction.source === "manual";
  const [editingAmount, setEditingAmount] = useState(false);
  const amountDisplay = transaction.currency.trim() && transaction.amount.trim()
    ? `${transaction.currency.trim()} ${transaction.amount.trim()}` : "—";
  const textField = (field: "amount" | "planNameSnapshot") => editable ? <input
    aria-label={field === "amount" ? "Payment amount" : "Payment plan snapshot"}
    className={`billing-inline-field${field === "planNameSnapshot" ? " billing-plan-name-input" : ""}`}
    defaultValue={transaction[field]}
    key={`${field}-${transaction[field]}`}
    placeholder={field === "amount" ? "—" : "Not set"}
    type={field === "amount" ? "number" : "text"}
    min={field === "amount" ? "0" : undefined}
    step={field === "amount" ? "any" : undefined}
    onBlur={async (event) => {
      const input = event.currentTarget;
      const value = input.value.trim();
      if (value !== transaction[field] && !await onChange({ [field]: value })) input.value = transaction[field];
    }}
    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
  /> : transaction[field].trim() || (field === "amount" ? "—" : "Not set");

  return <article className="billing-month-transaction-row" data-transaction-id={transaction.id} data-relationship-id={transaction.relationshipId || undefined}>
    <div data-label="Tool Name"><span className="linked-tool-name-cell"><span className="tool-logo" style={{ background: toolVisual?.logoBg ?? "var(--surface-raised)", color: toolVisual ? undefined : "var(--text-2)" }} aria-hidden="true">{toolVisual?.logo || (transaction.toolNameSnapshot.trim() ? transaction.toolNameSnapshot.trim().slice(0, 2).toUpperCase() : "?")}</span><strong>{transaction.toolNameSnapshot.trim() || "Unknown"}</strong></span></div>
    <div data-label="Account"><LinkedAccountCell accountLabel={transaction.accountLabelSnapshot.trim() || "Unknown"} login={transaction.accountLoginSnapshot.trim()} tagClass={accountTag} /></div>
    <span className="billing-plan-name" data-label="Plan Name">{textField("planNameSnapshot")}</span>
    <span data-label="Amount">{editable ? editingAmount ? <span className="billing-month-amount-editor">{currencyControl}{textField("amount")}<button className="inline-text-link" onClick={() => setEditingAmount(false)} type="button" aria-label="Close amount editor">✓</button></span> : <button className="billing-inline-field" onClick={() => setEditingAmount(true)} type="button" aria-label="Edit payment amount and currency">{amountDisplay}</button> : amountDisplay}</span>
    <span data-label="Billing Type">{editable ? typeControl : transaction.billingTypeSnapshot.trim() || "Not set"}</span>
    <span data-label="Payment Date">{editable ? <label className="billing-date-picker billing-date-picker-table has-value"><span className="billing-date-value">{billingHistoryDisplayDate(transaction.paymentDate)}</span><input aria-label="Payment date" className="billing-native-date-input" type="date" key={transaction.paymentDate} defaultValue={transaction.paymentDate} onChange={async (event) => { const input = event.currentTarget; const value = input.value; if (!value || (value !== transaction.paymentDate && !await onChange({ paymentDate: value }))) input.value = transaction.paymentDate; }} /></label> : billingHistoryDisplayDate(transaction.paymentDate)}</span>
    <span data-label="Status" title={editable ? "Edit payment status" : "Read-only transaction"}>{editable ? statusControl : <span className={`billing-transaction-status is-${transaction.status.toLowerCase()}`}>{transaction.status}</span>}</span>
  </article>;
}

export type BillingRowOptions = {
  isAccountContinuation?: boolean;
  isPlanGroupEnd?: boolean;
  isPlanGroupStart?: boolean;
  isPlanGrouped?: boolean;
  isPlanContinuation?: boolean;
  isToolContinuation?: boolean;
};

type BillingRowData = {
  accountLabel: string;
  amount: string;
  billingDate: string;
  billingDateField: "lastTopUpDate" | "nextChargeDate" | "purchaseDate";
  billingGroupDate: string;
  billingDateLabel: string;
  billingType: string;
  currency: string;
  id: string;
  planName: string;
  tool: {
    id: string;
    logoBg: string;
    name: string;
    restoredAt?: string;
  };
};

type BillingRowProps = {
  displayToolName: string;
  formatDate: (value: string) => string;
  logoText: string;
  onAmountChange: (value: string) => void;
  onBillingDateChange: (field: BillingRowData["billingDateField"], value: string) => void;
  onEdit: () => void;
  onOpenHistory: () => void;
  onPlanNameChange: (value: string) => void;
  options?: BillingRowOptions;
  renderAccount: () => ReactNode;
  renderCurrency: () => ReactNode;
  row: BillingRowData;
};

export default function BillingRow({
  displayToolName,
  formatDate,
  logoText,
  onAmountChange,
  onBillingDateChange,
  onEdit,
  onOpenHistory,
  onPlanNameChange,
  options = {},
  renderAccount,
  renderCurrency,
  row,
}: BillingRowProps) {
  const {
    isAccountContinuation = false,
    isPlanGroupEnd = false,
    isPlanGroupStart = false,
    isPlanGrouped = false,
    isPlanContinuation = false,
    isToolContinuation = false,
  } = options;

  return (
    <article
      className={[
        "account-table-row tool-table-row billing-tool-row",
        isToolContinuation ? "is-tool-continuation" : "",
        isAccountContinuation ? "is-account-continuation is-continuation" : "",
        isPlanGrouped ? "is-plan-grouped" : "",
        isPlanGroupStart ? "is-plan-group-start" : "",
        isPlanGroupEnd ? "is-plan-group-end" : "",
        isPlanContinuation ? "is-plan-continuation" : "",
      ].filter(Boolean).join(" ")}
    >
      <div data-label="Tool Name">
        {isToolContinuation ? (
          null
        ) : (
          <BillingToolNameCell
            accountLabel={row.accountLabel}
            displayName={displayToolName}
            logoBackground={row.tool.logoBg}
            logoText={logoText}
            onOpenHistory={onOpenHistory}
          />
        )}
      </div>
      <div data-label="Account">{isAccountContinuation ? null : renderAccount()}</div>
      <span className={isPlanGrouped ? "billing-plan-name is-grouped-plan" : "billing-plan-name"} data-label="Plan Name">
        <input
          aria-label={`${row.tool.name} ${row.accountLabel} plan name`}
          className="billing-inline-field billing-plan-name-input"
          defaultValue={row.planName}
          key={row.planName || "empty-plan-name"}
          onBlur={(event) => {
            const nextPlanName = event.currentTarget.value.trim();
            if (nextPlanName !== row.planName) onPlanNameChange(nextPlanName);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          placeholder="Not set"
          type="text"
        />
      </span>
      <span data-label="Amount">
        <span className="billing-amount-field">
          {renderCurrency()}
          <input
            aria-label={`${row.tool.name} ${row.accountLabel} amount`}
            className="billing-inline-field"
            defaultValue={row.amount}
            inputMode="decimal"
            onBlur={(event) => {
              const nextValue = event.currentTarget.value.trim();
              if (nextValue !== row.amount) onAmountChange(nextValue);
            }}
            placeholder="0.00"
            step="0.01"
            type="number"
          />
        </span>
      </span>
      <span data-label="Billing Type">
        <span className="billing-type-readonly">{row.billingType}</span>
      </span>
      <span className="billing-date-cell" data-label={row.billingDateLabel}>
        <label
          aria-label={row.billingDateLabel}
          className={`billing-date-picker billing-date-picker-table ${row.billingDate ? "has-value" : "is-empty"}`}
          onClick={(event) => {
            event.preventDefault();
            const input = event.currentTarget.querySelector<HTMLInputElement>("input[type=date]");
            if (typeof input?.showPicker === "function") input.showPicker();
            else input?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            const input = event.currentTarget.querySelector<HTMLInputElement>("input[type=date]");
            if (typeof input?.showPicker === "function") input.showPicker();
            else input?.focus();
          }}
          role="button"
          tabIndex={0}
        >
          {row.billingDate ? (
            <span className="billing-date-value">{formatDate(row.billingDate)}</span>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <rect x="4" y="5.5" width="16" height="14" rx="2" />
              <path d="M8 3.5v4M16 3.5v4M4 9.5h16" />
            </svg>
          )}
          <input
            aria-label={`${row.tool.name} ${row.accountLabel} ${row.billingDateLabel.toLowerCase()}`}
            className="billing-native-date-input"
            onChange={(event) => onBillingDateChange(row.billingDateField, event.target.value)}
            tabIndex={-1}
            type="date"
            value={row.billingDate}
          />
        </label>
      </span>
      <span className="row-actions billing-row-actions" data-label="Action">
        <button className="action-btn" onClick={onEdit} type="button">
          Edit
        </button>
      </span>
    </article>
  );
}
