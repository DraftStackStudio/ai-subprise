const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const cache = new Map();
let hooks = [];
let cursor = 0;
const react = {
  useState(initial) {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
    return [hooks[index], (value) => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
  },
};

function load(relativePath, dependencies = {}) {
  const cacheKey = Object.keys(dependencies).length ? null : relativePath;
  if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey);
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const moduleRecord = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", output)((name) => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      return load(fs.existsSync(path.join(root, `${stem}.ts`)) ? `${stem}.ts` : `${stem}.tsx`);
    }
    return require(name);
  }, moduleRecord, moduleRecord.exports);
  if (cacheKey) cache.set(cacheKey, moduleRecord.exports);
  return moduleRecord.exports;
}

const AccountActivityTable = load("components/AccountActivityTable.tsx", { react }).default;
const relationshipId = "a0360000-0000-0000-0000-000000000301";
const otherRelationshipId = "a0360000-0000-0000-0000-000000000302";
const component = (amount) => ({ amount, billingType: "Monthly", currency: "SGD", lastTopUpDate: null, nextRenewalDate: "2026-11-21", purchaseDate: null });
const event = (overrides = {}) => ({
  afterSnapshot: { planName: "Pro", components: { primary: component("50") } },
  beforeSnapshot: { planName: "Plus", components: { primary: component("30") } },
  changedFields: ["plan_name", "amount"],
  classifications: ["plan_changed", "price_increased"],
  createdAt: "2026-10-22T08:30:00Z",
  effectiveDate: "2026-10-21",
  id: "billing-change",
  mode: "change",
  newRecurringComponentId: "",
  previousRecurringComponentId: "",
  reason: "",
  relationshipId,
  userId: "user",
  ...overrides,
});
const correction = event({
  afterSnapshot: { planName: "Max", components: { primary: component("35") } },
  beforeSnapshot: { planName: "Pro", components: { primary: component("30") } },
  changedFields: ["plan_name", "amount"],
  classifications: [],
  createdAt: "2026-10-21T09:15:00Z",
  id: "billing-correction",
  mode: "correction",
});
const paidPeriod = {
  actualPaymentDate: "2026-10-20", amountSnapshot: "30", billingComponentId: "component", billingTypeSnapshot: "Monthly",
  billingDate: "2026-10-20", createdAt: "2026-10-01T00:00:00Z", currencySnapshot: "SGD", excludedAt: "",
  excludedByBillingEventId: "", excludedByLifecycleEventId: "", id: "period", notChargedNote: "", notChargedReasonCode: null, notChargedReasonText: "",
  paymentTransactionId: "renewal-payment", planNameSnapshot: "Pro", relationshipId, resolution: "paid",
  resolvedAt: "2026-10-21T10:00:00Z", scheduledRenewalDate: "2026-10-20", updatedAt: "", userId: "user",
};
const supersededPeriod = {
  ...paidPeriod,
  actualPaymentDate: "",
  excludedAt: "2026-10-22T08:30:00Z",
  excludedByBillingEventId: "billing-change",
  id: "superseded-period",
  paymentTransactionId: "",
  resolution: null,
  resolvedAt: "",
};
const historicalPeriod = {
  accountLabelSnapshot: "Test", accountLoginSnapshot: "test@example.com", amount: "30", billingTypeSnapshot: "Monthly",
  createdAt: "2026-10-20T07:00:00Z", currency: "SGD", id: "historical-period", loginId: "login", note: "",
  paymentDate: "2026-10-19", planNameSnapshot: "Pro", relationshipId, source: "manual",
  sourceKey: `subscription-period:${relationshipId}:Monthly:2026-10-19`, status: "Paid", toolId: "tool",
  toolNameSnapshot: "Tool", updatedAt: "", userId: "user",
};
const trialEntries = [
  { amount: "0", billingType: "Monthly", currency: "SGD", date: "2026-10-18", event: "Trial Started", id: "trial-started", note: "Trial opened", planName: "Trial", saved: true, source: "generated" },
  { amount: "30", billingType: "Monthly", currency: "SGD", date: "2026-10-17", event: "Trial Converted to Paid", id: "trial-converted", note: "Converted after trial", planName: "Plus", saved: true, source: "generated" },
  { amount: "0", billingType: "Monthly", currency: "SGD", date: "2026-10-16", event: "Moved to Free Tier", id: "trial-free-tier", note: "Free tier selected", planName: "Free Tier", saved: true, source: "generated" },
  { date: "2026-10-15", event: "Stopped Using", id: "trial-stopped", note: "Stopped after trial", planName: "Trial", saved: true, source: "generated" },
];
const props = {
  billingEvents: [event(), correction, event(), event({ id: "other", relationshipId: otherRelationshipId })],
  historicalEntries: [...trialEntries, trialEntries[1]],
  relationshipId,
  renewalPeriods: [paidPeriod, supersededPeriod],
  transactions: [historicalPeriod],
};
const render = () => { cursor = 0; return AccountActivityTable(props); };
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const nodeText = (node) => typeof node === "string" ? node : !node || typeof node !== "object" ? "" : Array.isArray(node) ? node.map(nodeText).join("") : nodeText(node.props?.children);

