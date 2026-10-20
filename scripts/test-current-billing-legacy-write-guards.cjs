const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
function load(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleRecord = { exports: {} };
  new Function("require", "module", "exports", output)((name) => {
    if (name in dependencies) return dependencies[name];
    return require(name);
  }, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}

const validBillingDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const { canUseAuditedCurrentBillingSetup } = load("lib/currentBillingSave.ts");
const { subscriptionBillingPatch } = load("lib/subscriptions.ts", {
  "@/lib/currentBilling": { validBillingDate },
});

const setupEligibility = {
  canManageBilling: true,
  lifecycleStatus: "Active",
  planStatus: "Paid",
  subscriptionState: "Incomplete",
};
assert.equal(canUseAuditedCurrentBillingSetup(setupEligibility), true);
assert.equal(canUseAuditedCurrentBillingSetup({ ...setupEligibility, planStatus: "Active" }), true);
assert.equal(canUseAuditedCurrentBillingSetup({ ...setupEligibility, subscriptionState: "Not started" }), true);
for (const patch of [
  { canManageBilling: false },
  { lifecycleStatus: "Paused" },
  { lifecycleStatus: "Goodbye" },
  { planStatus: "Trial" },
  { subscriptionState: "Complete" },
]) assert.equal(canUseAuditedCurrentBillingSetup({ ...setupEligibility, ...patch }), false);

const component = (amount) => ({
  amount,
  billingType: "Monthly",
  currency: "SGD",
  id: "a0350000-0000-0000-0000-000000000401",
  nextRenewalDate: "2026-11-16",
});
assert.equal(subscriptionBillingPatch("Pro", [component("")]).billingAmounts[0].amount, "", "unknown amounts must remain blank");
assert.equal(subscriptionBillingPatch("Pro", [component("0")]).billingAmounts[0].amount, "0", "explicit zero must not become unknown");

const pageSource = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8");
const accountViewSource = fs.readFileSync(path.join(root, "components/SubscriptionAccountView.tsx"), "utf8");
const toolsSource = fs.readFileSync(path.join(root, "lib/supabase/tools.ts"), "utf8");
const functionBody = (name, nextName) => pageSource.slice(pageSource.indexOf(`const ${name}`), pageSource.indexOf(`const ${nextName}`));

const targetBody = functionBody("subscriptionTarget", "refreshSubscriptionRenewalData");
assert.match(targetBody, /detail\.relationshipId !== relationshipId/);
assert.match(targetBody, /subscriptionCandidates\.get\(relationshipId\)\?\.unlinkedAt/);

assert.doesNotMatch(pageSource, /const saveSubscriptionBilling\b|onSavePaymentAssistedBilling/,
  "period Add Payment must no longer expose a direct Current Billing writer");

const guardedSetup = functionBody("saveSubscriptionBillingSetup", "pauseSubscriptionRelationship");
assert.match(guardedSetup, /saveAuditedCurrentBillingSetup/);
assert.match(guardedSetup, /persist: updateCurrentBilling/);
assert.match(guardedSetup, /refresh: refreshSubscriptionRenewalData/);
assert.doesNotMatch(guardedSetup, /updateToolLinkDetails/);

const auditedSave = functionBody("updateSubscriptionCurrentBilling", "saveSubscriptionBillingSetup");
assert.match(auditedSave, /saveAuditedCurrentBilling/);
assert.match(auditedSave, /persist: updateCurrentBilling/);
assert.doesNotMatch(auditedSave, /saveSubscriptionBilling|updateToolLinkDetails/, "audited failures must not fall back to legacy persistence");

assert.match(accountViewSource, /const requestPaymentBillingUpdate[\s\S]*?setPaymentBillingUpdate/);
const paymentEditCallback = accountViewSource.slice(
  accountViewSource.indexOf("<SubscriptionPayments"),
  accountViewSource.indexOf("<section className=\"subscription-account-section\" aria-labelledby=\"subscription-account-activity\""),
);
assert.doesNotMatch(paymentEditCallback, /actions\.onSavePaymentAssistedBilling/);
assert.match(accountViewSource, /onEstablishCurrentBilling=\{firstTimeSetup \? async \(relationshipId[\s\S]*?relationshipId !== account\.relationshipId/);
assert.doesNotMatch(accountViewSource, /actions\.onSavePaymentAssistedBilling/);
assert.match(pageSource, /onSaveBilling=\{saveSubscriptionBillingSetup\}/);
assert.match(toolsSource, /if \(details\.amount !== undefined\) payload\.amount = details\.amount \|\| null/);
assert.match(toolsSource, /amount: component\.amount\.trim\(\) \|\| null/);

const reachableBypassInventory = [];
for (const name of reachableBypassInventory) {
  assert.match(pageSource, new RegExp(`const ${name}`), `missing legacy bypass inventory entry ${name}`);
}
for (const removed of ["updateBillingField", "updateBillingAmountEntry", "updateBillingComponentDate"]) {
  assert.doesNotMatch(pageSource, new RegExp(`const ${removed}`), `${removed} must remain removed with the dead Billing Month renderer`);
}
const toolDetailSave = functionBody("saveToolDetailAccount", "addToolDetailAccountDraft");
assert.match(toolDetailSave, /protectedToolDetailCurrentBillingPlan/,
  "Tool Detail must classify Current Billing through exact relationship-scoped data");
assert.match(toolDetailSave, /planName: protectedCurrentBilling \? undefined : nextDetail\.planName/,
  "Tool Detail must not persist an established Current Billing plan name");
assert.match(pageSource, /const saveCurrentBillingSettings/, "the unreachable Billing Details legacy handler remains inventoried");
assert.match(pageSource, /const saveManagedAccount/, "the unreachable Manage Account legacy handler remains inventoried");

console.log("PASS: audited Current Billing setup eligibility, exact relationship isolation, null/zero preservation, no-fallback boundary, and bypass removal verified.");
