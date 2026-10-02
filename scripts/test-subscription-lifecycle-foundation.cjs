// Focused source-contract checks; no database, browser, or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const migration = read('supabase/migrations/0030_add_subscription_lifecycle_foundation.sql');
const sql = migration.toLowerCase();

assert.match(sql, /^-- phase 2b1/);
assert(sql.includes('begin;') && sql.trimEnd().endsWith('commit;'));
assert(sql.includes('create table if not exists public.subscription_lifecycle_events'));
for (const value of ['paused', 'ended', 'resumed', 'restarted', 'restarted_plan_changed']) {
  assert(sql.includes(`'${value}'`));
}
for (const value of ['active', 'on a break', 'goodbye']) assert(sql.includes(`'${value}'`));
assert(sql.includes('subscription_lifecycle_events_transition_check'));
assert(sql.includes('subscription_lifecycle_events_planned_pair_check'));
assert(sql.includes("planned_resume_date is null or event_kind = 'paused'"));
assert(sql.includes('previous_billing_component_id uuid references public.tool_link_billing_components(id) on delete set null'));
assert(sql.includes('new_billing_component_id uuid references public.tool_link_billing_components(id) on delete set null'));
assert(sql.includes('on public.subscription_lifecycle_events for select'));
assert(sql.includes('using (auth.uid() = user_id)'));
assert(sql.includes('revoke insert, update, delete on table public.subscription_lifecycle_events from authenticated'));
assert(sql.includes('revoke all on table public.subscription_lifecycle_events from anon'));
assert(!sql.includes('insert into public.subscription_lifecycle_events'));

assert(sql.includes('add column if not exists excluded_at timestamptz'));
assert(sql.includes('add column if not exists excluded_by_lifecycle_event_id uuid'));
assert(sql.includes('(excluded_at is null) = (excluded_by_lifecycle_event_id is null)'));
assert(sql.includes('check (resolution is null or excluded_at is null)'));
assert(sql.includes('on delete no action deferrable initially deferred'));
assert(sql.includes('where resolution is null and excluded_at is null'));
assert(!sql.includes('set excluded_at ='));
const lifecycleTable = sql.indexOf('create table if not exists public.subscription_lifecycle_events');
const exclusionColumns = sql.indexOf('add column if not exists excluded_at timestamptz');
const exclusionConstraint = sql.indexOf('constraint billing_renewal_periods_exclusion_pair_check');
const exclusionForeignKey = sql.indexOf('constraint billing_renewal_periods_excluded_event_fkey');
const exclusionIndex = sql.indexOf('create index if not exists billing_renewal_periods_reviewable_idx');
const exclusionFunctionReference = sql.indexOf('period.excluded_at', sql.indexOf('create or replace function public.confirm_billing_renewal_paid'));
assert(lifecycleTable >= 0 && exclusionForeignKey > lifecycleTable, 'The lifecycle table must exist before the exclusion foreign key.');
for (const dependency of [exclusionConstraint, exclusionForeignKey, exclusionIndex, exclusionFunctionReference]) {
  assert(exclusionColumns >= 0 && dependency > exclusionColumns, 'Exclusion columns must be added before every dependent statement.');
}

