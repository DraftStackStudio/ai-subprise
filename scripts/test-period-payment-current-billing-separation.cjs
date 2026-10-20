const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const panel = read("components/BillingHistoryPanel.tsx");
const accountView = read("components/SubscriptionAccountView.tsx");
const page = read("app/dashboard/page.tsx");
const renewal = read("components/UnconfirmedBillingSection.tsx");
const transactions = read("lib/supabase/billingTransactions.ts");

const helperSource = panel.slice(
  panel.indexOf("const canonicalAmount"),
  panel.indexOf("function InvoiceUploadField"),
);
const output = ts.transpileModule(`type PeriodDraftRow = any; type BillingAmount = any; type Create = (input: any) => Promise<any>; const createBillingTransaction = (() => {}) as unknown as Create; ${helperSource}\nmodule.exports = { periodPaymentBillingDecision, persistPeriodPayments };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const record = { exports: {} };
new Function("module", "exports", output)(record, record.exports);
const { periodPaymentBillingDecision, persistPeriodPayments } = record.exports;

const component = (amount = "30", currency = "SGD", billingType = "Monthly") => ({ amount, billingType, currency, id: "component-1", nextRenewalDate: "2026-11-01" });
const rows = (amount = "30", currency = "SGD", billingType = "Monthly") => [
  { amount, billingType, currency, id: "generated-Monthly-2026-09-01", origin: "generated" },
  { amount, billingType, currency, id: "generated-Monthly-2026-10-01", origin: "generated" },
];

assert.equal(periodPaymentBillingDecision(rows(), [component()], "Monthly", "SGD", "30").kind, "match");
assert.equal(periodPaymentBillingDecision(rows("30.00"), [component("030.0")], "Monthly", "SGD", "30.00").kind, "match");
assert.equal(periodPaymentBillingDecision(rows("35"), [component()], "Monthly", "SGD", "35").kind, "difference");
assert.equal(periodPaymentBillingDecision(rows("0"), [component("0")], "Monthly", "SGD", "0").kind, "match", "explicit zero must remain comparable");
assert.equal(periodPaymentBillingDecision(rows("0"), [component("")], "Monthly", "SGD", "0").kind, "unsupported", "unknown must remain distinct from zero");
assert.equal(periodPaymentBillingDecision(rows("35", "USD"), [component()], "Monthly", "USD", "35").kind, "unsupported");
assert.equal(periodPaymentBillingDecision(rows("35"), [component("30", "SGD", "Yearly")], "Monthly", "SGD", "35").kind, "unsupported");
const heterogeneous = rows("35"); heterogeneous[1].amount = "36";
assert.equal(periodPaymentBillingDecision(heterogeneous, [component()], "Monthly", "SGD", "35").kind, "unsupported");

for (const choice of ["correction", "change", "unknown"]) assert(panel.includes(`selectedPeriodBillingChoice === \"${choice}\"`) || choice === "unknown");
assert.match(panel, /Choose why these payment amounts differ from Current Billing/);
assert.match(panel, /await persistPeriodPayments\(periodDraftRows, relationshipId, createBillingTransaction, reload\);[\s\S]*?onPaymentsSaved\?\.\(\);[\s\S]*?closeForm\(\);[\s\S]*?onRequestCurrentBillingUpdate\?\./,
  "payments and their refresh must finish before the Current Billing editor request");
assert.match(panel, /selectedPeriodBillingChoice === "correction" \|\| selectedPeriodBillingChoice === "change"/);
assert.doesNotMatch(panel, /selectedPeriodBillingChoice === "unknown"[\s\S]*?onRequestCurrentBillingUpdate/);
assert.match(panel, /sourceKey: row\.sourceKey/);
assert.match(panel, /subscription-period:\$\{relationshipId\}:\$\{draft\.billingType\}:\$\{paymentDate\}/);
assert.match(transactions, /error\.code !== "23505" \|\| !payload\.source_key/);
assert.match(transactions, /\.eq\("source_key", payload\.source_key\)/, "retries must recover the existing payment by stable source key");

assert.doesNotMatch(page, /const saveSubscriptionBilling\b|onSavePaymentAssistedBilling/);
assert.doesNotMatch(panel, /updateToolLinkDetails|updateCurrentBilling|confirmBillingRenewalPaid/);
assert.match(accountView, /!firstTimeSetup && paymentMode === "period" && currentBillingUpdateEligible && isTrustedCurrentBillingRevision/);
assert.match(accountView, /relationshipId !== account\.relationshipId/);
assert.match(accountView, /index === componentIndex \? \{ \.\.\.component, currency, amount \} : component/);
assert.match(accountView, /onSubmit: actions\.onUpdateCurrentBilling/);
assert.match(accountView, /onPaymentsSaved=\{!firstTimeSetup && paymentMode === "period" \? actions\.onPaymentsChanged/);
assert.match(accountView, /onEstablishCurrentBilling=\{firstTimeSetup \?/,
  "initial and incomplete setup must retain its separate audited setup path");

assert.match(renewal, /onConfirmPaid\(relationshipId, period\.id\)/);
assert.doesNotMatch(panel, /onConfirmPaid|periodId|resolution/,
  "period Add Payment must not resolve or reconfirm renewal periods");
assert.match(page, /candidate\.resolution === null && !candidate\.excludedAt/,
  "resolved renewal periods remain protected by the existing exact-period guard");

(async () => {
  const retryRows = rows("35").map((row, index) => ({ ...row, note: "", paymentDate: `2026-0${index + 8}-01`, planName: "Pro", sourceKey: `stable-${index}`, status: "Paid" }));
  const saved = new Map();
  let failSecond = true;
  const create = async (input) => {
    if (input.sourceKey === "stable-1" && failSecond) { failSecond = false; throw new Error("partial failure"); }
    if (!saved.has(input.sourceKey)) saved.set(input.sourceKey, { id: `payment-${saved.size + 1}`, ...input });
    return saved.get(input.sourceKey);
  };
  await assert.rejects(persistPeriodPayments(retryRows, "r1", create, async () => {}), /partial failure/);
  assert.equal(saved.size, 1);
  await persistPeriodPayments(retryRows, "r1", create, async () => {});
  assert.equal(saved.size, 2, "a retry after partial creation must reuse stable payment identities");
  assert([...saved.values()].every((payment) => payment.relationshipId === "r1"));

  let refreshAttempts = 0;
  await assert.rejects(persistPeriodPayments(retryRows, "r1", create, async () => {
    refreshAttempts += 1;
    throw new Error("refresh failed");
  }), /refresh failed/);
  await persistPeriodPayments(retryRows, "r1", create, async () => { refreshAttempts += 1; });
  assert.equal(saved.size, 2, "a refresh retry must not duplicate saved payments");
  assert.equal(refreshAttempts, 2);

  console.log("PASS: period Add Payment saves idempotent manual transactions first, isolates renewal decisions, and defers only supported Current Billing differences to the audited editor.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
