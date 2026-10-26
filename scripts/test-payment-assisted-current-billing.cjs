const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const payments = read("components/SubscriptionPayments.tsx");
const choices = read("components/PaymentBillingDifferenceChoice.tsx");
const accountView = read("components/SubscriptionAccountView.tsx");
const editor = read("components/SubscriptionBillingEditor.tsx");
const page = read("app/dashboard/page.tsx");

for (const choice of [
  "Previous entry mistake",
  "Provider changed subscription price",
  "Not sure why",
]) assert(choices.includes(choice), `missing payment difference choice: ${choice}`);

assert.match(payments, /draft\.id && onRequestCurrentBillingUpdate && originalPayment/,
  "only existing manual payment edits may trigger the decision");
assert.match(payments, /draft\.amount !== originalPayment\.amount && hasMatchingCurrentComponent/);
assert.match(payments, /Choose why this payment amount differs from Current Billing/);
assert.match(payments, /billingChoice === "correction" \|\| billingChoice === "change"/);
assert.doesNotMatch(payments, /billingChoice === "unknown"[\s\S]*?onRequestCurrentBillingUpdate/,
  "unknown reason must leave Current Billing unchanged");

const paymentWrite = payments.indexOf("await correctManualBillingTransaction(originalPayment, values, requestId)");
const paymentStored = payments.indexOf("setSaved((current)");
const paymentCleared = payments.indexOf("clearDraft(key)", paymentStored);
const billingRequested = payments.indexOf("onRequestCurrentBillingUpdate?.", paymentStored);
assert(paymentWrite > -1 && paymentWrite < paymentStored);
assert(paymentStored < paymentCleared && paymentCleared < billingRequested,
  "the saved payment must be finalized before opening Current Billing");
assert.doesNotMatch(payments, /updateCurrentBilling|updateToolLinkDetails/,
  "the payment component must not persist Current Billing");

assert.match(accountView, /onRequestCurrentBillingUpdate=\{currentBillingUpdateEligible && isTrustedCurrentBillingRevision\(account\.currentBillingRevision\) \? requestPaymentBillingUpdate/);
assert.match(accountView, /relationshipId !== account\.relationshipId\) return/);
assert.match(accountView, /setPaymentBillingUpdate\(\{ components, mode: choice \}\)/);
assert.match(accountView, /initialComponents: paymentBillingUpdate\?\.components/);
assert.match(accountView, /initialMode: paymentBillingUpdate\?\.mode/);
assert.match(accountView, /onSubmit: actions\.onUpdateCurrentBilling/);
assert.match(accountView, /onClose=\{\(\) => \{ setEditingBilling\(false\); setContinueToPaymentAfterBilling\(false\); setPaymentBillingUpdate\(null\); \}\}/,
  "cancelling the Current Billing editor must only close that editor");

assert.match(editor, /preparedUpdate\?\.initialComponents \?\? account\.billingComponents/);
assert.match(editor, /preparedUpdate\?\.initialMode \?\? null/,
  "ordinary edits must require an explicit choice while payment-assisted edits preserve their supplied mode");
assert.match(editor, /effectiveDate: comparison\.effectiveDate/);
assert.match(editor, /expectedRevision: openedRevision\.current/);
assert.match(editor, /requestId: requestId\.current/);

const auditedHandler = page.slice(
  page.indexOf("const updateSubscriptionCurrentBilling"),
  page.indexOf("const saveSubscriptionBillingSetup"),
);
assert.match(auditedHandler, /saveAuditedCurrentBilling/);
assert.match(auditedHandler, /persist: updateCurrentBilling/);
assert.match(auditedHandler, /refresh: refreshSubscriptionRenewalData/);
assert.doesNotMatch(auditedHandler, /updateToolLinkDetails|createBillingTransaction|updateBillingTransaction/);

console.log("PASS: payment-assisted choices save payments first, open the authoritative audited editor, preserve retries, and isolate ineligible or unknown-reason updates.");
