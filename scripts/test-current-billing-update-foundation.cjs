// Focused source-contract checks for migration 0034; no database or network access.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read("supabase/migrations/0034_add_current_billing_update_contract.sql");
const sql = migration.toLowerCase();
assert(sql.trimStart().startsWith("-- current billing change/correction audit"));
assert(sql.includes("begin;") && sql.trimEnd().endsWith("commit;"));
assert(sql.includes("create table if not exists public.subscription_billing_events"));
assert(sql.includes("add column if not exists excluded_by_billing_event_id uuid"));
assert(sql.includes("billing_renewal_periods_one_reviewable_date_uidx"));
assert(sql.includes("where resolution is null and excluded_at is null"));
assert(sql.includes("create or replace function public.sync_due_billing_renewal_periods"));
assert(sql.includes("v_type is null or v_type not in"));
assert(sql.includes("on conflict do nothing"), "renewal generation must tolerate a cross-version reviewable-date conflict");
assert(sql.includes("amount = case when v_after_primary is not null"));
assert(sql.includes("currency = case when v_after_primary is not null"));
assert(sql.includes("create or replace function public.update_current_billing"));
assert(sql.includes("security definer") && sql.includes("set search_path = public"));
assert(sql.includes("pg_advisory_xact_lock(hashtextextended(p_request_id::text, 1))"));
assert(sql.includes("pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0))"));
assert(sql.includes("v_link.status <> 'active' or v_link.plan not in ('active', 'paid')"));
assert(sql.includes("a correction becomes operational on its save date"));
assert(sql.includes("future billing changes are not supported"));
assert(sql.includes("current billing changed. reopen the editor before saving"));
assert(sql.includes("this current billing request id is already in use"));
assert(sql.includes("coalesce(period.billing_date, period.scheduled_renewal_date) >= p_effective_date"));
assert(sql.includes("period.resolution is not null"));
assert(sql.includes("period.resolution is null and period.excluded_at is null"));
assert(sql.includes("previous_recurring_component_id"));
assert(sql.includes("new_recurring_component_id"));
assert(sql.includes("before_snapshot"));
assert(sql.includes("after_snapshot"));
assert(sql.includes("changed_fields"));
assert(sql.includes("classifications"));
assert(sql.includes("revoke all on function public.current_billing_revision(uuid) from public, anon, authenticated"));
assert(sql.includes("grant execute on function public.update_current_billing"));
assert(sql.includes("grant execute on function public.sync_due_billing_renewal_periods"));

// PostgreSQL cannot safely combine the prior DISTINCT/window-order form. Keep
// the grouped first-position de-duplication that is parser/type compatible.
assert(sql.includes("group by item.value"));
assert(sql.includes("order by deduplicated.first_position"));
assert(!sql.includes("select distinct value from unnest"));
assert(!sql.includes("order by min(position) over"));

for (const paymentWrite of [
  "insert into public.billing_transactions",
  "update public.billing_transactions",
  "delete from public.billing_transactions",
]) assert(!sql.includes(paymentWrite), `migration must not contain ${paymentWrite}`);

// Installing 0034 defines schema/functions only. Runtime data writes remain
// inside the guarded RPC body and cannot execute during migration application.
const topLevelMigration = sql.replace(/as \$\$[\s\S]*?\$\$;/g, "");
assert(!/^\s*(insert|update|delete|truncate|call|perform)\b/im.test(topLevelMigration));
assert(!/\b(select|perform|call)\s+(?:public\.)?update_current_billing\s*\(/i.test(topLevelMigration));

for (const file of [
  "scripts/preflight-current-billing-update.sql",
  "scripts/verify-current-billing-update-contract.sql",
]) {
  const source = read(file).replace(/--.*$/gm, "").trim().toLowerCase();
  assert.match(source, /^with\b/);
  assert.doesNotMatch(source, /;\s*(insert|update|delete|truncate|alter|create|drop|grant|revoke|call|perform)\b/);
}

const preflight = read("scripts/preflight-current-billing-update.sql").toLowerCase();
const preflightWithoutComments = preflight.replace(/--.*$/gm, "").trim();
const preflightWithoutLiterals = preflightWithoutComments.replace(/'(?:''|[^'])*'/g, "''");
assert.equal((preflightWithoutComments.match(/;/g) || []).length, 1);
assert(preflightWithoutComments.endsWith(";"));
assert.doesNotMatch(
  preflightWithoutLiterals,
  /\b(insert\s+into|update\s+\S+\s+set|delete\s+from|truncate|alter\s+table|create\s+(?:table|index|policy|function)|drop\s+(?:table|index|policy|function)|grant\s+|revoke\s+|call\s+|perform\s+)\b/,
);
for (const mutatingRpc of [
  "sync_due_billing_renewal_periods(",
  "pause_subscription(",
  "resume_subscription(",
  "confirm_billing_renewal_paid(",
  "mark_billing_renewal_not_charged(",
  "undo_billing_renewal_resolution(",
  "update_current_billing(",
]) assert(!preflightWithoutLiterals.includes(mutatingRpc));
assert(preflight.includes("prerequisite_indexes"));
assert(preflight.includes("prerequisite_policies"));
assert(preflight.includes("tool_email_link_policy_contract"));
assert(preflight.includes("cmd in ('select', 'all') and owner_using"));
assert(preflight.includes("cmd in ('insert', 'all') and owner_check"));
assert(preflight.includes("cmd in ('update', 'all') and owner_using and owner_check"));
assert(preflight.includes("unsafe_tool_email_link_policy_count"));
assert(!preflight.includes("('tool_email_links', 'tool_email_links_owner_select', 'select')"));
assert(preflight.includes("authenticated_direct_write_contract_present"));
assert(preflight.includes("next_renewal_off_cadence_count"));
assert(preflight.includes("active_relationship_next_mismatch_count"));

const postcheck = read("scripts/verify-current-billing-update-contract.sql").toLowerCase();
assert(postcheck.includes("expected.value = actual.value as baseline_preserved"));
assert(postcheck.includes("migration_0034_postcheck_passed"));
assert(postcheck.includes("billing_event_count"));
assert(postcheck.includes("billing_event_excluded_period_count"));
assert(postcheck.includes("sync_cross_version_conflict_safe"));

const harness = read("scripts/test-current-billing-update-contract.sql").toLowerCase();
assert(harness.trimStart().startsWith("-- rollback-only behavioural verification"));
assert(harness.includes("begin;") && harness.trimEnd().endsWith("rollback;"));
assert.doesNotMatch(harness, /^\s*commit\s*;/m);
for (const expected of [
  "genuine multi-field update did not create exactly one event",
  "renewals on/after the effective date were not excluded with exact provenance",
  "a resolved historical renewal period changed",
  "a historical payment changed",
  "unknown primary amount incorrectly fell back to the top-up amount",
  "correction rewrote or excluded historical renewal data",
  "missing old month-end renewal was not materialized before the effective date",
  "correction sync created a duplicate replacement renewal period",
  "no-op save created an event",
  "current billing update changed non-fixture data",
  "wrong-owner current billing update unexpectedly succeeded",
  "conflicting idempotency payload unexpectedly succeeded",
  "paused relationship update unexpectedly succeeded",
]) assert(harness.includes(expected));
assert(harness.includes("set local role authenticated"));
assert(harness.includes("reset role;"));
assert(harness.includes("all disposable changes will now roll back"));

console.log("PASS: Migration 0034 schema, RPC, read-only verification, and rollback-harness source contracts verified.");
