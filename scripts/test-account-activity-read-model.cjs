const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "lib/accountActivity.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleRecord = { exports: {} };
new Function("require", "module", "exports", output)((name) => require(name), moduleRecord, moduleRecord.exports);

const {
  accountActivityRecordedDateValue,
  buildAccountActivityReadModel,
  currentBillingAccountActivityItems,
  historicalSubscriptionPeriodActivityItems,
  paymentCorrectionAccountActivityItems,
  renewalPeriodAccountActivityItems,
} = moduleRecord.exports;

const relationshipOne = "11111111-1111-4111-8111-111111111111";
const relationshipTwo = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

const component = (overrides = {}) => ({
  amount: "30",
  billingType: "Monthly",
  currency: "SGD",
  lastTopUpDate: null,
  nextRenewalDate: "2026-11-21",
  purchaseDate: null,
  ...overrides,
});

let eventSequence = 0;
const billingEvent = (overrides = {}) => ({
  afterSnapshot: { planName: "Plus", components: { primary: component() } },
  beforeSnapshot: { planName: "Plus", components: { primary: component() } },
  changedFields: ["amount"],
  classifications: ["price_increased"],
  createdAt: "2026-10-22T09:30:00.000Z",
  effectiveDate: "2026-10-21",
  id: `billing-${++eventSequence}`,
  mode: "change",
  newRecurringComponentId: "component-new",
  previousRecurringComponentId: "component-old",
  reason: "",
  relationshipId: relationshipOne,
  userId,
  ...overrides,
});

const itemFor = (event) => currentBillingAccountActivityItems([event], relationshipOne)[0];

const initialSetup = itemFor(billingEvent({
  beforeSnapshot: { planName: "", components: {} },
  changedFields: ["plan_name", "billing_type", "amount", "next_renewal_date"],
  classifications: ["component_added", "plan_changed", "billing_cycle_changed", "price_increased", "renewal_date_changed"],
}));
assert.equal(initialSetup.title, "Current Billing set up");

const planOnly = itemFor(billingEvent({
  afterSnapshot: { planName: "Pro", components: { primary: component() } },
  changedFields: ["plan_name"],
  classifications: ["plan_changed"],
}));
assert.equal(planOnly.title, "Plan changed");
assert.deepEqual(planOnly.details, ["Plan: Plus → Pro"]);

const priceOnly = itemFor(billingEvent({
  afterSnapshot: { planName: "Plus", components: { primary: component({ amount: "50" }) } },
}));
assert.equal(priceOnly.title, "Price changed");
assert.deepEqual(priceOnly.details, ["Price: SGD 30 → SGD 50"]);
assert(!priceOnly.title.includes("increased"), "amount direction must not claim a provider price increase");

const cycle = itemFor(billingEvent({
  afterSnapshot: { planName: "Plus", components: { primary: component({ billingType: "Yearly", nextRenewalDate: "2027-11-21" }) } },
  changedFields: ["billing_type", "next_renewal_date"],
  classifications: ["billing_cycle_changed", "renewal_date_changed"],
}));
assert.equal(cycle.title, "Billing cycle changed");
assert(cycle.details.includes("Billing type: Monthly → Yearly"));

const billingType = itemFor(billingEvent({
  afterSnapshot: { planName: "Plus", components: { primary: component({ billingType: "Lifetime", nextRenewalDate: null, purchaseDate: "2026-10-21" }) } },
  changedFields: ["billing_type", "next_renewal_date", "purchase_date"],
  classifications: ["billing_type_changed", "renewal_date_changed", "purchase_date_changed"],
}));
assert.equal(billingType.title, "Billing type changed");
assert(billingType.details.includes("Billing type: Monthly → Lifetime"));

const renewalDate = itemFor(billingEvent({
  afterSnapshot: { planName: "Plus", components: { primary: component({ nextRenewalDate: "2026-12-21" }) } },
  changedFields: ["next_renewal_date"],
  classifications: ["renewal_date_changed"],
}));
assert.equal(renewalDate.title, "Renewal date changed");
assert.deepEqual(renewalDate.details, ["Renewal date: 2026-11-21 → 2026-12-21"]);

