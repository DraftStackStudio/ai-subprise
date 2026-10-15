// Phase 2B2-A5.1 static fixture-safety review. No database or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const stripComments = (value) => value.replace(/^\s*--.*$/gm, '');

const proposal = read('PHASE_2B2_A4_DISPOSABLE_TEST_PROPOSAL.md');
const preflight = read('scripts/preflight-pause-e2e-fixture.sql');
const createFixture = read('scripts/create-pause-e2e-fixture.sql');
const verify = read('scripts/verify-pause-e2e-fixture.sql');
const cleanup = read('scripts/cleanup-pause-e2e-fixture.sql');
const migration = read('supabase/migrations/0032_add_pause_subscription_contract.sql');
const lifecycleFoundation = read('supabase/migrations/0030_add_subscription_lifecycle_foundation.sql');
const renewalFoundation = read('supabase/migrations/0027_add_billing_renewal_periods.sql');
const renewalActivity = read('supabase/migrations/0029_correct_renewal_schedule_and_activity.sql');
const authEmailPlaceholder = 'REPLACE_WITH_DELIVERABLE_AUTH_EMAIL';
const authGuardScripts = [preflight, createFixture, verify, cleanup];

assert.equal((verify.match(/00000000-0000-0000-0000-000000000000/g) || []).length, 1);
assert.equal((verify.match(/REPLACE_WITH_DELIVERABLE_AUTH_EMAIL/g) || []).length, 1);

