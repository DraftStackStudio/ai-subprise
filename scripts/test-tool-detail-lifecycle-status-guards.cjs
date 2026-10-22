const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
function load(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleRecord = { exports: {} };
  new Function("require", "module", "exports", output)(require, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}

const {
  protectedToolDetailLifecycleStatus,
  toolDetailLifecycleStatusSave,
} = load("lib/toolDetailLifecycleStatus.ts");

const active = protectedToolDetailLifecycleStatus({
  plan: "Active", relationshipId: "relationship-active", status: "Active",
});
const paused = protectedToolDetailLifecycleStatus({
  plan: "Paid", relationshipId: "relationship-paused", status: "Paused",
});
const goodbye = protectedToolDetailLifecycleStatus({
  plan: "Active", relationshipId: "relationship-goodbye", status: "Goodbye",
});

assert.deepEqual(active, { relationshipId: "relationship-active", status: "Active" });
assert.deepEqual(paused, { relationshipId: "relationship-paused", status: "Paused" });
assert.equal(protectedToolDetailLifecycleStatus({ plan: "Trial", relationshipId: "relationship-trial", status: "Active" }), null);
assert.equal(protectedToolDetailLifecycleStatus({ plan: "Active", status: "Active" }), null,
  "new account setup must retain its initial status selector");

for (const [protectedStatus, requestedStatus] of [
  [active, "Paused"],
  [active, "Goodbye"],
  [paused, "Active"],
  [goodbye, "Active"],
]) {
  assert.throws(() => toolDetailLifecycleStatusSave({
    expectedRelationshipId: protectedStatus.relationshipId,
    protectedStatus,
    requestedStatus,
  }), /Manage Subscription/);
}

assert.throws(() => toolDetailLifecycleStatusSave({
  expectedRelationshipId: "stale-relationship",
  protectedStatus: active,
  requestedStatus: "Active",
}), /relationship changed/i);

assert.deepEqual(toolDetailLifecycleStatusSave({
  expectedRelationshipId: active.relationshipId,
  protectedStatus: active,
  requestedStatus: "Active",
}), { persistStatus: undefined, status: "Active" },
"unchanged protected status must not be written or create legacy history");

assert.deepEqual(toolDetailLifecycleStatusSave({
  protectedStatus: null,
  requestedStatus: "Active",
}), { persistStatus: "Active", status: "Active" },
"initial setup must retain its existing status persistence");

const pageSource = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8");
const modalSource = fs.readFileSync(path.join(root, "components/ToolDetailModal.tsx"), "utf8");
const accountViewSource = fs.readFileSync(path.join(root, "components/SubscriptionAccountView.tsx"), "utf8");
const saveStart = pageSource.indexOf("const saveToolDetailAccount");
const saveEnd = pageSource.indexOf("const addToolDetailAccountDraft", saveStart);
const saveBody = pageSource.slice(saveStart, saveEnd);

assert.match(modalSource, /establishedLifecycleStatus[\s\S]*?readOnly/);
assert.match(modalSource, /Pause and resume under Subscriptions/);
assert.match(modalSource, /Manage in Subscriptions/);
assert.match(saveBody, /toolDetailLifecycleStatusSave/);
assert.match(saveBody, /status: lifecycleStatusSave\.persistStatus/);
assert.match(saveBody, /expectedRelationshipId: exactRelationshipId/);
assert.match(accountViewSource, /Pause subscription/);
assert.match(accountViewSource, /Resume subscription/);

console.log("PASS: Manage Account locks established paid lifecycle status, rejects stale or crafted changes, preserves setup, and retains guarded Pause/Resume entry points.");
