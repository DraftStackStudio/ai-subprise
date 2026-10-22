// Focused local checks; no database or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const compile = (file) => {
  const source = read(file);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)((name) => require(name), module, module.exports);
  return module.exports;
};

const {
  expiredTrialNeedsResolution,
  isTrialResolution,
  trialResolutionTransition,
} = compile('lib/trialResolution.ts');
const { buildAccountActivityReadModel } = compile('lib/accountActivity.ts');

assert.deepEqual(trialResolutionTransition('converted'), {
  activityEvent: 'Trial Converted to Paid', label: 'Converted to paid', plan: 'Active', status: 'Active',
});
assert.deepEqual(trialResolutionTransition('moved_to_free'), {
  activityEvent: 'Moved to Free Tier', label: 'Moved to free tier', plan: 'Free Tier', status: 'Active',
});
assert.deepEqual(trialResolutionTransition('stopped_using'), {
  activityEvent: 'Stopped Using', label: 'Stopped using', plan: 'Trial', status: 'Goodbye',
});

for (const outcome of ['converted', 'moved_to_free', 'stopped_using']) assert.equal(isTrialResolution(outcome), true);
for (const outcome of ['', 'ended', null, undefined]) assert.equal(isTrialResolution(outcome), false);

const unresolvedExpiredTrial = { daysRemaining: -2, plan: 'Trial', relationshipId: 'relationship-1', trialResolved: false };
assert.equal(expiredTrialNeedsResolution(unresolvedExpiredTrial), true);
assert.equal(expiredTrialNeedsResolution({ ...unresolvedExpiredTrial, trialResolved: true }), false);
assert.equal(expiredTrialNeedsResolution({ ...unresolvedExpiredTrial, relationshipId: '' }), false);
assert.equal(expiredTrialNeedsResolution({ ...unresolvedExpiredTrial, plan: 'Free Tier' }), false);
assert.equal(expiredTrialNeedsResolution({ ...unresolvedExpiredTrial, daysRemaining: 0 }), false);

// The final migration returns the old ambiguous row to this neutral state.
const restoredLegacyEnded = {
  daysRemaining: -2,
  plan: 'Trial',
  relationshipId: 'legacy-ended-relationship',
  status: 'Active',
  trialResolution: null,
  trialResolved: false,
};
assert.equal(expiredTrialNeedsResolution(restoredLegacyEnded), true);

const page = read('app/dashboard/page.tsx');
const resolverStart = page.indexOf('  const resolveExpiredTrialStatus = async (');
const resolverEnd = page.indexOf('\n  return (', resolverStart);
assert(resolverStart >= 0 && resolverEnd > resolverStart);
const resolver = page.slice(resolverStart, resolverEnd);

