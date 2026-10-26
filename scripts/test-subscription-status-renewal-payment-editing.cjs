const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
let hooks = [];
let cursor = 0;
const react = {
  Fragment: Symbol("Fragment"),
  useRef(initial) {
    const index = cursor++;
    return hooks[index] ?? (hooks[index] = { current: initial });
  },
  useState(initial) {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
    return [hooks[index], (value) => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
  },
};

function load(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const moduleRecord = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", output)((name) => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      return load(fs.existsSync(path.join(root, `${stem}.ts`)) ? `${stem}.ts` : `${stem}.tsx`, dependencies);
    }
    return require(name);
  }, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}

const DateFieldControl = (props) => ({ type: "date-field-control", props });
const DropdownControl = (props) => ({ type: "dropdown-control", props });
const PaymentBillingDifferenceChoiceField = (props) => ({ type: "payment-difference", props });
const manualWrites = [];
const Payments = load("components/SubscriptionPayments.tsx", {
  react,
  "@/components/DateFieldControl": { default: DateFieldControl },
  "@/components/DropdownControls": { DropdownControl },
  "@/components/PaymentBillingDifferenceChoice": { default: PaymentBillingDifferenceChoiceField },
  "@/lib/billingHistory": { billingHistoryDisplayDate: (value) => value },
  "@/lib/currentBilling": { validBillingDate: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) },
  "@/lib/subscriptionPaymentPrefill": { subscriptionPaymentPrefill: () => null },
  "@/lib/supabase/billingTransactions": {
    createBillingTransaction: async (value) => value,
    correctManualBillingTransaction: async (original, value, requestId) => { manualWrites.push({ original, value, requestId }); return { ...original, ...value }; },
  },
}).default;

