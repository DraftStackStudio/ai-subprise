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

const trusted = (value) => Boolean(value)
  && typeof value.planName === "string"
  && value.components
  && typeof value.components === "object";
const { protectedToolDetailCurrentBillingPlan } = load("lib/toolDetailCurrentBilling.ts", {
  "@/lib/currentBillingChange": { isTrustedCurrentBillingRevision: trusted },
});

const component = {
  amount: "20",
  billingType: "Monthly",
  currency: "SGD",
  id: "a0350000-0000-0000-0000-000000000901",
  lastTopUpDate: null,
  nextRenewalDate: "2026-11-20",
  purchaseDate: null,
};
const relationships = [
  { accountLabel: "Personal", currentBillingRevision: { components: { primary: component }, planName: "Pro" }, planName: "stale", relationshipId: "r1", toolId: "tool-1" },
  { accountLabel: "Work", currentBillingRevision: { components: { primary: { ...component, id: "a0350000-0000-0000-0000-000000000902" } }, planName: "Team" }, planName: "stale", relationshipId: "r2", toolId: "tool-1" },
  { accountLabel: "Setup", currentBillingRevision: { components: {}, planName: "Starter" }, planName: "Starter", relationshipId: "r3", toolId: "tool-1" },
  { accountLabel: "Untrusted", currentBillingRevision: null, planName: "Locked", relationshipId: "r4", toolId: "tool-1" },
];

assert.deepEqual(protectedToolDetailCurrentBillingPlan(relationships, "tool-1", "Personal", "r1"), {
  planName: "Pro", relationshipId: "r1", trusted: true,
});
assert.deepEqual(protectedToolDetailCurrentBillingPlan(relationships, "tool-1", "Work", "r2"), {
  planName: "Team", relationshipId: "r2", trusted: true,
});
assert.equal(protectedToolDetailCurrentBillingPlan(relationships, "tool-1", "Personal", "r2"), null,
  "an exact relationship must not cross account boundaries");
assert.equal(protectedToolDetailCurrentBillingPlan(relationships, "tool-2", "Personal", "r1"), null,
  "an exact relationship must not cross tool boundaries");
assert.equal(protectedToolDetailCurrentBillingPlan(relationships, "tool-1", "Setup", "r3"), null,
  "trusted empty Current Billing remains available to initial setup");
assert.deepEqual(protectedToolDetailCurrentBillingPlan(relationships, "tool-1", "Untrusted", "r4"), {
  planName: "Locked", relationshipId: "r4", trusted: false,
}, "untrusted relationship data must fail closed");
assert.deepEqual(protectedToolDetailCurrentBillingPlan([], "tool-1", "Personal", "r1", relationships[0]), {
  planName: "Pro", relationshipId: "r1", trusted: true,
}, "a relationship-scoped trusted fallback must preserve established billing during a stale list refresh");
assert.equal(protectedToolDetailCurrentBillingPlan([], "tool-1", "Personal", "new-r", relationships[0]), null,
  "fallback data must still match the exact relationship ID");

const pageSource = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8");
const modalSource = fs.readFileSync(path.join(root, "components/ToolDetailModal.tsx"), "utf8");
const saveStart = pageSource.indexOf("const saveToolDetailAccount");
const saveEnd = pageSource.indexOf("const addToolDetailAccountDraft", saveStart);
const saveBody = pageSource.slice(saveStart, saveEnd);

assert.match(modalSource, /establishedCurrentBilling[\s\S]*?readOnly/);
assert.match(modalSource, /Edit in Subscriptions/);
assert.match(saveBody, /planName: protectedCurrentBilling\?\.planName/);
assert.match(saveBody, /planName: protectedCurrentBilling \? undefined : nextDetail\.planName/);
assert.match(pageSource, /setSubscriptionDetailsTarget\(relationshipId\)[\s\S]*?setActiveSection\("subscriptions"\)/);
assert.doesNotMatch(pageSource, /onOpenCurrentBilling[\s\S]{0,500}setEditingBilling/,
  "Tool Detail navigation must not auto-open the editor");

console.log("PASS: Tool Detail protects established Current Billing by exact relationship, preserves setup, and routes to Subscriptions.");