for (const readOnlyScript of [preflight, verify]) {
  assert.doesNotMatch(stripComments(readOnlyScript), /^\s*(insert|update|delete|alter|create|drop|truncate|call)\b/im);
  assert.doesNotMatch(
    stripComments(readOnlyScript),
    /\b(?:select|perform|call)\s+(?:\*\s+from\s+)?(?:public\.)?(?:pause_subscription|sync_due_billing_renewal_periods)\s*\(/i,
  );
}

for (const transactionalScript of [createFixture, cleanup]) {
  assert.match(transactionalScript, /^begin;/m);
  assert.match(transactionalScript, /commit;\s*$/);
  const tags = [...transactionalScript.matchAll(/\$[a-z_]*\$/gi)].map((match) => match[0]);
  for (const tag of new Set(tags)) {
    assert.equal(tags.filter((candidate) => candidate === tag).length % 2, 0, `Unbalanced ${tag} block.`);
  }
}

assert.match(preflight, /pause_e2e_fixture_preflight_passed/);
assert.match(preflight, /test_email_replaced/);
assert.match(preflight, /reserved_a034_ids_are_unused/);
assert.match(preflight, /test_user_has_no_public_data/);
assert.match(preflight, /authenticated_can_execute_pause/);
assert.match(preflight, /anon_cannot_execute_pause/);
assert.match(preflight, /public_cannot_execute_pause/);
assert.match(preflight, /exact_owner_scope_and_no_money_activity_writes/);
assert.match(preflight, /pause_and_sync_share_relationship_lock/);
assert.match(preflight, /all_fixture_tables_have_rls_enabled/);
assert.match(preflight, /all_fixture_tables_have_owner_select_policies/);
assert.match(preflight, /authenticated_can_read_all_fixture_tables/);

const expectedPrimaryIds = [
  'a0340000-0000-0000-0000-000000000101',
  'a0340000-0000-0000-0000-000000000102',
  'a0340000-0000-0000-0000-000000000201',
  'a0340000-0000-0000-0000-000000000301',
  'a0340000-0000-0000-0000-000000000302',
  'a0340000-0000-0000-0000-000000000401',
  'a0340000-0000-0000-0000-000000000402',
  'a0340000-0000-0000-0000-000000000403',
  'a0340000-0000-0000-0000-000000000501',
  'a0340000-0000-0000-0000-000000000502',
  'a0340000-0000-0000-0000-000000000503',
  'a0340000-0000-0000-0000-000000000504',
  'a0340000-0000-0000-0000-000000000505',
  'a0340000-0000-0000-0000-000000000601',
  'a0340000-0000-0000-0000-000000000602',
  'a0340000-0000-0000-0000-000000000701',
];
assert.equal(new Set(expectedPrimaryIds).size, expectedPrimaryIds.length);
for (const id of expectedPrimaryIds) assert.match(createFixture, new RegExp(id));

assert.match(createFixture, /Replace the zero UUID/);
for (const script of authGuardScripts) {
  assert.match(script, new RegExp(authEmailPlaceholder));
  assert.doesNotMatch(script, /pause-e2e-a034@ai-subprise\.invalid/);
}
assert.match(createFixture, /lower\(email\) = lower\(v_auth_email\)/);
assert.match(preflight, /lower\(user_record\.email\) = lower\(params\.test_email\)/);
assert.match(verify, /lower\(user_record\.email\) = lower\(auth_params\.test_email\)/);
assert.match(cleanup, /lower\(coalesce\(email, ''\)\) <> lower\(v_auth_email\)/);
assert.match(createFixture, /pause-primary-a034@ai-subprise\.invalid/);
assert.match(createFixture, /pause-control-a034@ai-subprise\.invalid/);
assert.match(createFixture, /the dedicated a034 Auth user already owns public data/i);
assert.match(createFixture, /one or more reserved a034 fixture IDs already exist/i);
assert.match(createFixture, /public\.billing_renewal_date_from_anchor\([\s\S]*'Monthly', 4\)/);
assert.doesNotMatch(stripComments(createFixture), /pause_subscription\s*\(/i);
assert.doesNotMatch(stripComments(createFixture), /sync_due_billing_renewal_periods\s*\(/i);
assert.doesNotMatch(createFixture, /plan_status/);

assert.match(verify, /payment_fingerprint/);
assert.match(verify, /renewal_activity_fingerprint/);
assert.match(verify, /tool_fingerprint/);
assert.match(verify, /login_fingerprint/);
assert.match(verify, /isolation_relationship_fingerprint/);
assert.match(verify, /isolation_component_fingerprint/);
assert.match(verify, /isolation_payment_fingerprint/);
assert.match(verify, /isolation_period_fingerprint/);
assert.match(verify, /non_fixture_state/);
assert.match(verify, /fixture_stage/);
assert.match(verify, /ready_state_contract/);
assert.match(verify, /paused_state_contract/);
assert.match(verify, /protected_history_is_preserved/);
assert.match(verify, /activity\.activity_date = period\.billing_date/);
assert.match(verify, /activity\.previous_billing_date = period\.billing_date - 1/);
assert.match(verify, /activity\.billing_date = period\.billing_date/);
const protectedHistoryCheck = verify.slice(
  verify.lastIndexOf('and exists (', verify.indexOf('as protected_history_is_preserved')),
  verify.indexOf('as protected_history_is_preserved'),
);
assert.doesNotMatch(protectedHistoryCheck, /current_date/i);
assert.match(verify, /pause_e2e_fixture_state_passed/);
assert.match(verify, /test_user_id_replaced/);
assert.match(verify, /dedicated_confirmed_auth_user_exists/);
assert.match(verify, /ownership\.owner_id = auth_params\.test_user_id/);
assert.match(verify, /period\.excluded_by_lifecycle_event_id = event\.id/);
assert.match(verify, /coalesce\(period\.billing_date, period\.scheduled_renewal_date\) > event\.effective_date/);

assert.doesNotMatch(cleanup, /disable row level security/i);
assert.doesNotMatch(cleanup, /delete\s+from\s+auth\.users/i);
assert.match(cleanup, /pause_a034_cleanup_events/);
assert.match(cleanup, /RPC-materialised periods whose IDs are generated/);
assert.match(cleanup, /Safety stop: the dedicated test user owns an unexpected record/);
assert.match(cleanup, /Safety stop: the test user has an unexpected renewal period/);
assert.match(cleanup, /supplied Auth user ID belongs to a different email/);
assert.doesNotMatch(cleanup, /exact dedicated a034 Auth user was not found/);
assert.match(cleanup, /Cleanup postcondition failed; the transaction will roll back/);

const deletionOrder = [
  'delete from public.billing_renewal_activity',
  'delete from public.billing_renewal_periods',
  'delete from public.subscription_lifecycle_events',
  'delete from public.billing_transactions',
  'delete from public.tool_link_billing_components',
  'delete from public.tool_email_links',
  'delete from public.ai_tools',
  'delete from public.logins',
].map((needle) => cleanup.indexOf(needle));
assert(deletionOrder.every((index) => index >= 0));
assert.deepEqual([...deletionOrder].sort((a, b) => a - b), deletionOrder);

assert.match(migration, /where link\.id = p_relationship_id and link\.user_id = v_user_id/);
assert.match(migration, /period\.user_id = v_user_id/);
assert.match(migration, /grant execute on function public\.pause_subscription\([\s\S]*to authenticated/);
assert.match(migration, /revoke all on function public\.pause_subscription\([\s\S]*from public, anon/);
const pauseFunction = migration.slice(migration.indexOf('create or replace function public.pause_subscription'));
assert.doesNotMatch(pauseFunction.slice(0, pauseFunction.indexOf('revoke all on function public.pause_subscription')), /billing_transactions|billing_renewal_activity/);

assert.match(lifecycleFoundation, /revoke insert, update, delete on table public\.subscription_lifecycle_events from authenticated/);
assert.match(renewalFoundation, /revoke insert, update, delete on table public\.billing_renewal_periods from authenticated/);
assert.match(renewalActivity, /revoke insert, update, delete on table public\.billing_renewal_activity from authenticated/);

for (const requirement of [
  'new, dedicated Auth user',
  'REPLACE_WITH_DELIVERABLE_AUTH_EMAIL',
  'The relationship column is `plan`, not `plan_status`',
  'RPC-materialised renewal-period IDs are generated operational IDs',
  'privileged manual execution in Supabase SQL Editor',
  'Network ambiguity after Confirm',
  'Do not delete an Auth user until public cleanup has passed',
  'Checkpoint 2A: save the pre-fixture non-fixture baseline',
  "fixture_stage = 'paused'",
]) assert.match(proposal, new RegExp(requirement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

console.log('PASS: A5.1 fixture plan uses a dedicated user, exact ownership, read-only checks, guarded writes, generated-ID capture, and ordered fail-closed cleanup.');