const payment = {
  amount: "30.84", billingTypeSnapshot: "Monthly", currency: "SGD", id: "renewal-payment-1",
  paymentDate: "2026-09-30", planNameSnapshot: "Max", relationshipId: "relationship-1",
  source: "renewal", sourceKey: "renewal-period:period-1", status: "Paid", updatedAt: "2026-10-24T00:00:00.000Z",
};
const period = {
  amountSnapshot: "30.84", billingDate: "2026-09-30", billingTypeSnapshot: "Monthly", currencySnapshot: "SGD",
  excludedAt: "", id: "period-1", paymentTransactionId: payment.id, planNameSnapshot: "Max",
  relationshipId: "relationship-1", resolution: "paid", scheduledRenewalDate: "2026-09-30",
};
const manualPayment = { ...payment, id: "manual-payment-1", source: "manual", sourceKey: "manual-payment-1" };
const account = {
  billingComponents: [{ amount: "30.84", billingType: "Monthly", currency: "SGD" }],
  payments: [payment, manualPayment, { ...payment, id: "unlinked-renewal", sourceKey: "renewal-period:missing" }],
  planName: "Max", relationshipId: "relationship-1", renewalPeriods: [period],
};
const renewalWrites = [];
let releaseRenewal;
let rejectRenewal = false;
const onUpdateRenewalPayment = async (...args) => {
  renewalWrites.push(args);
  await new Promise((resolve, reject) => { releaseRenewal = () => rejectRenewal ? reject(new Error("Guard rejected correction")) : resolve(); });
  return { paymentTransactionId: payment.id, periodId: period.id };
};
const props = { account, canAdd: true, currencyOptions: [{ label: "SGD", value: "SGD" }, { label: "USD", value: "USD" }], onUpdateRenewalPayment };
const render = () => { cursor = 0; return Payments(props); };
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const text = (node) => typeof node === "string" ? node : !node || typeof node !== "object" ? "" : Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
const row = (id) => nodes(render()).find((node) => node.props?.["data-transaction-id"] === id);
const edit = (id) => nodes(row(id)).find((node) => node.props?.className === "subscription-payment-edit-button");
const field = (id, label) => nodes(row(id)).find((node) => (node.props?.["aria-label"] ?? node.props?.ariaLabel) === label);
const button = (id, label) => nodes(row(id)).find((node) => node.type === "button" && text(node) === label);
const flush = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
  assert(edit(payment.id), "an exactly linked confirmed renewal payment must show the existing pencil action");
  assert(edit(manualPayment.id), "manual payment editing must remain available");
  assert.equal(edit("unlinked-renewal"), undefined, "a renewal payment without one exact linked period must fail closed");

  edit(payment.id).props.onClick();
  assert.equal(field(payment.id, "Payment Date").props.disabled, false);
  assert.equal(field(payment.id, "Amount").props.disabled, false);
  const plan = field(payment.id, "Plan Name");
  assert.equal(plan.props.disabled, false);
  const billingTypeFieldset = nodes(row(payment.id)).find((node) => node.type === "fieldset" && nodes(node).some((child) => child.props?.ariaLabel === "Billing Type"));
  const statusFieldset = nodes(row(payment.id)).find((node) => node.type === "fieldset" && nodes(node).some((child) => child.props?.ariaLabel === "Payment Status"));
  assert.equal(billingTypeFieldset.props.disabled, false);
  assert.equal(statusFieldset.props.disabled, true);
  assert.deepEqual(field(payment.id, "Billing Type").props.options.map((option) => option.value), ["Monthly", "Yearly"]);
  assert.equal(nodes(row(payment.id)).some((node) => node.type === PaymentBillingDifferenceChoiceField), false);

  field(payment.id, "Payment Date").props.onChange("2026-10-01");
  field(payment.id, "Plan Name").props.onChange({ target: { value: "Pro" } });
  field(payment.id, "Billing Type").props.onChange("Yearly");
  field(payment.id, "Currency").props.onChange("USD");
  field(payment.id, "Amount").props.onChange({ target: { value: "31.50" } });
  const pending = button(payment.id, "Save").props.onClick();
  assert.equal(button(payment.id, "Save").props.disabled, true, "repeat submission must be disabled while the guarded RPC is pending");
  assert.equal(renewalWrites[0][0], "relationship-1");
  assert.equal(renewalWrites[0][1], "period-1");
  assert.equal(renewalWrites[0][2], "renewal-payment-1");
  assert.deepEqual({ ...renewalWrites[0][3], requestId: "stable" }, {
    amount: "31.50", billingType: "Yearly", currency: "USD", expectedUpdatedAt: payment.updatedAt,
    paymentDate: "2026-10-01", planName: "Pro", requestId: "stable",
  });
  assert.equal(manualWrites.length, 0, "renewal corrections must never use the manual transaction updater");
  releaseRenewal();
  await pending;
  assert.equal(nodes(render()).some((node) => node.props?.["data-draft-key"] === payment.id), false);

  edit(payment.id).props.onClick();
  await button(payment.id, "Save").props.onClick();
  assert.equal(renewalWrites.length, 1, "an unchanged renewal payment must not create a duplicate correction activity");

  edit(payment.id).props.onClick();
  field(payment.id, "Amount").props.onChange({ target: { value: "bad" } });
  await button(payment.id, "Save").props.onClick();
  assert(nodes(render()).some((node) => node.props?.role === "alert"), "invalid renewal input must remain local and show an error");
  assert.equal(renewalWrites.length, 1);

  button(payment.id, "Cancel").props.onClick();
  edit(payment.id).props.onClick();
  field(payment.id, "Amount").props.onChange({ target: { value: "32" } });
  rejectRenewal = true;
  const rejected = button(payment.id, "Save").props.onClick();
  releaseRenewal();
  await rejected;
  await flush();
  assert(nodes(render()).some((node) => node.props?.role === "alert" && /Guard rejected correction/.test(text(node))));
  assert(field(payment.id, "Amount"), "a rejected guarded correction must retain the draft");

  const pageSource = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8");
  assert.match(pageSource, /matchingPeriods\.length !== 1/);
  assert.match(pageSource, /await updateBillingRenewalPayment\(relationshipId, periodId, paymentTransactionId, input\)/);
  assert.match(pageSource, /await refreshSubscriptionRenewalData\(relationshipId\)/);
  const migrationSource = fs.readFileSync(path.join(root, "supabase/migrations/0035_add_billing_payment_correction_events.sql"), "utf8");
  assert.match(migrationSource, /billing_payment_correction_events/);
  assert.match(migrationSource, /billing_type_snapshot = p_billing_type/);
  assert.doesNotMatch(migrationSource, /insert into public\.billing_renewal_activity/);

  console.log("PASS: exact-linked renewal Payment Plan, Type, Date, Currency and Amount corrections, guards, loading, errors, refresh, and audit contracts verified.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
