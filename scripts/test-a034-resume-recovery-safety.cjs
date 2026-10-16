const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const recovery = fs.readFileSync(path.join(__dirname, "recover-a034-resume-e2e.sql"), "utf8");
const preflight = fs.readFileSync(path.join(__dirname, "preflight-resume-subscription.sql"), "utf8");
const normalized = recovery.replace(/--.*$/gm, "").toLowerCase();

assert.match(normalized, /^\s*begin\s*;/);
assert.match(normalized, /commit\s*;\s*$/);
assert.match(normalized, /create temporary table a034_resume_recovery_context/);
assert.match(normalized, /create temporary view a034_resume_recovery_snapshot/);
assert.doesNotMatch(normalized, /\btruncate\b|\balter\s+table\b|\bdrop\s+table\b/);

for (const token of [
  "REPLACE_WITH_A034_OWNER_EMAIL",
  "fixture_baseline",
  "non_fixture_baseline",
  "global_counts",
  "a034_relationships",
  "a034_components",
  "a034_periods",
  "a034_payments",
  "a034_events",
  "a034_activity",
]) assert.ok(recovery.includes(token), `missing required placeholder ${token}`);

for (const id of [
  "a0340000-0000-0000-0000-000000000301",
  "a0340000-0000-0000-0000-000000000302",
  "a0340000-0000-0000-0000-000000000401",
]) assert.ok(recovery.includes(id), `missing protected identity ${id}`);

assert.match(normalized, /pg_advisory_xact_lock\(hashtextextended\(c\.resume_event_id::text,1\)\)/);
assert.match(normalized, /pg_advisory_xact_lock\(hashtextextended\('a0340000-0000-0000-0000-000000000301',0\)\)/);
assert.match(normalized, /resume-payment:'\|\|c\.resume_event_id::text/);
assert.match(normalized, /expected_fixture_baseline->>'event_fp'\s*<>\s*'48709263e5a8ae50d4785a3f21bef72c'/);
assert.match(normalized, /complete pre-resume baseline was not restored exactly/);

const deletes = [...normalized.matchAll(/delete\s+from\s+public\.([a-z_]+)/g)].map((match) => match[1]);
assert.deepEqual(deletes, [
  "billing_transactions",
  "subscription_lifecycle_events",
  "tool_link_billing_components",
]);
assert.equal((normalized.match(/update\s+public\.tool_email_links/g) || []).length, 1);
assert.doesNotMatch(normalized, /delete\s+from\s+public\.(ai_tools|logins|tool_email_links|billing_renewal_periods|billing_renewal_activity)/);

const resultTwo = preflight.slice(preflight.indexOf("-- Result 2:"))
  .replace(/--.*$/gm, "")
  .toLowerCase();
assert.match(resultTwo, /\bwith\b/);
assert.doesNotMatch(resultTwo, /\b(insert|update|delete|truncate|alter|create|drop|grant|revoke|call|perform)\b/);

console.log("PASS: A034 Resume recovery is exact-scope, fail-closed, baseline-guarded, and paired with a read-only Result 2 verifier.");
