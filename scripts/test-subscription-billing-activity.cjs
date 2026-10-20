const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "lib/subscriptionBillingActivity.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleRecord = { exports: {} };
new Function("require", "module", "exports", output)((name) => {
  if (name === "@/lib/billingHistory") return { billingHistoryDisplayDate: (value) => `date(${value})` };
  return require(name);
}, moduleRecord, moduleRecord.exports);

const { subscriptionBillingActivityItems } = moduleRecord.exports;
const relationshipOne = "a0350000-0000-0000-0000-000000000301";
const relationshipTwo = "a0350000-0000-0000-0000-000000000302";
const component = (overrides = {}) => ({
  amount: "20",
  billingType: "Monthly",
  currency: "USD",
  lastTopUpDate: null,
  nextRenewalDate: "2026-11-01",
  purchaseDate: null,
  ...overrides,
});
const event = (overrides = {}) => ({
  afterSnapshot: { planName: "Pro", components: { primary: component() } },
  beforeSnapshot: { planName: "", components: {} },
  changedFields: ["plan_name", "component_configuration"],
  classifications: ["plan_changed", "component_added"],
  createdAt: "2026-10-20T02:00:00.000Z",
  effectiveDate: "2026-10-20",
  id: "a0350000-0000-0000-0000-000000000701",
  mode: "change",
  newRecurringComponentId: "",
  previousRecurringComponentId: "",
  reason: "Initial billing details",
  relationshipId: relationshipOne,
  userId: "a0340000-0000-0000-0000-000000000001",
  ...overrides,
});

const setup = subscriptionBillingActivityItems([event()], relationshipOne);
assert.equal(setup.length, 1);
assert.equal(setup[0].title, "Current Billing set up");
assert.equal(setup[0].id, "current-billing-a0350000-0000-0000-0000-000000000701");
assert.equal(setup[0].note, "Initial billing details");
assert(setup[0].details.includes("Plan: Not recorded → Pro"));
assert(setup[0].details.includes("Billing component: Not recorded → Monthly"));
assert(setup[0].details.includes("Effective: date(2026-10-20)"));
assert(setup[0].details.some((detail) => detail.startsWith("Recorded: ")));

const multiFieldChange = event({
  afterSnapshot: { planName: "Max", components: { primary: component({ amount: "0", currency: "SGD", nextRenewalDate: "2026-12-01" }) } },
  beforeSnapshot: { planName: "Pro", components: { primary: component() } },
  changedFields: ["plan_name", "amount", "currency", "next_renewal_date"],
  classifications: ["plan_changed", "amount_changed", "currency_changed", "renewal_date_changed"],
  id: "a0350000-0000-0000-0000-000000000702",
  reason: "Provider changed the subscription",
});
const changed = subscriptionBillingActivityItems([multiFieldChange], relationshipOne);
assert.equal(changed.length, 1, "one multi-field Save must remain one activity entry");
assert.equal(changed[0].title, "Current Billing changed");
assert(changed[0].details.includes("Plan: Pro → Max"));
assert(changed[0].details.includes("Monthly amount: USD 20 → SGD 0"), "explicit zero must remain visible");
assert(changed[0].details.includes("Monthly currency: USD → SGD"));
assert(changed[0].details.includes("Monthly next renewal: date(2026-11-01) → date(2026-12-01)"));

const correction = event({
  afterSnapshot: { planName: "Pro", components: { primary: component({ amount: null }) } },
  beforeSnapshot: { planName: "Pro", components: { primary: component({ amount: "20" }) } },
  changedFields: ["amount"],
  classifications: [],
  id: "a0350000-0000-0000-0000-000000000703",
  mode: "correction",
  reason: "Previous entry was wrong",
});
const corrected = subscriptionBillingActivityItems([correction], relationshipOne);
assert.equal(corrected[0].title, "Current Billing corrected");
assert(corrected[0].details.includes("Monthly amount: USD 20 → Not recorded"), "missing values must not be invented as zero");

const incompleteToComplete = event({
  beforeSnapshot: { planName: "Pro", components: { primary: component({ amount: null }) } },
  changedFields: ["amount"],
  classifications: ["amount_recorded"],
  id: "a0350000-0000-0000-0000-000000000704",
});
assert.equal(subscriptionBillingActivityItems([incompleteToComplete], relationshipOne)[0].title, "Current Billing changed");

const duplicate = event({ id: "a0350000-0000-0000-0000-000000000705" });
const otherRelationship = event({ id: "a0350000-0000-0000-0000-000000000706", relationshipId: relationshipTwo });
const isolated = subscriptionBillingActivityItems([duplicate, duplicate, otherRelationship], relationshipOne);
assert.deepEqual(isolated.map((entry) => entry.id), ["current-billing-a0350000-0000-0000-0000-000000000705"]);

const accountViewSource = fs.readFileSync(path.join(root, "components/SubscriptionAccountView.tsx"), "utf8");
assert.match(accountViewSource, /subscriptionBillingActivityItems\(account\.billingEvents \?\? \[\], account\.relationshipId\)/);
assert.match(accountViewSource, /\[\.\.\.groupedLifecycleActivity, \.\.\.decisionActivity, \.\.\.correctionActivity, \.\.\.billingActivity\]/, "existing lifecycle and renewal activity must remain in the timeline");
assert.match(accountViewSource, /No recorded account activity for this account\./);

console.log("PASS: Account Activity billing-event labels, details, dates, deduplication, isolation, and existing activity preservation verified.");
