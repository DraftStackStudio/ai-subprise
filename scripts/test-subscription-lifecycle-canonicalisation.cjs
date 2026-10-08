// Focused source-contract checks for migration 0031; no database or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('supabase/migrations/0031_canonicalise_relationship_lifecycle_status.sql');
const sql = migration.toLowerCase();

assert(sql.trimStart().startsWith('-- canonicalise relationship lifecycle storage'));
assert(sql.includes('begin;') && sql.trimEnd().endsWith('commit;'));
assert(sql.includes('lock table public.tool_email_links, public.subscription_lifecycle_events'));
assert(sql.indexOf('lock table') < sql.indexOf("raise exception 'migration 0031 found an unsupported"));

for (const legacy of [
  "'running'", "'on a break'", "'goodbye it was a journey'", "'goodbye, it was a journey'",
]) assert(sql.includes(legacy));
assert(sql.includes('migration 0031 found an unsupported relationship lifecycle status'));
assert(sql.includes('migration 0031 found an unsupported lifecycle-ledger state'));

const dropTransition = sql.indexOf('drop constraint if exists subscription_lifecycle_events_transition_check');
const ledgerUpdate = sql.indexOf('update public.subscription_lifecycle_events');
const addTransition = sql.indexOf('add constraint subscription_lifecycle_events_transition_check');
assert(dropTransition >= 0 && dropTransition < ledgerUpdate && ledgerUpdate < addTransition);
assert(sql.includes("previous_lifecycle_state in ('paused', 'on a break', 'on a break') then 'paused'"));
assert(sql.includes("next_lifecycle_state in ('paused', 'on a break', 'on a break') then 'paused'"));
assert(sql.includes("previous_lifecycle_state in ('active', 'paused', 'goodbye')"));
assert(sql.includes("next_lifecycle_state in ('active', 'paused', 'goodbye')"));
assert(sql.includes("event_kind = 'paused' and previous_lifecycle_state = 'active' and next_lifecycle_state = 'paused'"));
assert(sql.includes("event_kind = 'resumed' and previous_lifecycle_state = 'paused' and next_lifecycle_state = 'active'"));

const dropRelationshipCheck = sql.indexOf('drop constraint if exists tool_email_links_status_check');
const relationshipUpdate = sql.indexOf('update public.tool_email_links');
const relationshipConstraint = sql.indexOf('add constraint tool_email_links_status_check');
assert(dropRelationshipCheck >= 0 && dropRelationshipCheck < relationshipUpdate && relationshipUpdate < relationshipConstraint);
assert(sql.includes("when status in ('active', 'running') then 'active'"));
assert(sql.includes("when status in ('paused', 'on a break', 'on a break') then 'paused'"));
assert(sql.includes("then 'goodbye'"));
assert(sql.includes("alter column status set default 'active'"));
assert(sql.includes("check (status in ('active', 'paused', 'goodbye'))"));

assert(!/\binsert\s+into\s+public\./.test(sql));
assert(!/\bdelete\s+from\s+public\./.test(sql));
for (const table of [
  'tool_link_billing_components', 'billing_renewal_periods', 'billing_transactions',
  'billing_renewal_activity',
]) assert(!sql.includes(`update public.${table}`));
assert(!sql.includes('sync_due_billing_renewal_periods('));
assert(!sql.includes('recalculate_billing_next_renewal('));

const migration0030 = read('supabase/migrations/0030_add_subscription_lifecycle_foundation.sql');
assert(migration0030.includes("next_lifecycle_state = 'On a Break'"));
assert(!migration0030.includes("next_lifecycle_state = 'Paused'"));

const durable0030 = read('scripts/verify-subscription-lifecycle-foundation.sql');
assert.match(durable0030, /'Paused', 'On a Break', 'On a break', 'Goodbye'/);

const harness = read('scripts/test-subscription-lifecycle-canonicalisation.sql').toLowerCase();
assert(harness.trimStart().startsWith('-- manual rollback-only verification'));
assert(harness.includes('begin;') && harness.trimEnd().endsWith('rollback;'));
for (const assertion of [
  'relationship status default is not active',
  'legacy relationship status was accepted',
  'canonical pause transition was rejected',
  'canonical resume transition was rejected',
  'legacy lifecycle-ledger state was accepted',
  'billing or renewal tables changed during the canonicalisation harness',
]) assert(harness.includes(assertion));

const postcheck = read('scripts/verify-subscription-lifecycle-canonicalisation.sql').toLowerCase();
assert(postcheck.trimStart().startsWith('-- strictly read-only durable verification'));
assert(postcheck.includes('migration_0031_postcheck_passed'));
assert(postcheck.includes('legacy_relationship_status_count'));
assert(postcheck.includes('unsupported_relationship_status_count'));
assert(postcheck.includes('canonical_ledger_transitions_valid'));

const preflight = read('scripts/preflight-subscription-lifecycle-canonicalisation.sql').toLowerCase();
assert(preflight.trimStart().startsWith('-- strictly read-only live preflight'));
assert(preflight.includes('migration_0031_preflight_passed'));
assert(preflight.includes('unsupported_relationship_status_count'));
assert(preflight.includes('unsupported_ledger_state_count'));
assert(preflight.includes('conflicting_status_check_count'));
assert(!/\b(insert|update|delete|alter|create|drop|grant|revoke)\b\s+(into|table|from|on)/.test(preflight));

console.log('PASS: 0031 canonical status migration ordering, safety stops, canonical constraints, preservation scope, rollback harness, and durable postcheck contracts.');