const multiple = itemFor(billingEvent({
  afterSnapshot: { planName: "Pro", components: { primary: component({ amount: "50", billingType: "Yearly", nextRenewalDate: "2027-11-21" }) } },
  changedFields: ["plan_name", "billing_type", "amount", "next_renewal_date"],
  classifications: ["plan_changed", "billing_cycle_changed", "price_increased", "renewal_date_changed"],
}));
assert.equal(multiple.title, "Plan changed", "multi-field title priority must prefer Plan changed");
assert.equal(multiple.details.length, 4, "one event must retain every changed field");

const correction = itemFor(billingEvent({
  afterSnapshot: { planName: "Plus", components: { primary: component({ amount: "35" }) } },
  classifications: [],
  mode: "correction",
  reason: "Previously entered incorrectly",
}));
assert.equal(correction.title, "Current Billing corrected");
assert.deepEqual(correction.details, ["Monthly · SGD 35"]);
assert.deepEqual(correction.correctionDetails, [{
  after: "SGD 35",
  before: "SGD 30",
  field: "amount",
  label: "Price",
}]);
assert.equal(correction.explanation, undefined, "corrections without exact superseded periods must remain unchanged");

const planOnlyCorrection = itemFor(billingEvent({
  afterSnapshot: { planName: "Max", components: { primary: component() } },
  changedFields: ["plan_name"],
  classifications: [],
  mode: "correction",
}));
assert.deepEqual(planOnlyCorrection.details, ["Plan: Max", "Monthly · SGD 30"]);
assert.deepEqual(planOnlyCorrection.correctionDetails, [{
  after: "Max",
  before: "Plus",
  field: "plan_name",
  label: "Plan",
}]);

const planAndComponentCorrection = itemFor(billingEvent({
  afterSnapshot: { planName: "Max", components: { primary: component({ amount: "35" }) } },
  changedFields: ["plan_name", "amount"],
  classifications: [],
  mode: "correction",
}));
assert.deepEqual(planAndComponentCorrection.details, ["Plan: Max", "Monthly · SGD 35"]);
assert.deepEqual(planAndComponentCorrection.correctionDetails.map(({ field }) => field), ["plan_name", "amount"]);

const blankPlanCorrection = itemFor(billingEvent({
  afterSnapshot: { planName: "", components: { primary: component() } },
  changedFields: ["plan_name"],
  classifications: [],
  mode: "correction",
}));
assert.deepEqual(blankPlanCorrection.details, ["Plan: Not recorded", "Monthly · SGD 30"]);
assert.equal(blankPlanCorrection.correctionDetails[0].after, "Not recorded");

const componentOnlyCorrection = itemFor(billingEvent({
  afterSnapshot: { planName: "Plus", components: { primary: component({ amount: "35" }) } },
  changedFields: ["amount"],
  classifications: [],
  mode: "correction",
}));
assert.deepEqual(componentOnlyCorrection.details, ["Monthly · SGD 35"]);
assert(!componentOnlyCorrection.details.some((detail) => detail.startsWith("Plan:")));

assert.deepEqual(planOnly.details, ["Plan: Plus → Pro"], "genuine-change summaries must remain unchanged");

const paidPeriod = (overrides = {}) => ({
  actualPaymentDate: "2026-09-21",
  amountSnapshot: "30",
  billingComponentId: "component-1",
  billingTypeSnapshot: "Monthly",
  billingDate: "2026-09-21",
  createdAt: "2026-09-22T00:00:00.000Z",
  currencySnapshot: "SGD",
  excludedAt: "",
  excludedByBillingEventId: "",
  excludedByLifecycleEventId: "",
  id: "period-paid",
  notChargedNote: "",
  notChargedReasonCode: null,
  notChargedReasonText: "",
  paymentTransactionId: "payment-paid",
  planNameSnapshot: "Plus",
  relationshipId: relationshipOne,
  resolution: "paid",
  resolvedAt: "2026-10-21T08:00:00.000Z",
  scheduledRenewalDate: "2026-09-21",
  updatedAt: "2026-10-21T08:00:00.000Z",
  userId,
  ...overrides,
});

