const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const page = read("app/dashboard/page.tsx");
const row = read("components/BillingRow.tsx");
const view = read("components/BillingView.tsx");
const accountView = read("components/SubscriptionAccountView.tsx");
const toolRows = read("components/ToolRowRenderer.tsx");
const css = read("app/globals.css");

assert.match(page, /selectedBillingView === "All"[\s\S]*?<BillingView[\s\S]*?historical[\s\S]*?billingRows=\{historicalBillingRows\}/,
  "Billing By Month must continue using historical transactions");
assert.match(page, /const historicalBillingRows = billingTransactions[\s\S]*?transaction\.paymentDate[\s\S]*?right\.billingDate\.localeCompare\(left\.billingDate\)/,
  "historical search and newest-first sorting must remain intact");
assert.match(page, /renderBillingRow=\{\(\{ transaction \}\) => <HistoricalBillingRow/);
assert.match(page, /hasBillingRecords=\{billingTransactions\.length > 0\}/);

assert.match(view, /historical \? "Payment Date" : "Billing Date"/);
assert.match(view, /historical \? "Payment Status" : "Action"/);
assert.match(row, /export function HistoricalBillingRow/);
assert.match(row, /data-label="Payment Date"/);
assert.match(row, /data-label="Status" title="Read-only transaction"/);
assert.doesNotMatch(row, /export default function BillingRow|<input|onAmountChange|onBillingDateChange|onPlanNameChange/);

for (const removed of [
  "updateBillingField",
  "updateBillingAmountEntry",
  "updateBillingComponentDate",
  "allBillingRows",
  "renderBillingAccountCell",
  "renderBillingRow =",
]) assert.doesNotMatch(page, new RegExp(removed), `obsolete Billing Month symbol remains: ${removed}`);
assert.doesNotMatch(toolRows, /export function BillingAccountCell/);
assert.doesNotMatch(css, /\.billing-account-cell/);

assert.doesNotMatch(row, /createBillingTransaction|updateBillingTransaction|confirmBillingRenewalPaid|updateToolLinkDetails/,
  "historical rows must not mutate payments, renewals, or Current Billing");
assert.match(accountView, /aria-label="Edit Current Billing"/);
assert.match(accountView, /onSubmit: actions\.onUpdateCurrentBilling/);

console.log("PASS: Billing By Month remains read-only historical payment history with Payment Status while the dead Current Billing renderer and direct writers stay removed.");
