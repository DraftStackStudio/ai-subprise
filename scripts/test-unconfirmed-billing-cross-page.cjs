const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const cache = new Map();

function load(relativePath) {
  if (cache.has(relativePath)) return cache.get(relativePath);
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const moduleRecord = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", output)((name) => {
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      return load(fs.existsSync(path.join(root, `${stem}.ts`)) ? `${stem}.ts` : `${stem}.tsx`);
    }
    return require(name);
  }, moduleRecord, moduleRecord.exports);
  cache.set(relativePath, moduleRecord.exports);
  return moduleRecord.exports;
}

const BillingUnconfirmedSummary = load("components/BillingUnconfirmedSummary.tsx").default;
const relationshipOne = "relationship-one";
const relationshipTwo = "relationship-two";
const period = (overrides = {}) => ({
  actualPaymentDate: "",
  amountSnapshot: "30",
  billingComponentId: "component-one",
  billingTypeSnapshot: "Monthly",
  billingDate: "2026-10-20",
  createdAt: "2026-10-20T00:00:00Z",
  currencySnapshot: "SGD",
  excludedAt: "",
  excludedByLifecycleEventId: "",
  id: "period-one",
  notChargedNote: "",
  notChargedReasonCode: null,
  notChargedReasonText: "",
  paymentTransactionId: "",
  planNameSnapshot: "Pro",
  relationshipId: relationshipOne,
  resolution: null,
  resolvedAt: "",
  scheduledRenewalDate: "2026-10-20",
  updatedAt: "2026-10-20T00:00:00Z",
  userId: "user",
  ...overrides,
});
const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const nodeText = (node) => typeof node === "string" || typeof node === "number" ? String(node) : !node || typeof node !== "object" ? "" : Array.isArray(node) ? node.map(nodeText).join("") : nodeText(node.props?.children);

let reviewedRelationship = "";
const render = (periods, relationshipId = relationshipOne) => BillingUnconfirmedSummary({
  onReview: (selectedRelationshipId) => { reviewedRelationship = selectedRelationshipId; },
  periods,
  relationshipId,
});

let tree = render([period()]);
assert.match(nodeText(tree), /1 outstanding period/);
assert.match(nodeText(tree), /20 Oct 2026MonthlySGD 30/);

tree = render([
  period(),
  period({ billingDate: "2026-09-20", id: "period-two" }),
  period({ id: "other-account-period", relationshipId: relationshipTwo }),
]);
assert.match(nodeText(tree), /2 outstanding periods/);
assert.equal(nodes(tree).filter((node) => node.props?.["data-period-id"]).length, 2, "only the selected relationship must render");
assert(!nodeText(tree).includes("other-account-period"));

tree = render([period({ amountSnapshot: "", currencySnapshot: "" })]);
assert.match(nodeText(tree), /—/, "an unknown amount must remain unknown");
assert.match(nodeText(render([period({ amountSnapshot: "0" })])), /SGD 0/, "an explicit zero amount must not become unknown");
assert.equal(render([period({ resolution: "paid" })]), null, "resolved periods must disappear");
assert.equal(render([period({ excludedAt: "2026-10-21T00:00:00Z" })]), null, "excluded periods must disappear");

const review = nodes(tree).find((node) => node.type === "button" && nodeText(node) === "Review");
review.props.onClick();
assert.equal(reviewedRelationship, relationshipOne, "Review must preserve the exact relationship identity");

const page = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8");
const billingDetails = fs.readFileSync(path.join(root, "components/BillingDetailsView.tsx"), "utf8");
const subscriptions = fs.readFileSync(path.join(root, "components/SubscriptionsView.tsx"), "utf8");
const account = fs.readFileSync(path.join(root, "components/SubscriptionAccountView.tsx"), "utf8");
const summary = fs.readFileSync(path.join(root, "components/BillingUnconfirmedSummary.tsx"), "utf8");

assert.match(billingDetails, /<BillingUnconfirmedSummary[\s\S]*periods=\{account\.renewalPeriods \?\? \[\]\}[\s\S]*relationshipId=\{account\.relationshipId\}/);
assert.match(page, /onReviewUnconfirmedBilling=\{openRenewalDecision\}/);
assert.match(page, /const openRenewalDecision = \(relationshipId: string\) => \{[\s\S]*setSubscriptionDetailsTarget\(relationshipId\);[\s\S]*setSelectedSubscriptionView\("Renewal Decision"\);[\s\S]*setActiveSection\("subscriptions"\);/);
assert.match(page, /unresolvedRenewalReviewGroups\(billingRenewalPeriods\)/, "Dashboard must derive unresolved items from shared state");
assert.match(subscriptions, /newestFirstUnresolvedRenewalPeriods\(row\.renewalPeriods\)/, "Subscriptions must derive unresolved items from relationship state");
assert.match(summary, /newestFirstUnresolvedRenewalPeriods\([\s\S]*periods\.filter\(\(period\) => period\.relationshipId === relationshipId\)/, "Billing Details must enforce relationship isolation");
assert.match(account, /<UnconfirmedBillingSection[\s\S]*periods=\{account\.renewalPeriods\}/, "existing decision controls must remain in Subscriptions");
assert.match(page, /await refreshSubscriptionRenewalData\(relationshipId\)/, "existing mutation handlers must refresh shared state after resolution");
assert.doesNotMatch(summary, /Confirm paid|Not charged|\bEdit\b|createBillingTransaction|syncDueBillingRenewalPeriods/);
assert.doesNotMatch(billingDetails, /Confirm paid|Not charged|createBillingTransaction|syncDueBillingRenewalPeriods/);

console.log("PASS: Billing Details unresolved summaries, exact-account Review navigation, unknown amounts, resolution removal, and cross-page shared-state wiring verified.");