let tree = render();
assert.deepEqual(nodes(tree).filter((node) => node.type === "th").map(nodeText), ["Effective date", "Activity", "Recorded date"]);
assert.equal(nodes(tree).filter((node) => node.type === "tbody")[0].props.children.length, 7, "one table row must represent each effective date group");
assert.deepEqual(nodes(tree).filter((node) => node.props?.className === "account-activity-effective-date").map(nodeText), ["21 Oct 2026", "20 Oct 2026", "19 Oct 2026", "18 Oct 2026", "17 Oct 2026", "16 Oct 2026", "15 Oct 2026"]);
const sameDateEntries = nodes(tree).filter((node) => node.props?.className === "account-activity-entry" && ["current-billing-billing-change", "current-billing-billing-correction"].includes(node.props["data-event-id"]));
assert.equal(sameDateEntries.length, 2, "distinct events sharing an effective date must remain separate inside one row");
assert.match(nodeText(tree), /Plan changed/);
assert.match(nodeText(tree), /Plus → Pro/);
assert.match(nodeText(tree), /Current Billing corrected/);
assert.match(nodeText(tree), /Plan: Max · Monthly · SGD 35/);
assert.match(nodeText(tree), /1 unresolved renewal period was superseded by this billing change and is no longer awaiting review\./);
assert.match(nodeText(tree), /Subscription period — Paid/);
assert.match(nodeText(tree), /Monthly · SGD 30/);
assert.match(nodeText(tree), /Trial Started/);
assert.match(nodeText(tree), /Trial Converted to Paid/);
assert.match(nodeText(tree), /Moved to Free Tier/);
assert.match(nodeText(tree), /Stopped Using/);
assert.match(nodeText(tree), /Converted after trial/);
assert.match(nodeText(tree), /Free tier selected/);
assert.match(nodeText(tree), /Stopped after trial/);
assert.doesNotMatch(nodeText(tree), /Not recorded/, "missing recorded timestamps must render as an em dash");
assert.match(nodeText(tree), /—/);
assert.match(nodeText(tree), /22 Oct 2026/);
assert.doesNotMatch(nodeText(tree), /\b\d{1,2}:\d{2}\s(?:AM|PM)\b/, "recorded timestamps must render as dates without times");
assert(!nodeText(tree).includes("other"), "other relationships must remain isolated");
assert.equal(nodes(tree).filter((node) => node.props?.["data-event-id"] === "current-billing-billing-change").length, 1, "stable event IDs must deduplicate");
assert.equal(nodes(tree).filter((node) => node.props?.["data-event-id"] === "legacy-history-trial-converted").length, 1, "duplicate stored trial entries must render once");

let correctionButton = nodes(tree).find((node) => node.type === "button" && node.props.children === "View correction details");
assert(correctionButton);
assert.equal(correctionButton.props["aria-expanded"], false);
assert(!nodes(tree).some((node) => node.props?.className === "account-activity-correction-details"));
correctionButton.props.onClick();
tree = render();
correctionButton = nodes(tree).find((node) => node.type === "button" && node.props.children === "Hide correction details");
assert(correctionButton);
assert.equal(correctionButton.props["aria-expanded"], true);
const correctionDetails = nodes(tree).find((node) => node.props?.className === "account-activity-correction-details");
assert.match(nodeText(correctionDetails), /PlanPro→Max/);
assert.match(nodeText(correctionDetails), /PriceSGD 30→SGD 35/);
assert(!nodeText(correctionDetails).includes("beforeSnapshot"), "corrections must not expose raw snapshots");

for (const file of ["components/SubscriptionAccountView.tsx", "components/BillingDetailsView.tsx", "components/BillingHistoryPanel.tsx"]) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(source, /AccountActivityTable/);
  assert.match(source, /relationshipId=/);
}
const pageSource = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8");
for (const collection of ["subscriptionBillingEvents", "billingRenewalPeriods", "billingRenewalActivities", "subscriptionLifecycleEvents"]) {
  assert.match(pageSource, new RegExp(`${collection}\\.filter\\(\\([^)]*\\) => [^)]*\\.relationshipId ===`));
}
const styles = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
assert.match(styles, /\.account-activity-table th \{[^}]*font-size: 11px;[^}]*font-weight: 600;[^}]*height: 40px;[^}]*letter-spacing: \.06em;/);
assert.match(styles, /\.account-activity-table td \{[^}]*font-size: inherit;/);
assert.match(styles, /\.account-activity-copy > strong \{[^}]*font-size: inherit;[^}]*font-weight: 650;/);

console.log("PASS: shared Account Activity table grouping, sorting, recorded dates, corrections, subscription periods, deduplication, isolation, and cross-page wiring verified.");
