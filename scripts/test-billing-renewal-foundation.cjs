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
const decisionMigration = read('supabase/migrations/0028_add_billing_renewal_decision_contracts.sql');
const decisionSql = decisionMigration.toLowerCase();
const decisionBetween = (start, end) => decisionSql.slice(decisionSql.indexOf(start), decisionSql.indexOf(end));
const decisionDatabaseTest = read('scripts/test-billing-renewal-decision-contracts.sql').toLowerCase();
const decisionRepair = read('scripts/repair-0028-update-billing-renewal-payment.sql').toLowerCase();
const renewalClient = read('lib/supabase/billingRenewalPeriods.ts');
const renewalTypes = read('types/billingRenewalPeriod.ts');
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

assert(decisionSql.includes('add column if not exists not_charged_reason_code text'));
assert(decisionSql.includes('\nbegin;'));
assert(decisionSql.trimEnd().endsWith('commit;'));
assert(decisionSql.includes('add column if not exists not_charged_reason_text text'));
assert(decisionSql.includes('add column if not exists not_charged_note text'));
for (const reason of ['cancelled_subscription', 'payment_failed', 'paused', 'free_or_waived', 'other']) {
  assert(decisionSql.includes(`'${reason}'`));
  assert(renewalTypes.includes(`"${reason}"`));
}
assert(decisionSql.includes("not_charged_reason_code = 'other'"));
assert(decisionSql.includes("nullif(btrim(not_charged_reason_text), '') is not null"));
assert(decisionSql.includes("not_charged_reason_code <> 'other'"));
assert(decisionSql.includes('not_charged_reason_text is null'));

const confirmPaid = decisionBetween(
  'create or replace function public.confirm_billing_renewal_paid',
  'drop function if exists public.mark_billing_renewal_not_charged',
);
assert(confirmPaid.includes('set actual_payment_date = v_scheduled_date'));
assert(confirmPaid.includes('v_user_id, p_relationship_id, v_tool_id, v_login_id, v_scheduled_date'));
assert(!confirmPaid.includes('p_actual_payment_date'));
assert(confirmPaid.includes('v_amount, v_currency'));
assert(confirmPaid.includes("'renewal-period:' || p_period_id::text"));
assert(decisionSql.includes('drop function if exists public.confirm_billing_renewal_paid(uuid, uuid, date)'));
const confirmPaidClient = renewalClient.slice(
  renewalClient.indexOf('export async function confirmBillingRenewalPaid'),
  renewalClient.indexOf('export async function markBillingRenewalNotCharged'),
);
assert.doesNotMatch(confirmPaidClient, /p_actual_payment_date|actualPaymentDate/);

const guardedNotCharged = decisionBetween(
  'create or replace function public.mark_billing_renewal_not_charged',
  'create or replace function public.update_billing_renewal_period_snapshot',
);
assert(guardedNotCharged.includes("raise exception 'select a valid not charged reason.'"));
assert(guardedNotCharged.includes("raise exception 'enter a reason when other is selected.'"));
assert(guardedNotCharged.includes('not_charged_note = v_note'));
assert(!guardedNotCharged.includes('insert into public.billing_transactions'));
assert(decisionSql.includes('drop function if exists public.mark_billing_renewal_not_charged(uuid, uuid)'));

const snapshotUpdate = decisionBetween(
  'create or replace function public.update_billing_renewal_period_snapshot',
  'create or replace function public.update_billing_renewal_payment',
);
assert(snapshotUpdate.includes('period.id = p_period_id'));
assert(snapshotUpdate.includes('period.tool_email_link_id = p_relationship_id'));
assert(snapshotUpdate.includes('period.resolution is null'));
assert(snapshotUpdate.includes('set plan_name_snapshot ='));
assert(snapshotUpdate.includes('currency_snapshot = v_currency'));
assert(snapshotUpdate.includes('amount_snapshot = p_amount'));
assert(!snapshotUpdate.includes('p_billing_type'));
assert(!snapshotUpdate.includes('p_scheduled_renewal_date'));
assert(!snapshotUpdate.includes('set billing_type_snapshot'));
assert(!snapshotUpdate.includes('set scheduled_renewal_date'));

