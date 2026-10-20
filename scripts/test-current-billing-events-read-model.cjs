const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
let returnedRows = [];
const queryCalls = [];
let clientCreations = 0;
const query = {
  from(table) { queryCalls.push(["from", table]); return this; },
  select(columns) { queryCalls.push(["select", columns]); return this; },
  in(column, values) { queryCalls.push(["in", column, values]); return this; },
  order(column, options) { queryCalls.push(["order", column, options]); return this; },
  then(resolve) { return Promise.resolve({ data: returnedRows, error: null }).then(resolve); },
};
const source = fs.readFileSync(path.join(root, "lib/supabase/subscriptionBillingEvents.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleRecord = { exports: {} };
new Function("require", "module", "exports", output)((name) => {
  if (name === "@/lib/supabase/client") return { createClient: () => { clientCreations++; return query; } };
  return require(name);
}, moduleRecord, moduleRecord.exports);

const {
  getSubscriptionBillingEventsByRelationship,
  getSubscriptionBillingEventsByRelationships,
  replaceRelationshipBillingEvents,
  subscriptionBillingEventFromRecord,
} = moduleRecord.exports;

const snapshot = (planName) => ({ planName, components: {} });
const record = (overrides = {}) => ({
  id: "a0350000-0000-0000-0000-000000000701",
  user_id: "a0340000-0000-0000-0000-000000000001",
  tool_email_link_id: "a0350000-0000-0000-0000-000000000301",
  mode: "change",
  effective_date: "2026-10-18",
  reason: "Provider changed pricing",
  before_snapshot: snapshot("Pro"),
  after_snapshot: snapshot("Max"),
  changed_fields: ["plan_name", "amount"],
  classifications: ["plan_changed", "price_increased"],
  previous_recurring_component_id: "a0350000-0000-0000-0000-000000000401",
  new_recurring_component_id: "a0350000-0000-0000-0000-000000000402",
  created_at: "2026-10-19T02:00:00+00:00",
  ...overrides,
});

const mapped = subscriptionBillingEventFromRecord(record());
assert.equal(mapped.id, "a0350000-0000-0000-0000-000000000701");
assert.equal(mapped.userId, "a0340000-0000-0000-0000-000000000001");
assert.equal(mapped.relationshipId, "a0350000-0000-0000-0000-000000000301");
assert.equal(mapped.mode, "change");
assert.equal(mapped.effectiveDate, "2026-10-18");
assert.equal(mapped.createdAt, "2026-10-19T02:00:00+00:00");
assert.equal(mapped.reason, "Provider changed pricing");
assert.deepEqual(mapped.changedFields, ["plan_name", "amount"]);
assert.deepEqual(mapped.classifications, ["plan_changed", "price_increased"]);
assert.equal(mapped.beforeSnapshot.planName, "Pro");
assert.equal(mapped.afterSnapshot.planName, "Max");
assert.equal(mapped.previousRecurringComponentId, "a0350000-0000-0000-0000-000000000401");
assert.equal(mapped.newRecurringComponentId, "a0350000-0000-0000-0000-000000000402");
assert.throws(() => subscriptionBillingEventFromRecord(record({ mode: "unknown" })), /invalid mode/);
assert.throws(() => subscriptionBillingEventFromRecord(record({ changed_fields: ["unknown"] })), /invalid changed fields/);
assert.throws(() => subscriptionBillingEventFromRecord(record({ before_snapshot: null })), /invalid snapshot/);

(async () => {
  const relationshipOne = "a0350000-0000-0000-0000-000000000301";
  const relationshipTwo = "a0350000-0000-0000-0000-000000000302";
  returnedRows = [
    record({ id: "a0350000-0000-0000-0000-000000000703", tool_email_link_id: relationshipTwo, effective_date: "2026-10-17" }),
    record({ id: "a0350000-0000-0000-0000-000000000702", created_at: "2026-10-19T03:00:00+00:00" }),
    record(),
    record({ id: "a0350000-0000-0000-0000-000000000704", tool_email_link_id: "a0350000-0000-0000-0000-000000000399" }),
  ];
  const events = await getSubscriptionBillingEventsByRelationships([relationshipOne, relationshipOne, relationshipTwo]);
  assert.deepEqual(events.map((event) => event.id), [
    "a0350000-0000-0000-0000-000000000702",
    "a0350000-0000-0000-0000-000000000701",
    "a0350000-0000-0000-0000-000000000703",
  ]);
  assert.deepEqual(queryCalls.find((call) => call[0] === "in"), ["in", "tool_email_link_id", [relationshipOne, relationshipTwo]]);
  assert.deepEqual(queryCalls.filter((call) => call[0] === "order").map((call) => call[1]), ["effective_date", "created_at"]);

  returnedRows = [record()];
  assert.equal((await getSubscriptionBillingEventsByRelationship(relationshipOne)).length, 1);
  const creationsBeforeEmptyScope = clientCreations;
  assert.deepEqual(await getSubscriptionBillingEventsByRelationships([]), []);
  assert.equal(clientCreations, creationsBeforeEmptyScope, "empty scope must not issue a database query");

  const current = [
    mapped,
    subscriptionBillingEventFromRecord(record({ id: "a0350000-0000-0000-0000-000000000703", tool_email_link_id: relationshipTwo })),
  ];
  const replacement = subscriptionBillingEventFromRecord(record({ id: "a0350000-0000-0000-0000-000000000705" }));
  const wrongScope = subscriptionBillingEventFromRecord(record({ id: "a0350000-0000-0000-0000-000000000706", tool_email_link_id: relationshipTwo }));
  const refreshed = replaceRelationshipBillingEvents(current, relationshipOne, [replacement, wrongScope]);
  assert.deepEqual(refreshed.filter((event) => event.relationshipId === relationshipOne).map((event) => event.id), [replacement.id]);
  assert.deepEqual(refreshed.filter((event) => event.relationshipId === relationshipTwo).map((event) => event.id), [current[1].id]);

  const pageSource = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8");
  assert.match(pageSource, /getSubscriptionBillingEventsByRelationships\(historyRelationshipIds\)/);
  assert.match(pageSource, /replaceRelationshipBillingEvents\(current, relationshipId, billingEvents\)/);
  assert.match(pageSource, /billingEvents: subscriptionBillingEvents\.filter\(\(event\) => event\.relationshipId === detail\.relationshipId\)/);

  console.log("PASS: Current Billing event mapping, ordering, relationship isolation, loading, and replacement refresh verified.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