const supersededPeriod = (event, overrides = {}) => paidPeriod({
  actualPaymentDate: "",
  excludedAt: "2026-10-22T09:30:00.000Z",
  excludedByBillingEventId: event.id,
  id: `superseded-${event.id}`,
  paymentTransactionId: "",
  resolution: null,
  resolvedAt: "",
  ...overrides,
});

const supersedingEvent = billingEvent({ id: "billing-superseding" });
const oneSuperseded = currentBillingAccountActivityItems(
  [supersedingEvent], relationshipOne, [supersededPeriod(supersedingEvent)],
)[0];
assert.equal(oneSuperseded.explanation,
  "1 unresolved renewal period was superseded by this billing change and is no longer awaiting review.");

const multipleSuperseded = currentBillingAccountActivityItems(
  [supersedingEvent, supersedingEvent],
  relationshipOne,
  [
    supersededPeriod(supersedingEvent),
    supersededPeriod(supersedingEvent),
    supersededPeriod(supersedingEvent, { id: "superseded-second" }),
    supersededPeriod(supersedingEvent, { id: "wrong-relationship", relationshipId: relationshipTwo }),
    supersededPeriod(billingEvent({ id: "other-billing-event" }), { id: "other-event" }),
    supersededPeriod(supersedingEvent, { excludedAt: "", id: "not-excluded" }),
    supersededPeriod(supersedingEvent, { id: "resolved", resolution: "not_charged", resolvedAt: "2026-10-22T10:00:00Z" }),
  ],
);
assert.equal(multipleSuperseded.length, 1, "a duplicated billing event must not create duplicate activity rows");
assert.equal(multipleSuperseded[0].explanation,
  "2 unresolved renewal periods were superseded by this billing change and are no longer awaiting review.");
assert.equal(currentBillingAccountActivityItems([supersedingEvent], relationshipOne, []).at(0).explanation, undefined);

const renewalPaid = renewalPeriodAccountActivityItems([paidPeriod()], relationshipOne)[0];
assert.equal(renewalPaid.title, "Subscription period — Paid");
assert.equal(renewalPaid.effectiveDate, "2026-09-21", "period date, not resolution date, is effective");
assert.equal(renewalPaid.recordedAt, "2026-10-21T08:00:00.000Z");
assert.equal(renewalPeriodAccountActivityItems([paidPeriod({ paymentTransactionId: "" })], relationshipOne).length, 0,
  "a paid period without its protected payment link is not sufficient evidence");

const notCharged = renewalPeriodAccountActivityItems([paidPeriod({
  actualPaymentDate: "",
  id: "period-not-charged",
  notChargedNote: "Card was declined",
  notChargedReasonCode: "payment_failed",
  paymentTransactionId: "",
  resolution: "not_charged",
})], relationshipOne)[0];
assert.equal(notCharged.title, "Subscription period — Not charged");
assert.match(notCharged.note, /Payment failed/);
assert(!notCharged.title.includes("Paid"), "not-charged periods must not create fake paid activity");

const transaction = (overrides = {}) => ({
  accountLabelSnapshot: "Personal",
  accountLoginSnapshot: "account@example.com",
  amount: "20",
  billingTypeSnapshot: "Monthly",
  createdAt: "2026-10-20T04:00:00.000Z",
  currency: "SGD",
  id: "transaction-period",
  loginId: "login-1",
  note: "50% off",
  paymentDate: "2026-08-21",
  planNameSnapshot: "Plus",
  relationshipId: relationshipOne,
  source: "manual",
  sourceKey: `subscription-period:${relationshipOne}:Monthly:2026-08-21`,
  status: "Paid",
  toolId: "tool-1",
  toolNameSnapshot: "Tool",
  updatedAt: "2026-10-20T04:00:00.000Z",
  userId,
  ...overrides,
});

