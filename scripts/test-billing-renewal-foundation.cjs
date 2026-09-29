const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadTypeScript(file) {
  const filename = path.join(root, file);
  const source = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(source, filename);
  return loaded.exports;
}

const {
  dueRenewalDates,
  nextRenewalAfterResolution,
  renewalDateFromAnchor,
  renewalSequenceIndex,
  unresolvedOverdueRenewalPeriods,
} = loadTypeScript('lib/renewalPeriods.ts');

assert.equal(renewalDateFromAnchor('2026-01-31', 'Monthly', 0), '2026-01-31');
assert.equal(renewalDateFromAnchor('2026-01-31', 'Monthly', 1), '2026-02-28');
assert.equal(renewalDateFromAnchor('2026-01-31', 'Monthly', 2), '2026-03-31');
assert.equal(renewalDateFromAnchor('2026-01-31', 'Monthly', 3), '2026-04-30');
assert.equal(renewalDateFromAnchor('2024-02-29', 'Yearly', 1), '2025-02-28');
assert.equal(renewalDateFromAnchor('2024-02-29', 'Yearly', 4), '2028-02-29');
assert.equal(renewalSequenceIndex('2026-01-31', 'Monthly', '2026-03-31'), 2);
assert.equal(renewalSequenceIndex('2026-01-31', 'Monthly', '2026-03-28'), null);
assert.throws(() => renewalDateFromAnchor('2026-99-99', 'Monthly', 1));

assert.deepEqual(
  dueRenewalDates('2026-07-06', '2026-07-06', 'Monthly', '2026-09-29'),
  ['2026-07-06', '2026-08-06', '2026-09-06'],
);
assert.deepEqual(dueRenewalDates('2026-09-29', '2026-09-29', 'Monthly', '2026-09-29'), []);
assert.deepEqual(dueRenewalDates('2027-02-28', '2027-02-28', 'Yearly', '2029-02-28'), ['2027-02-28', '2028-02-28']);

const periods = [
  { scheduledRenewalDate: '2026-07-06', resolution: null },
  { scheduledRenewalDate: '2026-08-06', resolution: 'paid' },
  { scheduledRenewalDate: '2026-09-06', resolution: 'not_charged' },
];
assert.equal(nextRenewalAfterResolution('2026-07-06', 'Monthly', periods), '2026-07-06');
assert.equal(nextRenewalAfterResolution('2026-07-06', 'Monthly', periods.map((period) => ({ ...period, resolution: period.resolution ?? 'paid' }))), '2026-10-06');
assert.equal(nextRenewalAfterResolution('2026-07-06', 'Monthly', periods.map((period) => ({ ...period, resolution: period.scheduledRenewalDate === '2026-09-06' ? null : 'paid' }))), '2026-09-06');
assert.equal(nextRenewalAfterResolution('2024-02-29', 'Yearly', [
  { scheduledRenewalDate: '2024-02-29', resolution: 'paid' },
  { scheduledRenewalDate: '2025-02-28', resolution: 'not_charged' },
]), '2026-02-28');

assert.deepEqual(
  unresolvedOverdueRenewalPeriods([
    { id: 'future', scheduledRenewalDate: '2026-10-01', resolution: null },
    { id: 'today', scheduledRenewalDate: '2026-09-29', resolution: null },
    { id: 'resolved', scheduledRenewalDate: '2026-07-01', resolution: 'paid' },
    { id: 'older', scheduledRenewalDate: '2026-07-29', resolution: null },
    { id: 'newer', scheduledRenewalDate: '2026-08-29', resolution: null },
  ], '2026-09-29').map((period) => period.id),
  ['older', 'newer'],
);

const migration = read('supabase/migrations/0027_add_billing_renewal_periods.sql');
const sql = migration.toLowerCase();
const between = (start, end) => sql.slice(sql.indexOf(start), sql.indexOf(end));
const dashboardPage = read('app/dashboard/page.tsx');
const dashboardSummary = read('components/DashboardSummaryView.tsx');

