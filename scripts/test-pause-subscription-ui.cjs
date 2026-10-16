// Focused Phase 2B2-A3 UI/client contract checks; no database, browser, or network access.
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
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (request) => mocks[request] ?? require(request);
  loaded._compile(source, filename);
  return loaded.exports;
}

const pause = loadTypeScript('lib/subscriptionPause.ts', {
  '@/lib/currentBilling': loadTypeScript('lib/currentBilling.ts'),
});
const dates = loadTypeScript('components/DateFieldControl.tsx', {
  react: { useRef: () => ({ current: null }) },
  'react/jsx-runtime': { jsx: () => null, jsxs: () => null },
});

assert.equal(pause.canPauseSubscription({ canManageBilling: true, lifecycleStatus: 'Active', planStatus: 'Paid' }), true);
for (const input of [
  { canManageBilling: false, lifecycleStatus: 'Active', planStatus: 'Paid' },
  { canManageBilling: true, lifecycleStatus: 'Paused', planStatus: 'Paid' },
  { canManageBilling: true, lifecycleStatus: 'Active', planStatus: 'Trial' },
]) assert.equal(pause.canPauseSubscription(input), false);

assert.equal(pause.resolveLifecycleDate('2024-02', 'month_only'), '2024-02-29');
assert.equal(pause.resolveLifecycleDate('2025-02', 'month_only'), '2025-02-28');
assert.equal(pause.resolveLifecycleDate('2026-10-09', 'exact_date'), '2026-10-09');
assert.equal(pause.resolveLifecycleDate('2026-02-30', 'exact_date'), '');
assert.equal(dates.formatBillingMonth(''), 'Select month');
assert.equal(dates.formatBillingMonth('2026-10'), 'October 2026');
assert.equal(dates.formatBillingMonth('2026-13'), 'Select month');

const base = {
  effectiveDate: '2026-09', effectiveDatePrecision: 'month_only', planningToResume: true,
  plannedResumeDate: '2026-10', plannedResumePrecision: 'month_only', reason: '  Budget review  ',
};
const valid = pause.validatePauseSubscriptionDraft(base, '2026-10-09');
assert.deepEqual(valid.errors, {});
assert.deepEqual(valid.input, {
  effectiveDate: '2026-09-30', effectiveDatePrecision: 'month_only',
  plannedResumeDate: '2026-10-31', plannedResumePrecision: 'month_only', reason: 'Budget review',
});
assert.equal(pause.validatePauseSubscriptionDraft({ ...base, effectiveDate: '' }, '2026-10-09').errors.effectiveDate, 'Enter a valid effective pause date.');
assert.equal(pause.validatePauseSubscriptionDraft({ ...base, effectiveDate: '2026-11' }, '2026-10-09').errors.effectiveDate, 'The effective pause date cannot be in the future.');
assert.equal(pause.validatePauseSubscriptionDraft({ ...base, plannedResumeDate: '2026-09' }, '2026-10-09').errors.plannedResumeDate, 'The planned resume date must be later than the effective pause date.');
assert.equal(pause.validatePauseSubscriptionDraft({ ...base, planningToResume: false }, '2026-10-09').input.plannedResumeDate, null);

const rpcCalls = [];
let rpcError = null;
const lifecycle = loadTypeScript('lib/supabase/subscriptionLifecycleEvents.ts', {
  '@/lib/supabase/client': { createClient: () => ({ rpc: async (...args) => {
    rpcCalls.push(args);
    return rpcError ? { data: null, error: rpcError } : { data: [{
      relationship_id: 'relationship-1', lifecycle_event_id: 'request-1', retired_billing_component_id: 'component-1',
      materialized_period_count: 2, excluded_period_count: 3, was_already_applied: false,
    }], error: null };
  } }) },
});