assert.match(page, /if \(!isTrialResolution\(outcome\)\) return;/);
assert.match(page, /trialResolved: detail\.trialResolved/);
assert.match(resolver, /relationshipId: detail\.relationshipId/);
assert.match(resolver, /\{ expectedRelationshipId: detail\.relationshipId \}/);
assert.doesNotMatch(resolver, /createBillingTransaction\s*\(/);

const linkedStatusStart = page.indexOf('  const renderLinkedStatusControl = (');
const linkedStatusEnd = page.indexOf('\n  const renderToolRow', linkedStatusStart);
assert(linkedStatusStart >= 0 && linkedStatusEnd > linkedStatusStart);
const linkedStatus = page.slice(linkedStatusStart, linkedStatusEnd);
assert.match(linkedStatus, /className="linked-status-readonly"/);
assert.match(linkedStatus, />\{manageStatus\}<\/span>/);
assert.doesNotMatch(linkedStatus, /renderDropdown|renderExpiredTrialResolutionControl|updateLinkedManageStatus/);
assert.match(page, /return renderExpiredTrialResolutionControl\(tool, item\.accountLabel/);

const resolutionWriteMatch = resolver.match(/await updateToolLinkDetails\(tool\.id, accountLabel, accountList, \{([\s\S]*?)\}, \{ expectedRelationshipId: detail\.relationshipId \}\)/);
assert(resolutionWriteMatch);
const resolutionWrite = resolutionWriteMatch[1];
for (const unrelatedField of ['amount:', 'billingAmounts:', 'billingType:', 'currency:', 'lastTopUpDate:', 'nextChargeDate:', 'purchaseDate:', 'planName:', 'trialExpiryDate:']) {
  assert.equal(resolutionWrite.includes(unrelatedField), false, `Resolution write unexpectedly includes ${unrelatedField}`);
}

const undoStart = page.indexOf('  const undoTrialResolution = async () => {');
const undoEnd = page.indexOf('\n  const copyAccountLogin', undoStart);
assert(undoStart >= 0 && undoEnd > undoStart);
const undo = page.slice(undoStart, undoEnd);
assert.match(undo, /currentRelationshipId !== expectedRelationshipId/);
assert.match(undo, /\{ expectedRelationshipId \}/);
assert.match(undo, /startDate: undo\.outcome === ["']converted["'] \? undo\.previousDetail\.startDate : undefined/);

const tools = read('lib/supabase/tools.ts');
assert.match(tools, /trialResolution: isTrialResolution\(rawLink\.trial_resolution\)/);
assert.doesNotMatch(read('types/toolDetail.ts'), /["']ended["']/);

const relationshipOne = '11111111-1111-4111-8111-111111111111';
const relationshipTwo = '22222222-2222-4222-8222-222222222222';
const trialEntries = [
  { amount: '0', billingType: 'Monthly', currency: 'SGD', date: '2026-10-18', event: 'Trial Started', id: 'trial-started', note: 'Trial opened', planName: 'Trial', saved: true, source: 'generated' },
  { amount: '30', billingType: 'Monthly', currency: 'SGD', date: '2026-10-19', event: 'Trial Converted to Paid', id: 'trial-converted', note: 'Converted after trial', planName: 'Plus', saved: true, source: 'generated' },
  { amount: '0', billingType: 'Monthly', currency: 'SGD', date: '2026-10-20', event: 'Moved to Free Tier', id: 'trial-free-tier', note: 'Free tier selected', planName: 'Free Tier', saved: true, source: 'generated' },
  { date: '2026-10-21', event: 'Stopped Using', id: 'trial-stopped', note: 'Stopped after trial', planName: 'Trial', saved: true, source: 'generated' },
];
const trialActivity = buildAccountActivityReadModel({
  historicalEntries: [...trialEntries, trialEntries[1]],
  relationshipId: relationshipOne,
}).flatMap((group) => group.items);
assert.deepEqual(trialActivity.map((item) => item.title), [
  'Stopped Using',
  'Moved to Free Tier',
  'Trial Converted to Paid',
  'Trial Started',
]);
assert.deepEqual(trialActivity.map((item) => item.note), [
  'Stopped after trial',
  'Free tier selected',
  'Converted after trial',
  'Trial opened',
]);
assert.deepEqual(trialActivity.find((item) => item.title === 'Trial Converted to Paid').details, ['Plus', 'Monthly', 'SGD 30']);
assert.equal(trialActivity.length, 4, 'duplicate stored trial entries must not create duplicate activity rows');
assert(trialActivity.every((item) => item.relationshipId === relationshipOne), 'trial activity must retain the requested relationship identity');
const otherRelationshipActivity = buildAccountActivityReadModel({
  historicalEntries: [{ ...trialEntries[0], id: 'other-trial-started' }],
  relationshipId: relationshipTwo,
}).flatMap((group) => group.items);
assert(otherRelationshipActivity.every((item) => item.relationshipId === relationshipTwo));

const subscriptionAccount = read('components/SubscriptionAccountView.tsx');
assert.match(subscriptionAccount, /<AccountActivityTable/);
assert.match(subscriptionAccount, /historicalEntries=\{account\.activity\}/);
assert.match(subscriptionAccount, /relationshipId=\{account\.relationshipId\}/);
assert.match(page, /activity: mergeSubscriptionLifecycleHistory\(\s*detail\.billingHistoryEntries \?\? \[\],\s*subscriptionLifecycleEvents,\s*detail\.relationshipId,/);

const compatibilityMigration = read('supabase/migrations/0025_expand_trial_resolution_outcomes.sql');
for (const value of ["'converted'", "'ended'", "'moved_to_free'", "'stopped_using'"]) assert(compatibilityMigration.includes(value));

const finalMigration = read('supabase/migrations/0026_finalize_trial_resolution_outcomes.sql');
assert.match(finalMigration, /where link\.trial_resolution = 'ended'/);
assert.match(finalMigration, /trial_resolved = false/);
assert.match(finalMigration, /trial_resolution = null/);
assert.match(finalMigration, /status = 'Active'/);
assert.match(finalMigration, /history\.entry ->> 'outcome' is distinct from 'ended'/);
const cleanupUpdate = finalMigration.slice(finalMigration.indexOf('update public.tool_email_links'), finalMigration.indexOf('alter table public.tool_email_links'));
for (const preservedField of ['plan =', 'trial_expiry_date =', 'unlinked_at =', 'billing_history_entries =', 'amount =', 'billing_type =']) {
  assert.equal(cleanupUpdate.includes(preservedField), false, `Cleanup unexpectedly changes ${preservedField}`);
}
const finalConstraint = finalMigration.slice(finalMigration.lastIndexOf('add constraint'));
for (const value of ["'converted'", "'moved_to_free'", "'stopped_using'"]) assert(finalConstraint.includes(value));
assert.equal(finalConstraint.includes("'ended'"), false);

console.log('PASS: Four trial activity outcomes through the shared model, rendering-path wiring, deduplication, exact relationship isolation, no-selection guard, reload model, Action Needed persistence, legacy reset, guarded Undo, zero payment creation, and Current Billing isolation.');