assert(sql.includes('add column if not exists retired_at timestamptz'));
const retiredAtColumn = sql.indexOf('add column if not exists retired_at timestamptz');
const retiredAtBackfill = sql.indexOf('update public.tool_link_billing_components as component\nset retired_at = clock_timestamp()');
const retiredAtConstraint = sql.indexOf('constraint tool_link_billing_components_retired_type_check');
const retiredAtIndex = sql.indexOf('create unique index if not exists tool_link_billing_components_current_recurring_uidx');
const retiredAtFunctionReference = sql.indexOf('component.retired_at', sql.indexOf('create or replace function public.recalculate_billing_next_renewal'));
for (const dependency of [retiredAtBackfill, retiredAtConstraint, retiredAtIndex, retiredAtFunctionReference]) {
  assert(retiredAtColumn >= 0 && dependency > retiredAtColumn, 'retired_at must be added before every dependent statement.');
}
assert(sql.includes("check (retired_at is null or billing_type in ('monthly', 'yearly'))"));
assert(sql.includes('drop constraint if exists tool_link_billing_components_unique_type'));
assert(sql.includes('tool_link_billing_components_current_recurring_uidx'));
assert(sql.includes("where billing_type in ('monthly', 'yearly') and retired_at is null"));
assert(sql.includes('tool_link_billing_components_non_recurring_uidx'));
assert(sql.includes("where billing_type in ('lifetime', 'one-time', 'top-up')"));
assert(sql.includes('having count(*) > 1'));
assert(sql.includes("'active', 'running', 'on a break'"));
assert(sql.includes('migration 0030 found an unsupported lifecycle value'));
assert((sql.match(/retired_at is null\n  and exists/g) ?? []).length >= 4);
assert(sql.includes('on public.tool_link_billing_components for insert'));
assert(sql.includes('on public.tool_link_billing_components for update'));
assert(sql.includes('on public.tool_link_billing_components for delete'));

const sync = sql.slice(sql.indexOf('create or replace function public.sync_due_billing_renewal_periods'), sql.indexOf('create or replace function public.confirm_billing_renewal_paid'));
assert(sync.includes('component.retired_at is null'));
assert(sync.includes('billing_renewal_date_from_anchor'));

const confirm = sql.slice(sql.indexOf('create or replace function public.confirm_billing_renewal_paid'), sql.indexOf('create or replace function public.mark_billing_renewal_not_charged'));
assert(confirm.match(/excluded_at is null/g).length >= 2);
assert(confirm.includes('p_relationship_id'));
assert(confirm.includes('p_period_id'));

const notCharged = sql.slice(sql.indexOf('create or replace function public.mark_billing_renewal_not_charged'), sql.indexOf('create or replace function public.update_billing_renewal_period_snapshot'));
assert(notCharged.match(/excluded_at is null/g).length >= 2);
assert(notCharged.includes('recalculate_billing_next_renewal'));

const correction = sql.slice(sql.indexOf('create or replace function public.update_billing_renewal_period_snapshot'), sql.indexOf('-- reassert the existing permissions'));
assert(correction.match(/excluded_at is null/g).length >= 4);
assert(correction.includes('v_component_retired_at is null'));
assert(correction.includes('scheduled_renewal_date > v_scheduled_date'));
assert(!correction.includes('set scheduled_renewal_date'));

const recalculate = sql.slice(sql.indexOf('create or replace function public.recalculate_billing_next_renewal'), sql.indexOf('create or replace function public.sync_due_billing_renewal_periods'));
assert(recalculate.includes('if v_retired_at is not null'));
assert(recalculate.includes('component.retired_at is null'));
assert(recalculate.indexOf('if v_retired_at is not null') < recalculate.indexOf('update public.tool_email_links'));

const tools = read('lib/supabase/tools.ts');
assert.match(tools, /component\.retired_at === null \|\| component\.retired_at === undefined/);
assert.match(tools, /\.select\("id,billing_type,retired_at"\)/);
assert.match(tools, /\.is\("retired_at", null\)/);
assert.match(tools, /missingRetirementColumn[\s\S]*Compatibility only while migration 0030 is intentionally unapplied/);
assert(tools.indexOf('.select("id,billing_type,retired_at")') < tools.indexOf('.upsert(components, { onConflict: "tool_email_link_id,billing_type" })'));
assert(tools.indexOf('const stored = (storedRows ?? [])') > tools.indexOf('.upsert(components, { onConflict: "tool_email_link_id,billing_type" })'));

const types = read('types/billingRenewalPeriod.ts');
assert.match(types, /excludedAt: string/);
assert.match(types, /excludedByLifecycleEventId: string/);