(async () => {
  const result = await lifecycle.pauseSubscription('relationship-1', 'request-1', valid.input, '2026-10-09');
  assert.equal(rpcCalls.length, 1);
  assert.deepEqual(rpcCalls[0], ['pause_subscription', {
    p_effective_date: '2026-09-30',
    p_effective_date_precision: 'month_only',
    p_local_date: '2026-10-09',
    p_planned_resume_date: '2026-10-31',
    p_planned_resume_precision: 'month_only',
    p_reason: 'Budget review',
    p_relationship_id: 'relationship-1',
    p_request_id: 'request-1',
  }]);
  assert.deepEqual(result, {
    excludedPeriodCount: 3, lifecycleEventId: 'request-1', materializedPeriodCount: 2,
    relationshipId: 'relationship-1', retiredBillingComponentId: 'component-1', wasAlreadyApplied: false,
  });
  rpcError = new Error('Only an Active relationship can be paused.');
  await assert.rejects(lifecycle.pauseSubscription('relationship-1', 'request-1', valid.input, '2026-10-09'), /Only an Active relationship/);

  const modal = read('components/PauseSubscriptionModal.tsx');
  const styles = read('app/globals.css');
  const accountView = read('components/SubscriptionAccountView.tsx');
  const payments = read('components/SubscriptionPayments.tsx');
  const page = read('app/dashboard/page.tsx');
  assert.match(modal, /if \(submitting\.current\) return;/);
  assert.match(modal, /submitting\.current = true;/);
  assert.match(modal, /submitting\.current = false;/);
  assert.match(modal, /setSubmitError\(error instanceof Error/);
  assert.match(modal, /await onConfirm\(requestId\.current, validation\.input\)/);
  assert.match(modal, /placeholder="e\.g\. Not using this service regularly"/);
  assert.doesNotMatch(modal, /—/);
  assert.match(modal, /aria-label="Close Pause Subscription" className="modal-close-button"/);
  assert.match(modal, /Pausing here won&apos;t stop charges from the AI provider\. Manage your subscription directly with them\./);
  assert.match(modal, /subscription-pause-info"><svg aria-hidden="true"/);
  assert.match(modal, /category-view-tab active/);
  assert.match(modal, /const \[openControlId, setOpenControlId\] = useState<string \| null>\(null\)/);
  assert.doesNotMatch(modal, /precisionOpen/);
  assert.match(modal, /isOpen=\{openControlId === precisionId\}/);
  assert.match(modal, /onOpen=\{\(\) => onOpenControl\(pickerId\)\}/);
  assert.match(modal, /picker=\{precision === "month_only" \? "month" : "date"\}/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /target\.closest\("\.pause-date-entry \.custom-select"\)/);
  assert.doesNotMatch(modal, /type="month"/);
  assert.match(read('components/DateFieldControl.tsx'), /if \(!match\) return "Select month";/);
  assert.match(read('components/DateFieldControl.tsx'), /onOpen\?\.\(\);/);
  assert.match(read('components/DateFieldControl.tsx'), /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(modal, /btn-sm btn-sm-ghost/);
  assert.match(modal, /btn-sm btn-sm-primary/);
  assert.match(styles, /\.subscription-pause-reason[\s\S]*background: var\(--surface-raised\);[\s\S]*border: 1\.5px solid var\(--border\);/);
  assert.match(styles, /\.subscription-pause-reason:focus[\s\S]*border-color: var\(--accent\);[\s\S]*box-shadow: 0 0 0 3px rgba\(240, 200, 70, \.18\);[\s\S]*outline: 0;/);
  assert.match(styles, /\.subscription-pause-info[\s\S]*border-top: 1px solid var\(--border\);/);
  assert.match(styles, /\.subscription-pause-info > svg[\s\S]*color: var\(--accent\);/);
  assert.match(payments, /subscription-payment-empty-heading"><svg aria-hidden="true"[\s\S]*<strong>No payments recorded yet\.<\/strong>/);
  assert.match(styles, /\.subscription-payment-empty-heading[\s\S]*color: var\(--text-1\);/);
  assert.match(styles, /\.subscription-payment-empty-heading > svg[\s\S]*color: var\(--accent\);/);
  assert.match(styles, /\.subscription-setup-helper > \.subscription-payment-empty-copy > p \{ margin: 6px 0 0 28px; \}/);
  assert.match(styles, /\.modal-date-display-control input\[type="date"\],[\s\S]*\.modal-date-display-control input\[type="month"\]/);
  assert.match(accountView, /pauseEligible \? \[\{ value: "pause", label: "Pause subscription" \}\]/);
  assert.doesNotMatch(accountView, /options=\{\["Active", "Paused", "Goodbye"\]/);
  assert.match(accountView, /subscription-callout-tool/);
  assert.match(accountView, /subscription-callout-account/);
  assert.match(accountView, /subscription-callout-lifecycle/);
  assert.match(accountView, /subscription-callout-action/);
  assert.match(accountView, /tool-status-chip status-muted subscription-lifecycle-pill/);
  assert.match(accountView, /tool-status-chip status-muted subscription-current-plan-pill/);
  assert.doesNotMatch(accountView, /<small>Lifecycle<\/small>/);
  assert.match(page, /result\.relationshipId !== relationshipId/);
  assert.match(page, /current\.filter\(\(period\) => period\.relationshipId !== relationshipId\)/);
  assert.match(page, /status: refreshedDetail\.status/);
  assert.match(page, /retiredBillingAmounts: refreshedDetail\.retiredBillingAmounts/);
  assert.doesNotMatch(lifecycle.pauseSubscription.toString(), /billing_transactions|billing_renewal_activity/);

  console.log('PASS: Pause Subscription UI validation, RPC mapping, submission guard, errors, and exact relationship refresh contracts.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
