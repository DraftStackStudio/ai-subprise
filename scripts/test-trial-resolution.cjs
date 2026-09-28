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
const subscriptionAccount = read('components/SubscriptionAccountView.tsx');
for (const label of ['Trial Converted to Paid', 'Moved to Free Tier', 'Stopped Using']) assert(subscriptionAccount.includes(label));

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

console.log('PASS: Three explicit trial outcomes, no-selection guard, reload model, Action Needed persistence, legacy reset, exact relationship isolation, guarded Undo, lifecycle activity, zero payment creation, and Current Billing isolation.');
