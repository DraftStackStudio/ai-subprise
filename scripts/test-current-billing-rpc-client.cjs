const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const relationshipId = "a0350000-0000-0000-0000-000000000301";
const requestId = "a0350000-0000-0000-0000-000000000701";
const primaryId = "a0350000-0000-0000-0000-000000000401";
const nextPrimaryId = "a0350000-0000-0000-0000-000000000402";
let rpcCalls = [];
let rpcResponse = { data: null, error: null };

const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const canonicalAmount = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Enter an amount of zero or greater within the supported range.");
  const number = Number(trimmed);
  if (!Number.isFinite(number) || number >= 1_000_000_000_000) throw new Error("Enter an amount of zero or greater within the supported range.");
  return number.toFixed(6).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, "");
};
const validTypes = (values) => values.length <= 2 && new Set(values).size === values.length
  && values.every((value) => ["Monthly", "Yearly", "Lifetime", "One-time", "Top-up"].includes(value))
  && values.filter((value) => value !== "Top-up").length <= 1;
const trustedRevision = (value) => Boolean(
  value
  && Object.keys(value).sort().join("|") === "components|planName"
  && value.planName === value.planName.trim()
  && value.components?.primary?.id === primaryId
  && value.components.primary.amount !== "0.000000"
);

const source = fs.readFileSync(path.join(root, "lib/supabase/currentBillingUpdates.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleRecord = { exports: {} };
new Function("require", "module", "exports", output)((name) => {
  if (name === "@/lib/currentBilling") return { validBillingDate: validDate };
  if (name === "@/lib/currentBillingChange") return {
    canonicalCurrentBillingAmount: canonicalAmount,
    isTrustedCurrentBillingRevision: trustedRevision,
  };
  if (name === "@/lib/subscriptions") return { validSubscriptionBillingTypes: validTypes };
  if (name === "@/lib/supabase/client") return {
    createClient: () => ({
      rpc: async (rpcName, payload) => {
        rpcCalls.push({ payload, rpcName });
        return rpcResponse;
      },
    }),
  };
  return require(name);
}, moduleRecord, moduleRecord.exports);

const { isTrustedCurrentBillingRevision, updateCurrentBilling } = moduleRecord.exports;
assert.doesNotMatch(source, /crypto\.randomUUID/, "the wrapper must not replace the caller's stable request ID");
const pageSource = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8");
assert.match(pageSource, /persist: updateCurrentBilling/, "the audited save path must use the typed wrapper");
assert.match(pageSource, /refresh: refreshSubscriptionRenewalData/, "a successful audited save must refresh relationship data");
const revision = {
  planName: "Pro",
  components: {
    primary: {
      amount: null,
      billingType: "Monthly",
      currency: "SGD",
      id: primaryId,
      lastTopUpDate: null,
      nextRenewalDate: "2026-11-16",
      purchaseDate: null,
    },
  },
};
const input = (overrides = {}) => ({
  components: [{
    amount: "0",
    billingType: "Monthly",
    currency: "sgd",
    id: primaryId,
    lastTopUpDate: "",
    nextRenewalDate: "2026-11-16",
    purchaseDate: "",
  }],
  effectiveDate: "2026-10-19",
  expectedRevision: revision,
  localDate: "2026-10-19",
  mode: "change",
  planName: " Pro ",
  reason: " Provider changed pricing ",
  relationshipId,
  requestId,
  ...overrides,
});
const resultRecord = (overrides = {}) => ({
  billing_event_id: requestId,
  excluded_period_count: 2,
  new_recurring_component_id: nextPrimaryId,
  previous_recurring_component_id: primaryId,
  relationship_id: relationshipId,
  was_already_applied: false,
  was_no_op: false,
  ...overrides,
});

async function rejectsWithoutRpc(overrides, pattern) {
  const before = rpcCalls.length;
  await assert.rejects(updateCurrentBilling(input(overrides)), pattern);
  assert.equal(rpcCalls.length, before, "invalid input must not call Supabase");
}

(async () => {
  assert.equal(isTrustedCurrentBillingRevision(revision), true);
  assert.equal(isTrustedCurrentBillingRevision(null), false);
  assert.equal(isTrustedCurrentBillingRevision({ ...revision, planName: " Pro " }), false);
  assert.equal(isTrustedCurrentBillingRevision({ ...revision, components: { primary: { ...revision.components.primary, id: "" } } }), false);
  assert.equal(isTrustedCurrentBillingRevision({ ...revision, components: { primary: { ...revision.components.primary, amount: "0.000000" } } }), false);

  rpcResponse = { data: [resultRecord()], error: null };
  const saved = await updateCurrentBilling(input());
  assert.deepEqual(saved, {
    billingEventId: requestId,
    excludedPeriodCount: 2,
    newRecurringComponentId: nextPrimaryId,
    previousRecurringComponentId: primaryId,
    relationshipId,
    wasAlreadyApplied: false,
    wasNoOp: false,
  });
  assert.equal(rpcCalls[0].rpcName, "update_current_billing");
  assert.deepEqual(rpcCalls[0].payload, {
    p_components: [{
      amount: "0",
      billingType: "Monthly",
      currency: "SGD",
      lastTopUpDate: null,
      nextRenewalDate: "2026-11-16",
      purchaseDate: null,
    }],
    p_effective_date: "2026-10-19",
    p_expected_revision: revision,
    p_local_date: "2026-10-19",
    p_mode: "change",
    p_plan_name: "Pro",
    p_reason: "Provider changed pricing",
    p_relationship_id: relationshipId,
    p_request_id: requestId,
  });
  assert.equal(rpcCalls[0].payload.p_components[0].amount, "0", "explicit zero must remain zero");

  rpcResponse = { data: resultRecord({ was_already_applied: true }), error: null };
  const retried = await updateCurrentBilling(input());
  assert.equal(retried.wasAlreadyApplied, true);
  assert.equal(rpcCalls[1].payload.p_request_id, rpcCalls[0].payload.p_request_id, "a logical retry must preserve its request ID");

  rpcResponse = { data: [resultRecord({
    billing_event_id: null,
    excluded_period_count: 0,
    new_recurring_component_id: null,
    previous_recurring_component_id: null,
    was_no_op: true,
  })], error: null };
  assert.equal((await updateCurrentBilling(input({
    components: [{ ...input().components[0], amount: "" }],
  }))).wasNoOp, true);
  assert.equal(rpcCalls.at(-1).payload.p_components[0].amount, null, "unknown amount must remain null");

  await rejectsWithoutRpc({ relationshipId: "" }, /relationship ID/);
  await rejectsWithoutRpc({ requestId: "" }, /request ID/);
  await rejectsWithoutRpc({ effectiveDate: "2026-02-30" }, /effective date/);
  await rejectsWithoutRpc({ localDate: "" }, /local date/);
  await rejectsWithoutRpc({ mode: "unknown" }, /change or correction/);
  await rejectsWithoutRpc({ mode: "correction", effectiveDate: "2026-10-18" }, /save date/);
  await rejectsWithoutRpc({ effectiveDate: "2026-10-20" }, /Future billing changes/);
  await rejectsWithoutRpc({ expectedRevision: null }, /could not be verified/);
  await rejectsWithoutRpc({ expectedRevision: { ...revision, unexpected: true } }, /could not be verified/);
  await rejectsWithoutRpc({ components: [{ ...input().components[0], billingType: "Unknown" }] }, /one main billing type/);
  await rejectsWithoutRpc({ components: [{ ...input().components[0], amount: "not-a-number" }] }, /amount/);

  const staleError = { code: "P0001", message: "Current Billing changed. Reopen the editor before saving." };
  rpcResponse = { data: null, error: staleError };
  await assert.rejects(updateCurrentBilling(input()), (error) => error === staleError);
  const genericRpcError = { code: "42501", message: "Authentication is required." };
  rpcResponse = { data: null, error: genericRpcError };
  await assert.rejects(updateCurrentBilling(input()), (error) => error === genericRpcError);

  rpcResponse = { data: [], error: null };
  await assert.rejects(updateCurrentBilling(input()), /did not return a result/);
  const incompleteResult = resultRecord();
  delete incompleteResult.previous_recurring_component_id;
  rpcResponse = { data: [incompleteResult], error: null };
  await assert.rejects(updateCurrentBilling(input()), /incomplete result/);
  rpcResponse = { data: [resultRecord({ relationship_id: "a0350000-0000-0000-0000-000000000399" })], error: null };
  await assert.rejects(updateCurrentBilling(input()), /different relationship/);
  rpcResponse = { data: [resultRecord({ billing_event_id: "a0350000-0000-0000-0000-000000000799" })], error: null };
  await assert.rejects(updateCurrentBilling(input()), /unexpected billing event/);
  rpcResponse = { data: [resultRecord({ excluded_period_count: -1 })], error: null };
  await assert.rejects(updateCurrentBilling(input()), /excluded-period count/);
  rpcResponse = { data: [resultRecord({ was_already_applied: true, was_no_op: true })], error: null };
  await assert.rejects(updateCurrentBilling(input()), /invalid result status/);
  rpcResponse = { data: [resultRecord({ billing_event_id: null, was_no_op: true })], error: null };
  await assert.rejects(updateCurrentBilling(input()), /invalid no-op result/);

  console.log("PASS: Current Billing RPC client validates revisions, payloads, null/zero amounts, errors, responses, and stable retries.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
