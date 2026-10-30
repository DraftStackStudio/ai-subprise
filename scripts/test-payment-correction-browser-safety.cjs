const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const verify = read("scripts/verify-payment-correction-browser-e2e.sql");
const cleanup = read("scripts/cleanup-payment-correction-browser-e2e-fixture.sql");

for (const sql of [verify, cleanup]) {
  for (const suffix of ["0101", "0201", "0301", "0401", "0501", "0601", "0602"]) {
    assert.match(sql, new RegExp(`a0360000-0000-0000-0000-00000000${suffix}`));
  }
  assert.match(sql, /A036 Manual Baseline/);
  assert.match(sql, /A036 Manual Corrected/);
  assert.match(sql, /A036 Renewal Baseline/);
  assert.match(sql, /array\['plan_name'\]::text\[\]/);
  assert.match(sql, /array\['amount'\]::text\[\]/);
  assert.match(sql, /before_snapshot/);
  assert.match(sql, /after_snapshot/);
  assert.match(sql, /5bb5d6d224232b3d8eef3d4c98f27adb/);
  assert.match(sql, /4ddb30e76275be3f52b050772fa6e9f4/);
}

assert.doesNotMatch(verify, /\b(insert|update|delete|truncate|alter|drop|create)\s+(table|from|into|public\.)/i,
  "browser verification must remain SELECT only");
assert.match(verify, /observed_correction_events/);
assert.match(verify, /browser_verification_passed/);

assert.match(cleanup, /^begin;/m);
assert.match(cleanup, /replace all four verified browser correction IDs/i);
assert.match(cleanup, /exact browser correction events and request IDs do not match/i);
assert.match(cleanup, /delete from public\.billing_payment_correction_events/);
assert.match(cleanup, /existing A036 Auth user, profile and login/i);
assert.match(cleanup, /Cleanup postcondition failed; transaction will roll back/);
assert.match(cleanup, /commit;\s*$/);
assert.doesNotMatch(cleanup, /delete from (auth\.users|public\.profiles|public\.logins)/i,
  "cleanup must preserve the A036 identity records");

console.log("PASS: A036 browser verification and cleanup remain exact-scope, snapshot-guarded, and fail closed.");
