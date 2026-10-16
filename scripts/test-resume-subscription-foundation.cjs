// Focused source-contract checks for Resume Subscription; no database, browser,
// fixture, baseline, or network access.
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

const currentBilling = loadTypeScript('lib/currentBilling.ts');
const billingValidation = loadTypeScript('lib/billingPeriodValidation.ts', {
  '@/lib/currentBilling': currentBilling,
  '@/lib/subscriptions': { validSubscriptionBillingTypes: () => true },
});
const resume = loadTypeScript('lib/subscriptionResume.ts', {
  '@/lib/currentBilling': currentBilling,
  '@/lib/billingPeriodValidation': billingValidation,
});

assert.equal(resume.suggestedResumeNextRenewalDate('2026-01-31', 'Monthly'), '2026-02-28');
assert.equal(resume.suggestedResumeNextRenewalDate('2024-02-29', 'Yearly'), '2025-02-28');
assert.equal(resume.suggestedResumeNextRenewalDate('invalid', 'Monthly'), '');

const base = {
  amount: ' 30.84 ', billingType: 'Monthly', chargeAnswer: 'no', currency: ' sgd ',
  nextRenewalConfirmed: true, nextRenewalDate: '2026-11-15', nextRenewalMode: 'suggested',
};
const valid = resume.validateResumeSubscriptionDraft(base, '2026-10-15');
assert.deepEqual(valid.errors, {});
assert.deepEqual(valid.input, {
  amount: '30.84', billingType: 'Monthly', currency: 'SGD',
  nextRenewalDate: '2026-11-15', nextRenewalUnknown: false,
});
assert.deepEqual(resume.validateResumeSubscriptionDraft({
  ...base, amount: '', nextRenewalDate: '', nextRenewalMode: 'unknown',
}, '2026-10-15').input, {
  amount: '', billingType: 'Monthly', currency: 'SGD',
  nextRenewalDate: null, nextRenewalUnknown: true,
});
assert.equal(resume.validateResumeSubscriptionDraft({ ...base, nextRenewalDate: '2026-10-15' }, '2026-10-15').errors.nextRenewalDate, 'The next renewal date must be later than today.');
assert.equal(resume.validateResumeSubscriptionDraft({ ...base, amount: '-1' }, '2026-10-15').errors.amount, 'Enter an amount of zero or greater.');
assert.equal(resume.validateResumeSubscriptionDraft({ ...base, currency: 'SG' }, '2026-10-15').errors.currency, 'Select a three-letter currency.');
assert.equal(resume.validateResumeSubscriptionDraft({ ...base, nextRenewalConfirmed: false }, '2026-10-15').errors.nextRenewalDate, 'Confirm the suggested date, change it, or select Unknown.');

const manual = resume.changeResumeBillingFrequency({ ...base, nextRenewalMode: 'manual' }, 'Yearly', '2026-10-15');
assert.equal(manual.nextRenewalDate, '2026-11-15');
const suggested = resume.changeResumeBillingFrequency(base, 'Yearly', '2026-10-15');
assert.equal(suggested.nextRenewalDate, '2027-10-15');
const unknown = resume.changeResumeBillingFrequency({ ...base, nextRenewalDate: '', nextRenewalMode: 'unknown' }, 'Yearly', '2026-10-15');
assert.equal(unknown.nextRenewalDate, '');
assert.equal(resume.resumePaymentSourceKey('event-1'), 'resume-payment:event-1');
const paymentInput = resume.validateResumePayment({ amount: ' 0 ', billingType: 'Monthly', currency: ' sgd ', paymentDate: '2026-10-15', planName: ' Pro ' }, '2026-10-15').input;
assert.deepEqual(paymentInput, {
  amount: '0', billingType: 'Monthly', currency: 'SGD', paymentDate: '2026-10-15', planName: 'Pro',
});
const payment = {
  relationshipId: 'relationship-1', source: 'manual', sourceKey: 'resume-payment:event-1', status: 'Paid',
  paymentDate: '2026-10-15', planNameSnapshot: 'Pro', billingTypeSnapshot: 'Monthly', currency: 'SGD', amount: '0',
};
assert.equal(resume.matchesResumePayment(payment, 'relationship-1', 'event-1', paymentInput), true);
assert.equal(resume.matchesResumePayment({ ...payment, amount: '1' }, 'relationship-1', 'event-1', paymentInput), false);
assert.equal(resume.matchesResumePayment({ ...payment, sourceKey: 'resume-payment:event-2' }, 'relationship-1', 'event-1', paymentInput), false);
assert.equal(resume.validateResumePayment({ amount: '', billingType: 'Monthly', currency: 'SGD', paymentDate: '2026-10-16', planName: 'Pro' }, '2026-10-15').errors.paymentDate, 'Payment date cannot be in the future.');

assert.equal(resume.canResumeSubscription({
  canManageBilling: true, lifecycleStatus: 'Paused', planStatus: 'Paid',
  retiredBillingType: 'Monthly', retiredComponentId: 'component-1',
}), true);
for (const input of [
  { canManageBilling: false, lifecycleStatus: 'Paused', planStatus: 'Paid', retiredBillingType: 'Monthly', retiredComponentId: 'component-1' },
  { canManageBilling: true, lifecycleStatus: 'Active', planStatus: 'Paid', retiredBillingType: 'Monthly', retiredComponentId: 'component-1' },
  { canManageBilling: true, lifecycleStatus: 'Paused', planStatus: 'Paid', retiredBillingType: 'Top-up', retiredComponentId: 'component-1' },
  { canManageBilling: true, lifecycleStatus: 'Paused', planStatus: 'Paid', retiredBillingType: 'Monthly', retiredComponentId: '' },
]) assert.equal(resume.canResumeSubscription(input), false);

