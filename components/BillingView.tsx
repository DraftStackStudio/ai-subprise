import { Fragment, type ReactNode } from "react";

type BillingViewRow = {
  accountLabel: string;
  id: string;
  nextChargeDate: string;
  planName: string;
  tool: {
    id: string;
  };
};

type BillingRowOptions = {
  isAccountContinuation?: boolean;
  isPlanGroupEnd?: boolean;
  isPlanGroupStart?: boolean;
  isPlanGrouped?: boolean;
  isPlanContinuation?: boolean;
  isToolContinuation?: boolean;
};

type BillingViewProps<Row extends BillingViewRow> = {
  billingMonthLabel: (value: string) => string;
  billingRows: Row[];
  isLoadingTools: boolean;
  onLinkAccount: () => void;
  renderBillingRow: (row: Row, options?: BillingRowOptions) => ReactNode;
  selectedBillingView: string;
};

export default function BillingView<Row extends BillingViewRow>({
  billingMonthLabel,
  billingRows,
  isLoadingTools,
  onLinkAccount,
  renderBillingRow,
  selectedBillingView,
}: BillingViewProps<Row>) {
  return (
    <>
      <div className="account-table-head tool-table-head">
        <span>Tool Name</span>
        <span>Account</span>
        <span>Plan Name</span>
        <span>Amount</span>
        <span>Billing Type</span>
        <span>Next Charge</span>
        <span>Action</span>
      </div>
      {isLoadingTools ? (
        <div className="empty-state tool-onboarding-empty">
          <strong>Loading billing</strong>
          <span>Getting your paid subscriptions ready.</span>
        </div>
      ) : billingRows.length > 0 ? (
        billingRows.map((row, rowIndex) => {
          const previousRow = billingRows[rowIndex - 1];
          const nextRow = billingRows[rowIndex + 1];
          const monthLabel = billingMonthLabel(row.nextChargeDate);
          const previousMonthLabel = previousRow ? billingMonthLabel(previousRow.nextChargeDate) : "";
          const nextMonthLabel = nextRow ? billingMonthLabel(nextRow.nextChargeDate) : "";
          const showMonthHeader = selectedBillingView === "Month" && monthLabel !== previousMonthLabel;
          const isToolContinuation = Boolean(
            previousRow &&
              !showMonthHeader &&
              previousRow.tool.id === row.tool.id &&
              previousRow.accountLabel === row.accountLabel,
          );
          const isAccountContinuation = Boolean(
            isToolContinuation && previousRow?.accountLabel === row.accountLabel,
          );
          const matchesPlanGroup = (candidate: Row | undefined) =>
            Boolean(
              candidate &&
                candidate.tool.id === row.tool.id &&
                candidate.accountLabel === row.accountLabel &&
                candidate.planName === row.planName,
            );
          const isPlanContinuation = !showMonthHeader && matchesPlanGroup(previousRow);
          const isPlanGroupStart =
            matchesPlanGroup(nextRow) &&
            (selectedBillingView !== "Month" || monthLabel === nextMonthLabel);
          const isPlanGrouped = isPlanContinuation || isPlanGroupStart;
          const isPlanGroupEnd = isPlanGrouped && !matchesPlanGroup(nextRow);

          return (
            <Fragment key={row.id}>
              {showMonthHeader ? <div className="billing-month-row-header">{monthLabel}</div> : null}
              {renderBillingRow(row, {
                isAccountContinuation,
                isPlanGroupEnd,
                isPlanGrouped,
                isPlanContinuation,
                isPlanGroupStart: isPlanGroupStart && !isPlanContinuation,
                isToolContinuation,
              })}
            </Fragment>
          );
        })
      ) : (
        <div className="empty-state tool-onboarding-empty">
          <strong>No paid subscriptions yet</strong>
          <span>
            <button className="inline-text-link" onClick={onLinkAccount} type="button">
              Link an account
            </button>{" "}
            with a Paid plan to see it here.
          </span>
        </div>
      )}
    </>
  );
}
