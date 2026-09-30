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

const { nextFutureRenewalFromAnchor, newestFirstUnresolvedRenewalPeriods } = loadTypeScript('lib/renewalPeriods.ts');
assert.equal(nextFutureRenewalFromAnchor('2026-01-31', 'Monthly', '2026-09-30'), '2026-09-30');
assert.equal(nextFutureRenewalFromAnchor('2026-01-31', 'Monthly', '2026-10-01'), '2026-10-31');
assert.equal(nextFutureRenewalFromAnchor('2024-02-29', 'Yearly', '2025-02-28'), '2025-02-28');
assert.equal(nextFutureRenewalFromAnchor('2024-02-29', 'Yearly', '2025-03-01'), '2026-02-28');
assert.deepEqual(newestFirstUnresolvedRenewalPeriods([
  { id: 'jan', billingDate: '2026-01-31', scheduledRenewalDate: '2026-01-31', resolution: null },
  { id: 'aug', billingDate: '2026-08-28', scheduledRenewalDate: '2026-08-31', resolution: null },
]).map((period) => period.id), ['aug', 'jan']);

const migration = read('supabase/migrations/0029_correct_renewal_schedule_and_activity.sql').toLowerCase();
const page = read('app/dashboard/page.tsx');
const subscriptions = read('components/SubscriptionsView.tsx');
const unconfirmed = read('components/UnconfirmedBillingSection.tsx');
const account = read('components/SubscriptionAccountView.tsx');
const toolbar = read('components/ListPageToolbar.tsx');

assert(migration.includes('add column if not exists billing_date date'));
assert(migration.includes('set billing_date = period.scheduled_renewal_date'));
assert(migration.includes('where period.billing_date is null'));
assert(migration.includes('scheduled_renewal_date, billing_date,'));
assert(migration.includes('p_billing_component_id, v_candidate, v_candidate,'));
assert(migration.includes('create table if not exists public.billing_renewal_activity'));
assert(migration.includes('billing_renewal_next_on_or_after'));
assert(migration.includes("v_next_date := public.billing_renewal_next_on_or_after(v_anchor, v_billing_type, v_as_of_date)"));
assert(migration.includes("p_date_scope not in ('period_only','this_and_future')"));
assert(migration.includes("future schedule changes cannot rewrite an already resolved billing period"));
assert(migration.includes("then 'billing_schedule_changed' else 'billing_period_corrected'"));
assert(migration.includes("'renewal payment corrected.'"));
assert(migration.includes('coalesce(period.billing_date, period.scheduled_renewal_date)'));
assert(migration.includes('amount_snapshot = p_amount,\n    billing_date = p_billing_date'));
assert(!migration.includes('min(period.scheduled_renewal_date)'));
assert(migration.includes('revoke insert, update, delete on table public.billing_renewal_activity from authenticated'));

for (const label of ['Subscriptions', 'Renewal Decision', 'Upcoming']) assert(subscriptions.includes(`"${label}"`));
assert.match(subscriptions, /BillingUpcomingView/);
assert.match(subscriptions, /count === 1 \? "period" : "periods"/);
assert.doesNotMatch(toolbar, /label: "Upcoming"/);
assert.match(page, /setSelectedSubscriptionView\("Upcoming"\)/);
assert.match(page, /setActiveSection\("subscriptions"\)/);
assert.match(page, /getBillingRenewalActivitiesByRelationship/);
assert.match(page, /previousStatus === "Goodbye" && nextStatus === "Active"[\s\S]*event: "Restarted"/);
assert.doesNotMatch(page, /3[- ]day|date[- ]gap/i);
assert.doesNotMatch(page, /renewalActivityPreview|showActivityPreview/);
assert.match(unconfirmed, />Billing Date</);
assert.match(unconfirmed, /This billing period only/);
assert.match(unconfirmed, /This and future billing periods/);
assert.match(unconfirmed, /Billing period Billing Type[\s\S]*disabled/);
for (const label of ['Payment confirmed', 'Payment not charged', 'Subscription cancelled', 'Subscription restarted', 'Billing details updated', 'Billing date updated', 'Plan changed']) {
  assert(account.includes(label));
}
assert.match(account, /compactActivityDetails/);
assert.match(account, /visibleLifecycleNote/);
assert.match(account, /combineSameDayCancellationRestart/);
assert.match(account, /Cancelled and restarted on the same day/);
assert.match(account, /candidate\.date === entry\.date[\s\S]*candidate\.lifecycleEvent === "Cancelled"/);
assert.match(account, /b\.date\.localeCompare\(a\.date\) \|\| b\.order - a\.order/);
assert.match(account, /entry\.kind === "billing_schedule_changed" \? "Billing date updated" : "Billing details updated"/);
assert.match(account, /period\.resolution === "paid" \? "Payment confirmed" : "Payment not charged"/);
assert.doesNotMatch(account, /title: period\.resolution === "paid" \? "Payment confirmed" : "Not charged"/);
assert.match(account, /renewalPeriodsById\.get\(entry\.periodId\)\?\.scheduledRenewalDate/);
assert.match(account, /subscription-activity-date/);
assert.doesNotMatch(account, /subscription-activity-emphasis/);
assert.doesNotMatch(account, /compactBillingDateChange/);
assert.doesNotMatch(account, /activityGroups/);
assert.doesNotMatch(account, /previewActivity|preview-payment|preview-not-charged/);

const styles = read('app/globals.css');
assert.match(styles, /\.subscription-activity-list li \{[^}]*grid-template-columns: 124px minmax\(0, 1fr\)/);
assert.match(styles, /\.subscription-account-view \.subscription-activity-date,\s*\.subscription-account-view \.subscription-activity-list strong \{[^}]*color: var\(--table-secondary-text\)/);
assert.match(styles, /\.subscription-activity-date \{[^}]*font-weight: 400/);
assert.match(styles, /\.subscription-activity-list strong \{[^}]*font-weight: 600/);
assert.match(styles, /\.subscription-activity-details span \+ span::before \{[^}]*content: "·";[^}]*margin: 0 6px/);
assert.doesNotMatch(styles, /\.subscription-activity-emphasis/);
assert.doesNotMatch(styles, /\.subscription-activity-event \+ \.subscription-activity-event/);

console.log('PASS: Checkpoint 3D future schedule, navigation, date-scope editing, activity, and isolation contracts.');