const mapper = read('lib/supabase/billingRenewalPeriods.ts');
assert.match(mapper, /excludedAt: text\(record\.excluded_at\)/);
assert.match(mapper, /excludedByLifecycleEventId: text\(record\.excluded_by_lifecycle_event_id\)/);

const helpers = read('lib/renewalPeriods.ts');
assert.match(helpers, /excludedAt\?: string/);
assert((helpers.match(/!period\.excludedAt/g) ?? []).length >= 3);

const harness = read('scripts/test-subscription-lifecycle-foundation.sql').toLowerCase();
assert(harness.trimStart().startsWith('-- manual rollback-only verification'));
assert(harness.includes('begin;'));
assert(harness.trimEnd().endsWith('rollback;'));
for (const expected of [
  'retired component sync unexpectedly succeeded',
  'confirm paid accepted an excluded period',
  'not charged accepted an excluded period',
  'billing date correction accepted an excluded period',
  'historical decision overwrote the current cadence',
  'historical correction rewrote a component or relationship cadence',
  'current monthly component did not preserve month-end cadence',
  'current yearly component did not preserve leap-year cadence',
  'invalid lifecycle transition was accepted',
  'second current recurring component was accepted',
  'duplicate non-recurring component was accepted',
]) assert(harness.includes(expected));

const postcheck = read('scripts/verify-subscription-lifecycle-foundation.sql').toLowerCase();
assert(postcheck.trimStart().startsWith('-- strictly read-only post-migration verification'));
assert(postcheck.includes('migration_0030_postcheck_passed'));
assert(postcheck.includes('baseline.renewal_period_count >= 8'));
assert(postcheck.includes('retained.jan_aug_baseline_preserved'));
assert(postcheck.includes('retained.current_billing_progression_is_consistent'));
assert(postcheck.includes('retained.audit_history_is_valid'));
assert(postcheck.includes('component.recurrence_anchor_date is not null'));
assert(postcheck.includes('component.next_renewal_date = make_date('));
assert(postcheck.includes('extract(day from component.recurrence_anchor_date)'));
assert(!postcheck.includes('baseline.renewal_period_count = 8'));
assert(!postcheck.includes('baseline.renewal_activity_count = 0'));
assert(!postcheck.includes("component.recurrence_anchor_date = date '"));
assert(!postcheck.includes("next_renewal_date = date '2026-09-30'"));
assert(!postcheck.includes("next_renewal_date = date '2026-10-31'"));
assert(!/^\s*(insert|update|delete|alter|create|drop|grant|revoke|perform)\b/im.test(postcheck));
assert(!/\b(select|perform|call)\s+(?:public\.)?(sync_due_billing_renewal_periods|confirm_billing_renewal_paid|mark_billing_renewal_not_charged|undo_billing_renewal_resolution|update_billing_renewal_period_snapshot|update_billing_renewal_payment)\s*\(/i.test(postcheck));

const decisionHarness = read('scripts/test-billing-renewal-decision-contracts.sql').trim().toLowerCase();
const checkpoint3dHarness = read('scripts/test-billing-renewal-checkpoint-3d.sql').trim().toLowerCase();
for (const existingHarness of [decisionHarness, checkpoint3dHarness]) {
  assert(existingHarness.includes('begin;'));
  assert(existingHarness.endsWith('rollback;'));
}

const resetMigration = read('supabase/migrations/0027_add_billing_renewal_periods.sql').toLowerCase();
const resetFunction = resetMigration.slice(resetMigration.lastIndexOf('create or replace function public.reset_ai_tools_clean_slate'));
assert(resetFunction.indexOf('delete from public.billing_renewal_periods') < resetFunction.indexOf('delete from public.billing_transactions'));
assert(resetFunction.indexOf('delete from public.billing_transactions') < resetFunction.indexOf('delete from public.ai_tools'));

console.log('PASS: 0030 lifecycle foundation, logical exclusion, recurring versioning, guarded renewal RPCs, and persistence compatibility contracts.');
