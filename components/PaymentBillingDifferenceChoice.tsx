export type PaymentBillingDifferenceChoice = "correction" | "change" | "unknown";

export default function PaymentBillingDifferenceChoiceField({ disabled = false, onChange, value }: {
  disabled?: boolean;
  onChange: (choice: PaymentBillingDifferenceChoice) => void;
  value: PaymentBillingDifferenceChoice | "";
}) {
  return <fieldset className="subscription-pause-choice subscription-payment-difference-choice" disabled={disabled}>
    <legend>Why does this payment amount differ from Current Billing?</legend>
    <div className="subscription-payment-decision-buttons">{([
      ["correction", "Previous entry mistake"],
      ["change", "Provider changed subscription price"],
      ["unknown", "Not sure why"],
    ] as Array<[PaymentBillingDifferenceChoice, string]>).map(([choice, text]) => <button aria-pressed={value === choice} className={value === choice ? "category-view-tab active" : "category-view-tab"} key={choice} onClick={() => onChange(choice)} type="button">{text}</button>)}</div>
  </fieldset>;
}