const migration = read('supabase/migrations/0033_add_resume_subscription_contract.sql');
const sql = migration.toLowerCase();
assert(sql.trimStart().startsWith('-- phase 2b2-b1'));
assert(sql.includes('begin;') && sql.trimEnd().endsWith('commit;'));
assert(sql.includes('add column if not exists next_renewal_date_snapshot date'));
assert(sql.includes('create or replace function public.resume_subscription'));
assert(sql.includes('security definer') && sql.includes('set search_path = public'));
assert(sql.includes("v_link.status <> 'paused'"));
assert(sql.includes("v_link.plan not in ('active', 'paid')"));
assert(sql.includes("component.billing_type in ('monthly', 'yearly')"));
assert(sql.includes('component.retired_at is not null'));
assert(sql.includes('a current recurring billing component already exists'));
assert(sql.includes('p_next_renewal_date <= v_local_date'));
assert(sql.includes('recurrence_anchor_date'));
assert(sql.includes("'paused',\n    'active', 'resumed'"));
assert(sql.includes("set status = 'active'"));
assert(sql.includes('pg_advisory_xact_lock(hashtextextended(p_request_id::text, 1))'));
assert(sql.includes('pg_advisory_xact_lock(hashtextextended(p_relationship_id::text, 0))'));
assert(sql.includes('this resume request id is already in use'));
assert(sql.includes('was_already_applied boolean'));
assert(sql.includes('revoke all on function public.resume_subscription'));
assert(sql.includes('grant execute on function public.resume_subscription'));
assert(!sql.includes('insert into public.billing_transactions'));
assert(!sql.includes('update public.billing_transactions'));
assert(!sql.includes('delete from public.billing_transactions'));
assert(!sql.includes('insert into public.billing_renewal_periods'));
assert(!sql.includes('update public.billing_renewal_periods'));
assert(!sql.includes('delete from public.billing_renewal_periods'));
assert(!sql.includes('update public.billing_renewal_activity'));

// Applying 0033 may add schema/function definitions, but must not execute any
// application-data write or invoke Resume at migration time.
const topLevelMigration = sql.replace(/as \$\$[\s\S]*?\$\$;/g, '');
assert(!/^\s*(insert|update|delete|truncate|call|perform)\b/im.test(topLevelMigration));
assert(!/\b(select|perform|call)\s+(?:public\.)?resume_subscription\s*\(/i.test(topLevelMigration));

const contract = read('docs/resume-subscription-contract.md');
assert.match(contract, /It never changes the Pause event, retired component, renewal periods,/);
assert.match(contract, /The UI asks whether the provider charged the user on Resume/);
assert.match(contract, /Migration 0033 and the[\s\S]*Resume RPC do not create or modify Payments/);

const harness = read('scripts/test-resume-subscription-foundation.sql').toLowerCase();
assert(harness.trimStart().startsWith('-- rollback-only behavioural verification'));
assert(harness.includes('begin;') && harness.trimEnd().endsWith('rollback;'));
for (const expected of [
  'resume changed protected historical records',
  'resume created or changed a payment',
  'idempotent retry duplicated resume',
  'conflicting idempotency payload unexpectedly succeeded',
  'unknown next renewal was not preserved safely',
  'pay-per-use-style pause unexpectedly resumed',
  'wrong-owner resume unexpectedly succeeded',
]) assert(harness.includes(expected));

for (const file of ['scripts/preflight-resume-subscription.sql', 'scripts/verify-resume-subscription-foundation.sql']) {
  const verification = read(file).replace(/--.*$/gm, '').trim().toLowerCase();
  assert.match(verification, /^with\b/);
  assert.doesNotMatch(verification, /\b(insert|update|delete|truncate|alter|create|drop|grant|revoke|call|perform)\b/);
}

const rpcCalls = [];
let rpcError = null;
const lifecycle = loadTypeScript('lib/supabase/subscriptionLifecycleEvents.ts', {
  '@/lib/supabase/client': { createClient: () => ({ rpc: async (...args) => {
    rpcCalls.push(args);
    return rpcError ? { data: null, error: rpcError } : { data: [{
      relationship_id: 'relationship-1', lifecycle_event_id: 'resume-1',
      previous_billing_component_id: 'component-old', new_billing_component_id: 'component-new',
      next_renewal_date: '2026-11-15', was_already_applied: false,
    }], error: null };
  } }) },
});

(async () => {
  const result = await lifecycle.resumeSubscription('relationship-1', 'pause-1', 'resume-1', valid.input, '2026-10-15');
  assert.deepEqual(rpcCalls[0], ['resume_subscription', {
    p_amount: '30.84', p_billing_type: 'Monthly', p_currency: 'SGD',
    p_local_date: '2026-10-15', p_next_renewal_date: '2026-11-15',
    p_next_renewal_unknown: false, p_pause_event_id: 'pause-1',
    p_relationship_id: 'relationship-1', p_request_id: 'resume-1',
  }]);
  assert.deepEqual(result, {
    lifecycleEventId: 'resume-1', newBillingComponentId: 'component-new',
    nextRenewalDate: '2026-11-15', previousBillingComponentId: 'component-old',
    relationshipId: 'relationship-1', wasAlreadyApplied: false,
  });
  rpcError = new Error('Only a Paused relationship can be resumed.');
  await assert.rejects(
    lifecycle.resumeSubscription('relationship-1', 'pause-1', 'resume-1', valid.input, '2026-10-15'),
    /Only a Paused relationship/,
  );
  assert.doesNotMatch(lifecycle.resumeSubscription.toString(), /billing_transactions|billing_renewal_periods/);
  console.log('PASS: Resume Subscription migration, validation, RPC mapping, and preservation contracts.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
