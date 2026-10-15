// Focused Phase 2B2-A2 read-model checks; no database, browser, or network access.
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

const { lastBillingSetupFromRetiredComponents } = loadTypeScript('lib/subscriptionLifecycleReadModel.ts');
const lastSetup = lastBillingSetupFromRetiredComponents([
  { id: 'old', billingType: 'Monthly', currency: 'SGD', amount: '20', nextRenewalDate: '2026-01-31', retiredAt: '2026-02-01T00:00:00Z' },
  { id: 'latest-monthly', billingType: 'Monthly', currency: 'SGD', amount: '30.84', nextRenewalDate: '2026-08-31', retiredAt: '2026-09-01T00:00:00Z' },
  { id: 'latest-yearly', billingType: 'Yearly', currency: 'SGD', amount: '', nextRenewalDate: '2027-08-31', retiredAt: '2026-09-01T00:00:00Z' },
]);
assert.equal(lastSetup.retiredAt, '2026-09-01T00:00:00Z');
assert.deepEqual(lastSetup.components.map((component) => component.id), ['latest-monthly', 'latest-yearly']);
assert.equal(lastSetup.components[1].amount, '', 'Unknown historical amounts must remain unknown.');
assert.equal(lastBillingSetupFromRetiredComponents([]), null);

const tools = read('lib/supabase/tools.ts');
assert.match(tools, /const billingAmounts = componentRecords[\s\S]*component\.retired_at === null \|\| component\.retired_at === undefined/);
assert.match(tools, /const retiredBillingAmounts = componentRecords[\s\S]*retiredAt: String\(component\.retired_at\)/);
assert.match(tools, /billingAmounts,[\s\S]*retiredBillingAmounts,/);

const renewals = read('lib/supabase/billingRenewalPeriods.ts');
assert.match(renewals, /getBillingRenewalPeriodsByRelationships/);
assert.match(renewals, /getBillingRenewalActivitiesByRelationships/);
assert.match(renewals, /\.in\("tool_email_link_id", scopedIds\)/);
assert.match(renewals, /allowedIds\.has\(period\.relationshipId\)/);
assert.match(renewals, /allowedIds\.has\(activity\.relationshipId\)/);

const lifecycleLoader = read('lib/supabase/subscriptionLifecycleEvents.ts');
const lifecycleReadOnlyLoader = lifecycleLoader.slice(0, lifecycleLoader.indexOf('export async function pauseSubscription'));
assert.match(lifecycleLoader, /\.from\("subscription_lifecycle_events"\)/);
assert.match(lifecycleLoader, /\.in\("tool_email_link_id", scopedIds\)/);
assert.match(lifecycleLoader, /scope\.has\(event\.relationshipId\)/);
assert.doesNotMatch(lifecycleReadOnlyLoader, /insert|update|delete|pause_subscription/i);

const page = read('app/dashboard/page.tsx');
assert.match(page, /const historyRelationshipIds = [\s\S]*!detail\.unlinkedAt/);
assert.match(page, /!isRelationshipRenewalEligible\(detail\.status\)/);
assert.match(page, /syncDueBillingRenewalPeriods/);
assert.match(page, /getBillingRenewalPeriodsByRelationships\(historyRelationshipIds\)/);
assert.match(page, /getSubscriptionLifecycleEventsByRelationships\(historyRelationshipIds\)/);
assert.doesNotMatch(page, /eligibleComponentKeys\.has/);
assert.match(page, /subscriptionLifecycleEvents\.filter\(\(event\) => event\.relationshipId === detail\.relationshipId\)/);
assert.match(page, /lastBillingSetupFromRetiredComponents\(detail\.retiredBillingAmounts\)/);
assert.match(page, /isRelationshipRenewalEligible\(detail\.status\) \? detail\.billingType : ""/);

const subscriptionAccount = read('components/SubscriptionAccountView.tsx');
assert.match(subscriptionAccount, /showLastBillingSetup/);
assert.match(subscriptionAccount, /"Last Billing Setup" : "Current Billing"/);
assert.match(subscriptionAccount, /isLastBillingSetup \? "Last recorded renewal" : "Next renewal"/);
assert.match(subscriptionAccount, /!showLastBillingSetup && account\.state === "Complete"/);
assert.match(subscriptionAccount, /periods=\{account\.renewalPeriods\}/);

const billingDetails = read('components/BillingDetailsView.tsx');
assert.match(billingDetails, /account\.status === "Active" && !account\.isHistorical/);
assert.match(billingDetails, /account\.lastBillingSetup\?\.components/);
assert.match(billingDetails, /"Last Billing Setup" : "Current Billing"/);

console.log('PASS: Pause Subscription read model keeps history relationship-scoped and sync operational-only.');
