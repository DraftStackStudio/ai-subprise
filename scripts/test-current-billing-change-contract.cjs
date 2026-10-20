const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(relativePath) {
  if (cache.has(relativePath)) return cache.get(relativePath);
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const module = { exports: {} };
  cache.set(relativePath, module.exports);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", output)((name) => {
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      const file = fs.existsSync(path.join(root, `${stem}.ts`)) ? `${stem}.ts` : `${stem}.tsx`;
      return load(file);
    }
    return require(name);
  }, module, module.exports);
  cache.set(relativePath, module.exports);
  return module.exports;
}

const {
  billingConfigurationForRenewalDate,
  buildCurrentBillingRevision,
  canonicalCurrentBillingAmount,
  compareCurrentBilling,
  isTrustedCurrentBillingRevision,
} = load("lib/currentBillingChange.ts");

const component = (overrides = {}) => ({
  id: "component-old",
  billingType: "Monthly",
  currency: "SGD",
  amount: "30.84",
  nextRenewalDate: "2026-11-16",
  ...overrides,
});
const compare = (overrides = {}) => compareCurrentBilling({
  previousPlanName: "Max",
  previousComponents: [component()],
  editedPlanName: "Max",
  editedComponents: [component({ id: "component-new" })],
  effectiveDate: "2026-11-01",
  isCorrection: false,
  ...overrides,
});

assert.equal(compare(), null, "storage identity alone must not produce a billing change");
assert.equal(compare({
  previousComponents: [component({ amount: "030.8400" })],
  editedComponents: [component({ amount: "30.84" })],
}), null, "equivalent decimal representations must compare equal");

assert.equal(canonicalCurrentBillingAmount(" 00030.8400004 "), "30.84");
assert.equal(canonicalCurrentBillingAmount("30.8400005"), "30.840001");
assert.equal(canonicalCurrentBillingAmount("0.0000005"), "0.000001");
assert.equal(canonicalCurrentBillingAmount("0.0000004"), "0");
assert.equal(canonicalCurrentBillingAmount(""), null);
assert.throws(() => canonicalCurrentBillingAmount("1000000000000"), /supported range/);
assert.throws(() => canonicalCurrentBillingAmount("999999999999.9999995"), /supported range/);

const primaryId = "a0350000-0000-0000-0000-000000000401";
const topUpId = "a0350000-0000-0000-0000-000000000402";
const revision = buildCurrentBillingRevision("  Max  ", [
  component({ id: primaryId, amount: "030.8400004", currency: "sgd" }),
  component({
    id: topUpId,
    billingType: "Top-up",
    currency: "usd",
    amount: "0.0000005",
    nextRenewalDate: undefined,
    lastTopUpDate: "2026-10-01",
  }),
]);
assert.deepEqual(revision, {
  planName: "Max",
  components: {
    primary: {
      id: primaryId,
      billingType: "Monthly",
      currency: "SGD",
      amount: "30.84",
      nextRenewalDate: "2026-11-16",
      purchaseDate: null,
      lastTopUpDate: null,
    },
    top_up: {
      id: topUpId,
      billingType: "Top-up",
      currency: "USD",
      amount: "0.000001",
      nextRenewalDate: null,
      purchaseDate: null,
      lastTopUpDate: "2026-10-01",
    },
  },
});
assert.equal(isTrustedCurrentBillingRevision(revision), true);
assert.equal(isTrustedCurrentBillingRevision(null), false);
assert.equal(isTrustedCurrentBillingRevision({ ...revision, planName: " Max " }), false);
assert.equal(isTrustedCurrentBillingRevision({ ...revision, components: { primary: { ...revision.components.primary, id: "" } } }), false);
assert.equal(isTrustedCurrentBillingRevision({ ...revision, components: { primary: { ...revision.components.primary, amount: "30.840000" } } }), false);
assert.equal(isTrustedCurrentBillingRevision({ ...revision, unexpected: true }), false);
assert.deepEqual(buildCurrentBillingRevision("", []), { planName: "", components: {} });
assert.equal(buildCurrentBillingRevision("Max", [component({ id: primaryId, amount: "" })]).components.primary.amount, null);
assert.equal(buildCurrentBillingRevision("Max", [component({ id: primaryId, amount: "0.000000" })]).components.primary.amount, "0");
assert.equal(buildCurrentBillingRevision("Max", [component({ id: "" })]), null, "missing persisted identity must fail closed");
assert.equal(buildCurrentBillingRevision("Max", [component({ id: "not-a-uuid" })]), null, "invalid persisted identity must fail closed");
assert.equal(buildCurrentBillingRevision("Max", [component(), component({ id: topUpId, billingType: "Yearly" })]), null, "multiple primary components must fail closed");
assert.equal(buildCurrentBillingRevision("Max", [component({ amount: "not-a-number" })]), null, "invalid persisted amounts must fail closed");
assert.equal(buildCurrentBillingRevision("Max", [component({ amount: "1000000000000" })]), null, "out-of-range persisted amounts must fail closed");
assert.equal(buildCurrentBillingRevision("Max", [component({ nextRenewalDate: "2026-02-30" })]), null, "invalid persisted dates must fail closed");