assert.match(dashboardPage, /syncDueBillingRenewalPeriods\([\s\S]*?today,/);
assert.match(dashboardPage, /getBillingRenewalPeriodsByRelationship/);
assert.match(dashboardPage, /periodId: period\.id/);
assert.match(dashboardPage, /if \(item\.kind === "renewal"\) return <span className="linked-status-readonly">\{item\.statusLabel\}<\/span>/);
assert.doesNotMatch(dashboardPage, /import \{[^}]*confirmBillingRenewalPaid/);
assert.doesNotMatch(dashboardPage, /import \{[^}]*markBillingRenewalNotCharged/);
assert.doesNotMatch(dashboardPage, /import \{[^}]*undoBillingRenewalResolution/);
assert.match(dashboardSummary, /key=\{item\.periodId \?\? item\.itemId\}/);
assert.doesNotMatch(dashboardSummary, /actionNeededItems\.slice/);

assert(sql.includes('create table if not exists public.billing_renewal_periods'));
assert(sql.includes('unique (tool_email_link_id, billing_component_id, scheduled_renewal_date)'));
assert(sql.includes("resolution is null or resolution in ('paid', 'not_charged')"));
assert(sql.includes('payment_transaction_id uuid unique references public.billing_transactions(id) on delete restrict'));
assert(sql.includes('add column if not exists recurrence_anchor_date date'));
assert(!sql.includes('set recurrence_anchor_date = next_renewal_date;')); // No migration-time data rewrite.
assert(sql.includes("source in ('manual', 'renewal', 'legacy_json', 'api')"));
assert.equal((sql.match(/and source = 'manual'/g) ?? []).length, 3);

assert(sql.includes('create or replace function public.sync_due_billing_renewal_periods'));
assert(sql.includes('on conflict (tool_email_link_id, billing_component_id, scheduled_renewal_date) do nothing'));
assert(sql.includes('create or replace function public.confirm_billing_renewal_paid'));
assert(sql.includes('create or replace function public.mark_billing_renewal_not_charged'));
assert(sql.includes('create or replace function public.undo_billing_renewal_resolution'));
assert.equal((sql.match(/insert into public\.billing_transactions/g) ?? []).length, 1);
assert(sql.includes("'renewal-period:' || p_period_id::text"));
assert(sql.includes("'renewal',\n    'renewal-period:'"));
assert(sql.includes("transaction.source_key = 'renewal-period:' || p_period_id::text"));
assert(sql.includes('transaction.tool_email_link_id = p_relationship_id'));
assert(sql.includes('period.tool_email_link_id = p_relationship_id'));
assert.equal((sql.match(/for update of period, component, link/g) ?? []).length, 3);

const notCharged = between(
  'create or replace function public.mark_billing_renewal_not_charged',
  'create or replace function public.undo_billing_renewal_resolution',
);
assert(!notCharged.includes('insert into public.billing_transactions'));
assert(notCharged.includes("resolution = 'not_charged'"));

const recalculate = between(
  'create or replace function public.recalculate_billing_next_renewal',
  'create or replace function public.sync_due_billing_renewal_periods',
);
assert(!recalculate.includes('current_date'));
assert(recalculate.includes('min(period.scheduled_renewal_date)'));
assert(recalculate.includes('max(period.scheduled_renewal_date)'));
assert(recalculate.includes('set next_renewal_date = v_next_date'));

const undo = between(
  'create or replace function public.undo_billing_renewal_resolution',
  'create or replace function public.reset_ai_tools_clean_slate',
);
assert(undo.includes('set actual_payment_date = null'));
assert(undo.includes('delete from public.billing_transactions as transaction'));
assert(undo.includes('if v_deleted <> 1 then raise exception'));

const reset = between(
  'create or replace function public.reset_ai_tools_clean_slate',
  'revoke all on function public.set_billing_renewal_period_updated_at',
);
assert(reset.indexOf('delete from public.billing_renewal_periods') < reset.indexOf('delete from public.billing_transactions'));
assert(reset.indexOf('delete from public.billing_transactions') < reset.indexOf('delete from public.ai_tools'));

console.log('PASS: renewal cadence, overdue generation, contiguous advancement, SQL uniqueness, exact relationship guards, atomic resolution contracts, and Undo isolation.');