const paymentUpdate = decisionBetween(
  'create or replace function public.update_billing_renewal_payment',
  'create or replace function public.undo_billing_renewal_resolution',
);
assert(paymentUpdate.includes('period.payment_transaction_id = p_payment_transaction_id'));
assert(paymentUpdate.includes('transaction.tool_email_link_id = p_relationship_id'));
assert(paymentUpdate.includes("transaction.source = 'renewal'"));
assert(paymentUpdate.includes("transaction.source_key = 'renewal-period:' || p_period_id::text"));
assert(paymentUpdate.includes("raise exception 'payment date cannot be in the future.'"));
assert(paymentUpdate.includes('set actual_payment_date = p_payment_date'));
assert(paymentUpdate.includes('set payment_date = p_payment_date'));
assert(paymentUpdate.includes('update public.billing_renewal_periods as period'));
assert(paymentUpdate.includes('and period.payment_transaction_id = p_payment_transaction_id;'));
assert(paymentUpdate.includes('update public.billing_transactions as transaction'));
assert.doesNotMatch(paymentUpdate, /\band payment_transaction_id = p_payment_transaction_id;/);
assert(paymentUpdate.includes('if v_period_rows <> 1 or v_transaction_rows <> 1'));
assert(!paymentUpdate.includes('plan_name_snapshot ='));
assert(!paymentUpdate.includes('billing_type_snapshot ='));
assert(decisionRepair.includes('create or replace function public.update_billing_renewal_payment'));
assert(decisionRepair.includes('update public.billing_renewal_periods as period'));
assert(decisionRepair.includes('and period.payment_transaction_id = p_payment_transaction_id;'));
assert(decisionRepair.includes('update public.billing_transactions as transaction'));
assert.doesNotMatch(decisionRepair, /\band payment_transaction_id = p_payment_transaction_id;/);
assert.doesNotMatch(decisionRepair, /\b(insert|delete|alter|drop|truncate)\b/);

const guardedUndo = decisionBetween(
  'create or replace function public.undo_billing_renewal_resolution',
  '-- keep direct mutation protection',
);
assert(guardedUndo.includes('not_charged_reason_code = null'));
assert(guardedUndo.includes('not_charged_reason_text = null'));
assert(guardedUndo.includes('not_charged_note = null'));
assert(guardedUndo.includes('transaction.id = v_payment_id'));
assert(guardedUndo.includes('transaction.tool_email_link_id = p_relationship_id'));
assert(guardedUndo.includes("transaction.source_key = 'renewal-period:' || p_period_id::text"));
assert(guardedUndo.includes('if v_deleted <> 1 then raise exception'));

assert(decisionSql.includes('revoke insert, update, delete on table public.billing_renewal_periods from authenticated'));
assert(decisionSql.includes('grant execute on function public.update_billing_renewal_period_snapshot'));
assert(decisionSql.includes('grant execute on function public.update_billing_renewal_payment'));
assert(renewalClient.includes('p_amount: input.amount.trim() || null'));
assert(renewalClient.includes('p_local_date: localCalendarDate()'));
for (const contractCheck of [
  'other unexpectedly accepted a blank custom reason',
  'confirm paid substituted a value for an unknown amount',
  'out-of-order resolution skipped the earliest unresolved period',
  'a future payment date was unexpectedly accepted',
  'a relationship/period mismatch was unexpectedly accepted',
  'a period/transaction mismatch was unexpectedly accepted',
  'paid undo deleted another period',
  'retained test - renewal monthly fixture changed',
]) {
  assert(decisionDatabaseTest.includes(contractCheck));
}
for (const retainedDate of [
  '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
  '2026-05-31', '2026-06-30', '2026-07-31', '2026-08-31',
]) {
  assert(decisionDatabaseTest.includes(`date '${retainedDate}'`));
}
assert(decisionDatabaseTest.includes('eight expected unresolved periods from january through august 2026'));
assert(decisionDatabaseTest.includes('must still have zero renewal-generated payments'));
assert(decisionDatabaseTest.trimEnd().endsWith('rollback;'));

console.log('PASS: renewal cadence, overdue generation, 0028 reason contracts, scheduled-date confirmation, null amounts, exact snapshot/payment corrections, future-date rejection, and Undo isolation.');
