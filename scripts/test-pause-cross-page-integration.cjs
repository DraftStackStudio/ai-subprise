// Focused Phase 2B2-A4 cross-page checks; no database, browser, or network access.
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
  '@/lib/billingHistory': { billingHistoryDisplayDate: (value) => value === '2026-10-31' ? '31 Oct 2026' : value },
});

const pauseEvent = {
  amountSnapshot: '0',
  billingTypeSnapshot: 'Monthly',
  createdAt: '2026-10-09T09:00:00Z',
  currencySnapshot: 'SGD',
  effectiveDate: '2026-09-30',
  effectiveDatePrecision: 'month_only',
  eventKind: 'paused',
  id: 'pause-1',
  newBillingComponentId: '',
  nextLifecycleState: 'Paused',
  planNameSnapshot: 'Pro',
  plannedResumeDate: '2026-10-31',
  plannedResumePrecision: 'month_only',
  previousBillingComponentId: 'component-1',
  previousLifecycleState: 'Active',
  previousPlanName: 'Pro Legacy',
  reason: 'Budget review',
  relationshipId: 'relationship-1',
  userId: 'user-1',
};

const entries = activity.pauseLifecycleHistoryEntries([
  pauseEvent,
  pauseEvent,
  { ...pauseEvent, id: 'other-relationship', relationshipId: 'relationship-2' },
  { ...pauseEvent, id: 'ended-1', eventKind: 'ended' },
], 'relationship-1');
assert.deepEqual(entries, [{
  amount: '0',
  billingType: 'Monthly',
  currency: 'SGD',
  date: '2026-09-30',
  event: 'Paused',
  id: 'lifecycle-pause-pause-1',
  note: 'Budget review · Planned resume: 31 Oct 2026',
  planName: 'Pro',
  saved: true,
  source: 'generated',
}]);

const merged = activity.mergePauseLifecycleHistory([
  { date: '2026-08-31', event: 'Plan Changed', id: 'plan-change', note: '', saved: true, source: 'generated' },
  { date: '2026-09-30', event: 'Paused', id: 'legacy-pause', note: 'Legacy duplicate', saved: true, source: 'generated' },
  { date: '2026-09-30', event: 'Charged', id: 'payment-history', note: '', saved: true, source: 'generated' },
], [pauseEvent, { ...pauseEvent, id: 'pause-2', reason: '', plannedResumeDate: '' }], 'relationship-1');
assert.equal(merged.filter((entry) => entry.event === 'Paused').length, 2, 'Each distinct ledger event must appear once.');
assert.equal(merged.some((entry) => entry.id === 'legacy-pause'), false, 'A same-date legacy Pause duplicate must be suppressed.');
assert.equal(merged.some((entry) => entry.id === 'plan-change'), true, 'Existing lifecycle history must remain intact.');
assert.equal(merged.some((entry) => entry.id === 'payment-history'), true, 'Payment history must remain intact.');

const sparse = activity.pauseLifecycleHistoryEntries([{ ...pauseEvent,
  amountSnapshot: '', billingTypeSnapshot: '', currencySnapshot: '', planNameSnapshot: '', previousPlanName: '', reason: '', plannedResumeDate: '',
}], 'relationship-1')[0];
assert.equal(sparse.amount, undefined);
assert.equal(sparse.planName, undefined);
assert.equal(sparse.note, '');

const page = read('app/dashboard/page.tsx');
const subscriptions = read('components/SubscriptionsView.tsx');
const subscriptionAccount = read('components/SubscriptionAccountView.tsx');
const billingDetails = read('components/BillingDetailsView.tsx');
const billingHistory = read('components/BillingHistoryPanel.tsx');
const renewalPeriods = read('lib/renewalPeriods.ts');

assert.match(page, /status: requireRelationshipLifecycleStatus\(detail\.status, detail\.relationshipId\)/);
assert.match(subscriptions, /const statuses = \["Active", "Paused", "Goodbye"\]/);
assert.match(page, /mergeSubscriptionLifecycleHistory\([\s\S]*detail\.relationshipId/);
assert.match(page, /mergeSubscriptionLifecycleHistory\([\s\S]*directoryAccount\.relationshipId/);
assert.match(page, /mergeSubscriptionLifecycleHistory\([\s\S]*account\.relationshipId/);
assert.match(page, /!isRelationshipRenewalEligible\(detail\.status\)/);
assert.match(page, /isRelationshipRenewalEligible\(detail\?\.status\)/);
assert.match(renewalPeriods, /period\.resolution === null && !period\.excludedAt/);
assert.match(subscriptionAccount, /"Last Billing Setup" : "Current Billing"/);
assert.match(subscriptionAccount, /<AccountActivityTable[\s\S]*lifecycleEvents=\{account\.lifecycleEvents\}/);
assert.match(read('lib/accountActivity.ts'), /paused: "Subscription paused"/);
assert.match(subscriptionAccount, /subscription-callout-tool/);
assert.match(subscriptionAccount, /subscription-callout-account/);
assert.match(subscriptionAccount, /subscription-callout-lifecycle/);
assert.match(subscriptionAccount, /subscription-callout-action/);
assert.match(subscriptionAccount, /<span className="tool-status-chip">\{account\.planName\.trim\(\)\}<\/span>/);
assert.match(billingDetails, /account\.status === "Active" && !account\.isHistorical/);
assert.match(billingDetails, /<AccountActivityTable[\s\S]*historicalEntries=\{account\.accountActivity\}/);
assert.match(billingHistory, /const activityEntries: BillingHistoryEntry\[\] = restoredDate/);
assert.match(billingHistory, /billingEvents=\{billingEvents\}[\s\S]*lifecycleEvents=\{lifecycleEvents\}/);
assert.match(billingHistory, /<AccountActivityTable[\s\S]*historicalEntries=\{activityEntries\}/);

console.log('PASS: Pause lifecycle activity is relationship-scoped, deduplicated, metadata-aware, and wired across Subscription and Billing views.');
