const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "lib/currentBillingSave.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleRecord = { exports: {} };
new Function("require", "module", "exports", output)(require, moduleRecord, moduleRecord.exports);
const { canUseAuditedCurrentBillingSave, canUseAuditedCurrentBillingSetup, currentBillingUpdateSuccessMessage, saveAuditedCurrentBilling, saveAuditedCurrentBillingSetup } = moduleRecord.exports;

const relationshipId = "a0350000-0000-0000-0000-000000000301";
const requestId = "a0350000-0000-0000-0000-000000000701";
const input = {
  components: [{ amount: "35", billingType: "Monthly", currency: "SGD", id: "a0350000-0000-0000-0000-000000000401", nextRenewalDate: "2026-11-16" }],
  effectiveDate: "2026-10-19",
  expectedRevision: { components: {}, planName: "Pro" },
  localDate: "2026-10-19",
  mode: "change",
  planName: "Pro",
  reason: null,
  relationshipId,
  requestId,
};
const eligible = {
  canManageBilling: true,
  lifecycleStatus: "Active",
  planStatus: "Paid",
  subscriptionState: "Complete",
};
const result = (overrides = {}) => ({
  billingEventId: requestId,
  excludedPeriodCount: 0,
  newRecurringComponentId: null,
  previousRecurringComponentId: null,
  relationshipId,
  wasAlreadyApplied: false,
  wasNoOp: false,
  ...overrides,
});

