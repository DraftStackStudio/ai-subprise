// Focused source-contract checks for migration 0032; no database or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('supabase/migrations/0032_add_pause_subscription_contract.sql');
const sql = migration.toLowerCase();

const functionDefinition = (source, functionName) => {
  const start = source.indexOf(`create or replace function public.${functionName}(`);
  assert.notEqual(start, -1, `Missing ${functionName} definition.`);
  const end = source.indexOf('\n$$;', start);
  assert.notEqual(end, -1, `Unterminated ${functionName} definition.`);
  return source.slice(start, end + 4);
};

assert(sql.trimStart().startsWith('-- phase 2b2-a1'));
assert(sql.includes('begin;') && sql.trimEnd().endsWith('commit;'));
assert(sql.includes('create or replace function public.pause_subscription'));
assert(sql.includes('security definer'));
assert(sql.includes('set search_path = public'));
assert(sql.includes('p_request_id uuid'));
assert(sql.includes("p_effective_date_precision not in ('exact_date', 'month_only')"));
assert(sql.includes("p_planned_resume_precision not in ('exact_date', 'month_only')"));
assert(sql.includes('pause effective date cannot be in the future'));
assert(sql.includes('final calendar day of the month'));
assert(sql.includes('planned resume date must be later'));
assert(sql.includes("v_link.status <> 'active'"));
assert(sql.includes('v_link.unlinked_at is not null'));
assert(sql.includes("v_link.plan = 'trial'"));
assert(sql.includes("v_link.plan not in ('active', 'paid')"));
assert(sql.includes('for update'));
assert((sql.match(/pg_advisory_xact_lock\(hashtextextended\(p_relationship_id::text, 0\)\)/g) ?? []).length === 2);
assert((sql.match(/where event\.id = p_request_id/g) ?? []).length === 2);
assert(sql.includes("event_kind <> 'paused'"));
assert(sql.includes('was_already_applied boolean'));
assert(sql.includes('on conflict (\n          tool_email_link_id, billing_component_id, scheduled_renewal_date\n        ) do nothing'));
assert(sql.includes('billing_renewal_date_from_anchor'));
assert(sql.includes('billing_renewal_snapshot_amount'));
assert(sql.includes('coalesce(period.billing_date, period.scheduled_renewal_date) > p_effective_date'));
assert(sql.includes('period.resolution is null'));
assert(sql.includes('period.excluded_at is null'));
assert(sql.includes('set retired_at = v_changed_at'));
assert(sql.includes("set status = 'paused', next_charge_date = null"));
assert(sql.includes("'active',\n    'paused', 'paused'"));
assert(sql.includes('previous_billing_component_id'));
assert(sql.includes('planned_resume_date'));
assert(sql.includes('revoke all on function public.pause_subscription'));
assert(sql.includes('grant execute on function public.pause_subscription'));
assert(!sql.includes('insert into public.billing_transactions'));
assert(!sql.includes('update public.billing_transactions'));
assert(!sql.includes('delete from public.billing_transactions'));
assert(!sql.includes('delete from public.billing_renewal_periods'));
assert(!sql.includes('update public.billing_renewal_activity'));
assert(!sql.includes('insert into public.billing_renewal_activity'));

// Applying 0032 defines functions and permissions only. DML inside the stored
// function bodies is expected, but the migration itself must execute none.
const topLevelMigration = sql.replace(/as \$\$[\s\S]*?\$\$;/g, '');
assert(!/^\s*(insert|update|delete|truncate|alter table|create table|drop table|call|perform)\b/im.test(topLevelMigration));

// The existing sync RPC is replaced solely to take the same relationship lock
// used by Pause. Its already-verified 0030 behavior must otherwise be exact.
const sync0030 = functionDefinition(
  read('supabase/migrations/0030_add_subscription_lifecycle_foundation.sql').toLowerCase(),
  'sync_due_billing_renewal_periods',
);
const sync0032 = functionDefinition(sql, 'sync_due_billing_renewal_periods').replace(
  /\s*perform pg_advisory_xact_lock\(hashtextextended\(p_relationship_id::text, 0\)\);/,
  '',
);
assert.equal(sync0032, sync0030);

const migration0030 = read('supabase/migrations/0030_add_subscription_lifecycle_foundation.sql');
const migration0031 = read('supabase/migrations/0031_canonicalise_relationship_lifecycle_status.sql');
assert(migration0030.includes('subscription_lifecycle_events'));
assert(migration0031.includes("next_lifecycle_state = 'Paused'"));

const harness = read('scripts/test-pause-subscription-foundation.sql').toLowerCase();
assert(harness.trimStart().startsWith('-- rollback-only behavioural verification'));
assert(harness.includes('begin;') && harness.trimEnd().endsWith('rollback;'));
for (const expected of [
  'missing renewal periods were not materialised through the pause date',
  'a renewal period on the pause date was not kept reviewable',
  'future unresolved periods were not excluded',
  'a resolved future period was altered or excluded',
  'pause created or changed a payment',
  'idempotent retry duplicated the pause operation',
  'conflicting idempotency payload unexpectedly succeeded',
  'wrong-owner pause unexpectedly succeeded',
  'unresolved trial pause unexpectedly succeeded',
  'non-recurring billing components were changed',
  'yearly leap-day cadence was not materialised safely through pause',
]) assert(harness.includes(expected));
assert(harness.includes("set_config('request.jwt.claim.sub', 'b0320000-0000-0000-0000-000000000999'"));
assert(harness.includes("date '2024-02-29', 'month_only'"));
assert(harness.includes('retiring the recurring component altered its historical billing cadence or values'));

const preflight = read('scripts/preflight-pause-subscription.sql').toLowerCase();
const postcheck = read('scripts/verify-pause-subscription-foundation.sql').toLowerCase();
for (const readOnly of [preflight, postcheck]) {
  assert(!/^\s*(insert|update|delete|alter|create|drop|grant|revoke|perform|call)\b/im.test(readOnly));
  assert(!/\b(select|perform|call)\s+(?:public\.)?pause_subscription\s*\(/i.test(readOnly));
}
assert(preflight.includes('migration_0032_preflight_passed'));
assert(postcheck.includes('migration_0032_postcheck_passed'));
for (const fingerprint of [
  '98b4b03d7c80bce84e59c22ded43b50a',
  'cb4596e70a202d245296504a75813196',
  'e588711bf345b2666ddb831ad4c41265',
  '8b7fdae30260f2b277d26a1a7be667d8',
  '41ee3cb891a835b2b839793a43d82ca6',
  'd41d8cd98f00b204e9800998ecf8427e',
]) assert(postcheck.includes(fingerprint));
assert(postcheck.includes('baseline_preserved'));

console.log('PASS: 0032 atomic Pause Subscription migration and verification contracts.');
