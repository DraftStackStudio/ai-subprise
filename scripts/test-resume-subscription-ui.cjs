// Focused Resume UI, payment, and lifecycle read-model checks. No database,
// browser, fixture, baseline, or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadTypeScript(file, mocks = {}) {
  const filename = path.join(root, file);
  const source = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (request) => mocks[request] ?? require(request);
  loaded._compile(source, filename);
  return loaded.exports;
}

const activity = loadTypeScript('lib/subscriptionLifecycleActivity.ts', {
  '@/lib/billingHistory': { billingHistoryDisplayDate: (value) => `date:${value}` },
});
const events = [
  {
    id: 'pause-1', relationshipId: 'relationship-1', eventKind: 'paused', effectiveDate: '2026-09-30',
    reason: 'Budget review', plannedResumeDate: '2026-10-31', amountSnapshot: '30',
    billingTypeSnapshot: 'Monthly', currencySnapshot: 'SGD', planNameSnapshot: 'Pro', previousPlanName: 'Pro',
  },
  {
    id: 'resume-1', relationshipId: 'relationship-1', eventKind: 'resumed', effectiveDate: '2026-10-15',
    nextRenewalDateSnapshot: '2026-11-15', amountSnapshot: '31', billingTypeSnapshot: 'Monthly',
    currencySnapshot: 'SGD', planNameSnapshot: 'Pro', previousPlanName: 'Pro',
  },
  { id: 'other', relationshipId: 'relationship-2', eventKind: 'resumed', effectiveDate: '2026-10-15' },
];
const merged = activity.mergeSubscriptionLifecycleHistory([
  { id: 'legacy-pause', date: '2026-09-30', event: 'Paused', saved: true },
  { id: 'legacy-resume', date: '2026-10-15', event: 'Resumed', saved: true },
  { id: 'payment', date: '2026-10-15', event: 'Payment', saved: true },
], events, 'relationship-1');
assert.equal(merged.filter((entry) => entry.event === 'Paused').length, 1);
assert.equal(merged.filter((entry) => entry.event === 'Resumed').length, 1);
assert.equal(merged.filter((entry) => entry.event === 'Payment').length, 1);
assert.equal(merged.find((entry) => entry.event === 'Resumed').id, 'lifecycle-resume-resume-1');
assert.equal(merged.find((entry) => entry.event === 'Resumed').note, 'Next renewal: date:2026-11-15');
const unknown = activity.resumeLifecycleHistoryEntries([{ ...events[1], id: 'resume-2', nextRenewalDateSnapshot: '' }], 'relationship-1');
assert.equal(unknown[0].note, 'Next renewal needs review');

const modal = read('components/ResumeSubscriptionModal.tsx');
const account = read('components/SubscriptionAccountView.tsx');
const page = read('app/dashboard/page.tsx');
const styles = read('app/globals.css');
assert.match(modal, /First, resume with the AI provider/);
assert.match(modal, /<div className="form-field"><span>Next renewal date<\/span><DateFieldControl/);
assert.doesNotMatch(modal, /<label className="form-field"><span>Next renewal date<\/span><DateFieldControl/);
assert.match(modal, /<label className="subscription-resume-confirm-suggestion"><input checked=\{draft\.nextRenewalConfirmed\} disabled=\{busy\} onChange=\{\(event\) => patch\(\{ nextRenewalConfirmed: event\.target\.checked \}\)\} type="checkbox" \/>/);
assert.match(modal, /<span>Confirm renewal date<\/span>/);
assert.match(modal, /nextRenewalMode: "manual"/);
assert.match(modal, /Next renewal needs review/);
assert.match(modal, /Resume never creates a payment automatically/);
assert.match(modal, /const result = await onResume/);
assert.match(modal, /if \(draft\.chargeAnswer === "yes"\)/);
assert.match(modal, /The payment has not been recorded yet/);
assert.match(modal, /await onRecordPayment\(resumeResult\.lifecycleEventId/);
assert.match(modal, /The subscription was resumed, but the payment was not recorded/);
assert.match(account, /setResumeContext\(\{ pauseEvent: currentPauseEvent, retiredComponent: retiredResumeComponent \}\)/);
assert.match(account, /onRecordResumePayment/);
assert.match(account, /Resume subscription/);
assert.match(page, /await resumeSubscription\(relationshipId, pauseEventId, requestId, input, localBillingToday\(\)\)/);
assert.match(page, /resumePaymentSourceKey\(lifecycleEventId\)/);
assert.match(page, /const existing = latest\.find\(\(transaction\) => transaction\.sourceKey === sourceKey\)/);
assert.match(page, /matchesResumePayment\(/);
assert.match(page, /if \(!samePayment\(existing\)\) throw new Error/);
assert.match(page, /if \(!samePayment\(transaction\)\) throw new Error/);
assert.match(page, /Use Resume Subscription to reactivate a paused subscription/);
assert.doesNotMatch(page, /currentDetail\.status === "Paused" && status === "Active"[\s\S]{0,500}advanceRecurringChargeDate/);
assert.match(styles, /\.subscription-resume-modal/);
assert.match(styles, /\.subscription-resume-confirm-suggestion input \{[^}]*accent-color: var\(--accent\)/);
assert.match(styles, /\.subscription-resume-confirm-suggestion input:focus-visible \{[^}]*outline: 2px solid/);
assert.match(styles, /\.subscription-resume-confirm-suggestion \{[^}]*margin: 8px 0/);
assert.doesNotMatch(styles, /\.subscription-resume-confirm-suggestion[^\n]*var\(--gold\)/);

for (const file of ['scripts/preflight-resume-subscription.sql', 'scripts/verify-resume-subscription-foundation.sql']) {
  const sql = read(file).replace(/--.*$/gm, '').trim().toLowerCase();
  assert.match(sql, /^with\b/);
  assert.doesNotMatch(sql, /\b(insert|update|delete|truncate|alter|create|drop|grant|revoke|call|perform)\b/);
  assert.doesNotMatch(sql, /\bresume_subscription\s*\([^)]*\)\s*(?:;|,)/);
}

console.log('PASS: Resume modal, payment separation, ledger activity, and read-only verification contracts.');