const historicalPeriod = historicalSubscriptionPeriodActivityItems([transaction()], relationshipOne)[0];
assert.equal(historicalPeriod.title, "Subscription period — Paid");
assert.equal(historicalPeriod.source, "historical_subscription_period");
assert.equal(historicalPeriod.effectiveDate, "2026-08-21");
assert.equal(historicalPeriod.note, "50% off");

const correctionEvent = (overrides = {}) => ({
  afterSnapshot: { amount: "35", billingType: "Yearly", currency: "SGD", note: "", paymentDate: "2026-09-30", planName: "Pro", relationshipId: relationshipOne, source: "manual", sourceKey: `subscription-period:${relationshipOne}:Monthly:2026-08-21`, status: "Paid", transactionId: "transaction-1" },
  beforeSnapshot: { amount: "30", billingType: "Monthly", currency: "SGD", note: "50% off", paymentDate: "2026-08-21", planName: "Plus", relationshipId: relationshipOne, source: "manual", sourceKey: `subscription-period:${relationshipOne}:Monthly:2026-08-21`, status: "Paid", transactionId: "transaction-1" },
  changedFields: ["payment_date", "plan_name", "billing_type", "amount"],
  createdAt: "2026-10-24T09:30:00.000Z",
  effectiveDate: "2026-09-30",
  id: "payment-correction-1",
  paymentSource: "manual",
  paymentTransactionId: "transaction-1",
  relationshipId: relationshipOne,
  requestId: "request-1",
  userId,
  ...overrides,
});

const dateCorrection = paymentCorrectionAccountActivityItems([correctionEvent({
  changedFields: ["payment_date"],
  id: "date-only",
})], relationshipOne)[0];
assert.equal(dateCorrection.title, "Payment date corrected");
assert.equal(dateCorrection.effectiveDate, "2026-09-30");
assert.equal(dateCorrection.note, "21 Aug → 30 Sept");
assert.equal(dateCorrection.recordedAt, "2026-10-24T09:30:00.000Z");

const statusCorrection = paymentCorrectionAccountActivityItems([correctionEvent({
  afterSnapshot: { ...correctionEvent().afterSnapshot, status: "Failed" },
  beforeSnapshot: { ...correctionEvent().beforeSnapshot, status: "Paid" },
  changedFields: ["status"],
  id: "status-only",
})], relationshipOne)[0];
assert.equal(statusCorrection.title, "Payment status updated");
assert.equal(statusCorrection.note, "Paid → Failed");
assert.equal(paymentCorrectionAccountActivityItems([correctionEvent(), correctionEvent()], relationshipOne).length, 1,
  "the same persisted correction event must render once");
assert.equal(paymentCorrectionAccountActivityItems([correctionEvent({ relationshipId: relationshipTwo })], relationshipOne).length, 0);

const correctedHistorical = transaction({
  amount: "35", billingTypeSnapshot: "Yearly", id: "transaction-1", paymentDate: "2026-09-30", planNameSnapshot: "Pro",
});
const preservedHistorical = historicalSubscriptionPeriodActivityItems(
  [correctedHistorical], relationshipOne, new Set(), [correctionEvent()],
)[0];
assert.equal(preservedHistorical.effectiveDate, "2026-08-21");
assert.deepEqual(preservedHistorical.details, ["Plus", "Monthly", "SGD 30"]);
assert.equal(historicalSubscriptionPeriodActivityItems([
  transaction({ id: "single-corrected", sourceKey: `single-payment:${relationshipOne}:one` }),
], relationshipOne, new Set(), [correctionEvent({ paymentTransactionId: "single-corrected" })]).length, 0,
"ordinary single payments must not become subscription-period activity");