(async () => {
  assert.equal(currentBillingUpdateSuccessMessage(result()), "Current Billing updated");
  assert.equal(currentBillingUpdateSuccessMessage(result({ excludedPeriodCount: 1 })),
    "Current Billing updated. 1 unresolved renewal period superseded.");
  assert.equal(currentBillingUpdateSuccessMessage(result({ excludedPeriodCount: 3 })),
    "Current Billing updated. 3 unresolved renewal periods superseded.");
  assert.equal(currentBillingUpdateSuccessMessage(result({ excludedPeriodCount: 2, wasAlreadyApplied: true })),
    "Current Billing update confirmed. 2 unresolved renewal periods superseded.");
  assert.equal(currentBillingUpdateSuccessMessage(result({ billingEventId: null, excludedPeriodCount: 0, wasNoOp: true })),
    "Current Billing already matches");
  assert.equal(canUseAuditedCurrentBillingSave(eligible), true);
  assert.equal(canUseAuditedCurrentBillingSetup(eligible), false);
  assert.equal(canUseAuditedCurrentBillingSetup({ ...eligible, subscriptionState: "Not started" }), true);
  assert.equal(canUseAuditedCurrentBillingSetup({ ...eligible, subscriptionState: "Incomplete" }), true);
  for (const patch of [
    { canManageBilling: false },
    { lifecycleStatus: "Paused" },
    { lifecycleStatus: "Goodbye" },
    { planStatus: "Trial" },
    { subscriptionState: "Incomplete" },
  ]) assert.equal(canUseAuditedCurrentBillingSave({ ...eligible, ...patch }), false);

  for (const expected of [
    result(),
    result({ wasAlreadyApplied: true }),
    result({ billingEventId: null, wasNoOp: true }),
  ]) {
    const calls = [];
    const actual = await saveAuditedCurrentBilling(input, eligible, {
      persist: async (value) => { calls.push(["persist", value.requestId]); return expected; },
      refresh: async (id) => { calls.push(["refresh", id]); },
    });
    assert.deepEqual(actual, expected);
    assert.deepEqual(calls, [["persist", requestId], ["refresh", relationshipId]]);
  }

  let persisted = 0;
  let refreshed = 0;
  await assert.rejects(saveAuditedCurrentBilling(input, { ...eligible, lifecycleStatus: "Paused" }, {
    persist: async () => { persisted++; return result(); },
    refresh: async () => { refreshed++; },
  }), /Only a complete active paid subscription/);
  assert.equal(persisted, 0);
  assert.equal(refreshed, 0);

  await assert.rejects(saveAuditedCurrentBilling(input, eligible, {
    persist: async () => { throw new Error("stale current billing revision"); },
    refresh: async () => { refreshed++; },
  }), /stale current billing revision/);
  assert.equal(refreshed, 0, "RPC failures must not refresh or be treated as success");

  const retryRequestIds = [];
  const dependencies = {
    persist: async (value) => { retryRequestIds.push(value.requestId); return result({ wasAlreadyApplied: retryRequestIds.length > 1 }); },
    refresh: async () => { if (retryRequestIds.length === 1) throw new Error("refresh failed"); },
  };
  await assert.rejects(saveAuditedCurrentBilling(input, eligible, dependencies), /refresh failed/);
  const replayed = await saveAuditedCurrentBilling(input, eligible, dependencies);
  assert.equal(replayed.wasAlreadyApplied, true);
  assert.deepEqual(retryRequestIds, [requestId, requestId], "an unchanged retry must retain the same request ID");

  await assert.rejects(saveAuditedCurrentBilling(input, eligible, {
    persist: async () => result({ relationshipId: "a0350000-0000-0000-0000-000000000302" }),
    refresh: async () => { refreshed++; },
  }), /different relationship/);

  for (const subscriptionState of ["Not started", "Incomplete"]) {
    for (const expected of [
      result(),
      result({ wasAlreadyApplied: true }),
      result({ billingEventId: null, wasNoOp: true }),
    ]) {
      const calls = [];
      const actual = await saveAuditedCurrentBillingSetup(input, { ...eligible, subscriptionState }, {
        persist: async (value) => { calls.push(["persist", value.requestId]); return expected; },
        refresh: async (id) => { calls.push(["refresh", id]); },
      });
      assert.deepEqual(actual, expected);
      assert.deepEqual(calls, [["persist", requestId], ["refresh", relationshipId]]);
    }
  }
  await assert.rejects(saveAuditedCurrentBillingSetup(input, eligible, {
    persist: async () => result(), refresh: async () => {},
  }), /Only an incomplete active paid subscription/);
  await assert.rejects(saveAuditedCurrentBillingSetup(input, { ...eligible, subscriptionState: "Incomplete" }, {
    persist: async () => { throw new Error("stale current billing revision"); },
    refresh: async () => { throw new Error("must not refresh"); },
  }), /stale current billing revision/);
  await assert.rejects(saveAuditedCurrentBillingSetup(input, { ...eligible, subscriptionState: "Incomplete" }, {
    persist: async () => result(),
    refresh: async () => { throw new Error("setup refresh failed"); },
  }), /setup refresh failed/);
  await assert.rejects(saveAuditedCurrentBillingSetup(input, { ...eligible, subscriptionState: "Incomplete" }, {
    persist: async () => result({ relationshipId: "a0350000-0000-0000-0000-000000000302" }),
    refresh: async () => {},
  }), /different relationship/);

  const pageSource = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8");
  const accountViewSource = fs.readFileSync(path.join(root, "components/SubscriptionAccountView.tsx"), "utf8");
  const auditedHandler = pageSource.slice(
    pageSource.indexOf("const updateSubscriptionCurrentBilling"),
    pageSource.indexOf("const saveSubscriptionBillingSetup"),
  );
  assert.match(auditedHandler, /saveAuditedCurrentBilling/);
  assert.match(auditedHandler, /showToast\(currentBillingUpdateSuccessMessage\(result\)\)/);
  assert.doesNotMatch(auditedHandler, /updateToolLinkDetails/, "complete audited edits must never fall back to direct writes");
  assert.match(accountViewSource, /onSubmit: actions\.onUpdateCurrentBilling/);
  assert.match(accountViewSource, /const requestPaymentBillingUpdate[\s\S]*?setPaymentBillingUpdate/, "payment-assisted edits must open the audited editor");
  const paymentEditCallback = accountViewSource.slice(
    accountViewSource.indexOf("<SubscriptionPayments"),
    accountViewSource.indexOf("<section className=\"subscription-account-section\" aria-labelledby=\"subscription-account-activity\""),
  );
  assert.doesNotMatch(paymentEditCallback, /actions\.onSavePaymentAssistedBilling/, "manual payment edits must not reach the direct writer");
  assert.match(accountViewSource, /onEstablishCurrentBilling=\{firstTimeSetup[\s\S]*?await saveInitialCurrentBilling/, "initial setup is audited separately from the deferred payment-assisted path");
  assert.match(accountViewSource, /setupSubmission\.current\?\.signature !== signature[\s\S]*?crypto\?\.randomUUID/, "a logical setup submission owns one stable request ID");
  assert.doesNotMatch(pageSource, /const saveSubscriptionBilling\b|onSavePaymentAssistedBilling/, "period payments must not retain a direct Current Billing writer");
  const setupHandler = pageSource.slice(
    pageSource.indexOf("const saveSubscriptionBillingSetup"),
    pageSource.indexOf("const pauseSubscriptionRelationship"),
  );
  assert.match(setupHandler, /saveAuditedCurrentBillingSetup/);
  assert.match(setupHandler, /persist: updateCurrentBilling/);
  assert.match(setupHandler, /refresh: refreshSubscriptionRenewalData/);
  assert.doesNotMatch(setupHandler, /updateToolLinkDetails/, "the setup guard must run before reaching the isolated direct writer");
  assert.match(pageSource, /onSaveBilling=\{saveSubscriptionBillingSetup\}/);

  const directWriteEntryPoints = [
    ["saveManagedAccount", "billingAmounts"],
    ["saveCurrentBillingSettings", "billingAmounts"],
  ];
  for (const [name, billingField] of directWriteEntryPoints) {
    const start = pageSource.indexOf(`const ${name}`);
    assert.notEqual(start, -1, `legacy direct-write inventory is missing ${name}`);
    const nextFunction = pageSource.indexOf("\n  const ", start + 8);
    const body = pageSource.slice(start, nextFunction === -1 ? pageSource.length : nextFunction);
    assert.match(body, new RegExp(billingField), `${name} must remain explicitly classified by the field it writes`);
    assert.match(body, /updateToolLinkDetails/, `${name} direct-write behavior changed and needs a deliberate migration decision`);
  }
  const toolDetailStart = pageSource.indexOf("const saveToolDetailAccount");
  const toolDetailEnd = pageSource.indexOf("const addToolDetailAccountDraft", toolDetailStart);
  const toolDetailSave = pageSource.slice(toolDetailStart, toolDetailEnd);
  assert.match(toolDetailSave, /protectedToolDetailCurrentBillingPlan/,
    "Tool Detail must protect established Current Billing before legacy persistence");
  assert.match(toolDetailSave, /planName: protectedCurrentBilling \? undefined : nextDetail\.planName/,
    "Tool Detail must omit established Current Billing plan names from legacy writes");
  for (const removed of ["updateBillingField", "updateBillingAmountEntry", "updateBillingComponentDate"]) {
    assert.doesNotMatch(pageSource, new RegExp(`const ${removed}`), `${removed} must not return after the dead Billing Month renderer is removed`);
  }

  console.log("PASS: audited Current Billing save integration, refresh gating, failures, stable replay IDs, eligibility, and the complete legacy direct-write inventory verified.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
