import { billingHistoryDisplayDate } from "@/lib/billingHistory";
import { newestFirstUnresolvedRenewalPeriods } from "@/lib/renewalPeriods";
import type { BillingRenewalPeriod } from "@/types/billingRenewalPeriod";

type Props = {
  onReview: (relationshipId: string) => void;
  periods: BillingRenewalPeriod[];
  relationshipId: string;
};

const periodBillingDate = (period: BillingRenewalPeriod) => period.billingDate || period.scheduledRenewalDate;

function displayAmount(currency: string, amount: string) {
  return currency.trim() && amount.trim() ? `${currency.trim()} ${amount.trim()}` : "—";
}

export default function BillingUnconfirmedSummary({ onReview, periods, relationshipId }: Props) {
  const unresolved = newestFirstUnresolvedRenewalPeriods(
    periods.filter((period) => period.relationshipId === relationshipId),
  );

  if (!unresolved.length) return null;

  return <section aria-labelledby={`billing-unconfirmed-${relationshipId}`} className="billing-details-section billing-details-unconfirmed-section">
    <div className="billing-details-section-heading billing-details-unconfirmed-heading">
      <div>
        <h3 id={`billing-unconfirmed-${relationshipId}`}>Unconfirmed Billing</h3>
        <p>{unresolved.length} outstanding {unresolved.length === 1 ? "period" : "periods"}</p>
      </div>
      <button className="billing-details-primary-action" onClick={() => onReview(relationshipId)} type="button">Review</button>
    </div>
    <div className="billing-details-payment-list">
      <table className="subscription-payment-table billing-details-unconfirmed-table">
        <thead><tr>{["Due date", "Billing Type", "Amount"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{unresolved.map((period) => <tr data-period-id={period.id} key={period.id}>
          <td>{billingHistoryDisplayDate(periodBillingDate(period))}</td>
          <td>{period.billingTypeSnapshot}</td>
          <td>{displayAmount(period.currencySnapshot, period.amountSnapshot)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