for (const insufficient of [
  transaction({ id: "single", sourceKey: `single-payment:${relationshipOne}:key:Monthly` }),
  transaction({ id: "one-off", sourceKey: `subscription-period:${relationshipOne}:one-off:row` }),
  transaction({ id: "legacy", source: "legacy_json", sourceKey: "legacy-json:r1:item" }),
  transaction({ id: "failed", status: "Failed" }),
  transaction({ id: "wrong-date", paymentDate: "2026-08-22" }),
]) {
  assert.equal(historicalSubscriptionPeriodActivityItems([insufficient], relationshipOne).length, 0);
}

const sameDateEarlier = billingEvent({
  afterSnapshot: { planName: "Pro", components: { primary: component() } },
  changedFields: ["plan_name"],
  classifications: ["plan_changed"],
  createdAt: "2026-10-22T08:00:00.000Z",
  effectiveDate: "2026-10-21",
});
const sameDateLater = billingEvent({
  afterSnapshot: { planName: "Plus", components: { primary: component({ amount: "35" }) } },
  createdAt: "2026-10-23T09:00:00.000Z",
  effectiveDate: "2026-10-21",
});
const olderUnknownRecorded = {
  date: "2026-07-21",
  event: "Plan Changed",
  id: "legacy-plan",
  note: "Imported history",
  planName: "Legacy",
  saved: true,
  source: "generated",
};

const groups = buildAccountActivityReadModel({
  billingEvents: [sameDateEarlier, sameDateLater, sameDateLater, billingEvent({ relationshipId: relationshipTwo })],
  historicalEntries: [olderUnknownRecorded],
  relationshipId: relationshipOne,
  renewalPeriods: [
    paidPeriod(),
    paidPeriod(),
    paidPeriod({ id: "other-period", relationshipId: relationshipTwo }),
    supersededPeriod(sameDateLater, { id: "read-model-superseded" }),
  ],
  transactions: [
    transaction(),
    transaction(),
    transaction({ id: "other-transaction", relationshipId: relationshipTwo, sourceKey: `subscription-period:${relationshipTwo}:Monthly:2026-08-21` }),
  ],
});

assert.deepEqual(groups.map((group) => group.effectiveDate), ["2026-10-21", "2026-09-21", "2026-08-21", "2026-07-21"]);
assert.equal(groups[0].items.length, 2, "same effective date must produce one group with distinct activities");
assert.deepEqual(groups[0].items.map((item) => item.recordedAt), [
  "2026-10-23T09:00:00.000Z",
  "2026-10-22T08:00:00.000Z",
], "each activity must retain and sort by its own recorded timestamp");
assert.equal(groups.flatMap((group) => group.items).filter((item) => item.relationshipId !== relationshipOne).length, 0);
assert.equal(groups.flatMap((group) => group.items).filter((item) => item.id === "current-billing-" + sameDateLater.id).length, 1);
assert.equal(groups.flatMap((group) => group.items).find((item) => item.id === "current-billing-" + sameDateLater.id).explanation,
  "1 unresolved renewal period was superseded by this billing change and is no longer awaiting review.");

const renewalMapper = fs.readFileSync(path.join(root, "lib/supabase/billingRenewalPeriods.ts"), "utf8");
assert.match(renewalMapper, /excludedByBillingEventId: text\(record\.excluded_by_billing_event_id\)/,
  "the persisted billing-event exclusion relationship must reach the shared read model");

const legacyItem = groups.find((group) => group.effectiveDate === "2026-07-21").items[0];
assert.equal(legacyItem.recordedAt, null);
assert.equal(accountActivityRecordedDateValue(legacyItem), "Not recorded");
assert.equal(accountActivityRecordedDateValue({ effectiveDate: "2026-10-21", recordedAt: "2026-10-21T08:00:00Z" }), "—");
assert.equal(accountActivityRecordedDateValue({ effectiveDate: "2026-10-21", recordedAt: "2026-10-22T08:00:00Z" }), "2026-10-22");

console.log("PASS: shared Account Activity titles, corrections, date grouping, renewal periods, historical period evidence, deduplication, and isolation verified.");