const toolsSource = fs.readFileSync(path.join(root, "lib/supabase/tools.ts"), "utf8");
assert.match(toolsSource, /const hasTrustedComponentRead = Array\.isArray\(rawLink\.tool_link_billing_components\)/);
assert.match(toolsSource, /const currentBillingRevision = hasTrustedComponentRead\s*\?[\s\S]*?buildCurrentBillingRevision\([\s\S]*?\)\s*:\s*null;/, "legacy component-query fallback must not invent a revision");
assert.match(toolsSource, /currentBillingRevision,/);

const increase = compare({ editedComponents: [component({ amount: "35" })] });
assert.deepEqual(increase.classifications, ["price_increased"]);
assert.deepEqual(increase.fieldChanges, [{ field: "amount", before: "30.84", after: "35" }]);

const currencyChange = compare({ editedComponents: [component({ currency: "USD", amount: "35" })] });
assert.deepEqual(currencyChange.classifications, ["currency_changed", "amount_changed"]);
assert.ok(!currencyChange.classifications.includes("price_increased"));
assert.ok(!currencyChange.classifications.includes("price_decreased"));

const amountWithoutCurrency = compare({
  previousComponents: [component({ currency: "", amount: "30" })],
  editedComponents: [component({ currency: "", amount: "35" })],
});
assert.deepEqual(amountWithoutCurrency.classifications, ["amount_changed"]);

const unknownToZero = compare({
  previousComponents: [component({ amount: "" })],
  editedComponents: [component({ amount: "0" })],
});
assert.deepEqual(unknownToZero.classifications, ["amount_recorded"]);
assert.deepEqual(unknownToZero.fieldChanges, [{ field: "amount", before: null, after: "0" }]);

const zeroToUnknown = compare({
  previousComponents: [component({ amount: "0.00" })],
  editedComponents: [component({ amount: "" })],
});
assert.deepEqual(zeroToUnknown.classifications, ["amount_cleared"]);

const combined = compare({
  editedPlanName: "Pro",
  editedComponents: [component({ billingType: "Yearly", currency: "USD", amount: "300", nextRenewalDate: "2027-11-01" })],
});
assert.equal(combined.mode, "change");
assert.equal(combined.componentChanges.length, 1);
assert.deepEqual(combined.classifications, [
  "plan_changed",
  "billing_cycle_changed",
  "currency_changed",
  "amount_changed",
  "renewal_date_changed",
]);
assert.equal(combined.before.components.primary.billingType, "Monthly");
assert.equal(combined.after.components.primary.billingType, "Yearly");

const correction = compare({
  editedPlanName: "Pro",
  editedComponents: [component({ amount: "35" })],
  isCorrection: true,
});
assert.equal(correction.mode, "correction");
assert.deepEqual(correction.classifications, [], "corrections must not imply provider/subscription change classifications");
assert.deepEqual(correction.fieldChanges.map(({ field }) => field), ["plan_name", "amount"]);

const withTopUp = compare({
  editedComponents: [component(), component({
    id: "top-up",
    billingType: "Top-up",
    amount: "10",
    nextRenewalDate: undefined,
    lastTopUpDate: "2026-10-01",
  })],
});
assert.deepEqual(withTopUp.classifications, ["component_added"]);
assert.equal(withTopUp.componentChanges[0].slot, "top_up");

const lifetimeDate = compare({
  previousComponents: [component({ billingType: "Lifetime", nextRenewalDate: undefined, purchaseDate: "2026-01-01" })],
  editedComponents: [component({ billingType: "Lifetime", nextRenewalDate: undefined, purchaseDate: "2026-02-01" })],
});
assert.deepEqual(lifetimeDate.classifications, ["purchase_date_changed"]);
assert.ok(!lifetimeDate.classifications.includes("renewal_date_changed"));

assert.equal(billingConfigurationForRenewalDate("2026-10-31", "2026-11-01"), "previous");
assert.equal(billingConfigurationForRenewalDate("2026-11-01", "2026-11-01"), "next");
assert.equal(billingConfigurationForRenewalDate("2026-12-01", "2026-11-01"), "next");

assert.throws(() => compare({ effectiveDate: "2026-02-30" }), /valid effective date/);
assert.throws(() => compare({ editedComponents: [component({ amount: "-1" })] }), /zero or greater/);
assert.throws(() => compare({ editedComponents: [component({ currency: "SG" })] }), /valid currency/);
assert.throws(() => billingConfigurationForRenewalDate("not-a-date", "2026-11-01"), /valid renewal and effective dates/);

console.log("PASS: Current Billing comparison, correction, amount, component, and effective-date contracts verified.");
