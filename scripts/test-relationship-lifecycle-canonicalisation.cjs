// Focused local checks; no database, browser, or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const compile = (file) => {
  const output = ts.transpileModule(read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)((name) => require(name), module, module.exports);
  return module.exports;
};

const {
  isRelationshipRenewalEligible,
  normaliseRelationshipLifecycleStatus,
  relationshipLifecycleStatuses,
  requireRelationshipLifecycleStatus,
} = compile('lib/relationshipLifecycle.ts');

assert.deepEqual(relationshipLifecycleStatuses, ['Active', 'Paused', 'Goodbye']);
for (const [stored, canonical] of [
  ['Active', 'Active'],
  ['Running', 'Active'],
  ['Paused', 'Paused'],
  ['On a Break', 'Paused'],
  ['On a break', 'Paused'],
  ['Goodbye', 'Goodbye'],
  ['Goodbye it was a journey', 'Goodbye'],
  ['Goodbye, it was a journey', 'Goodbye'],
]) assert.equal(normaliseRelationshipLifecycleStatus(stored), canonical);

for (const unknown of ['', 'Unknown', 'Cancelled', null, undefined, 1]) {
  assert.equal(normaliseRelationshipLifecycleStatus(unknown), null);
  assert.equal(isRelationshipRenewalEligible(unknown), false);
}
assert.equal(isRelationshipRenewalEligible('Active'), true);
assert.equal(isRelationshipRenewalEligible('Running'), true);
for (const paused of ['Paused', 'On a Break', 'On a break']) {
  assert.equal(isRelationshipRenewalEligible(paused), false);
}
assert.throws(
  () => requireRelationshipLifecycleStatus('Unexpected', 'relationship-1'),
  /Unsupported relationship lifecycle status for relationship relationship-1: 'Unexpected'/,
);

const types = read('types/toolDetail.ts');
assert.match(types, /ManageStatus = "Active" \| "Paused" \| "Goodbye"/);
assert.match(types, /ToolStatus =[\s\S]*\| "Paused"[\s\S]*\| "Cancelled"/);

const tools = read('lib/supabase/tools.ts');
assert.match(tools, /status: requireRelationshipLifecycleStatus\(rawLink\.status, String\(rawLink\.id \?\? ""\)\)/);
assert.match(tools, /\.insert\(\{[\s\S]*?email_account_id: account\.id,[\s\S]*?status: "Active",[\s\S]*?tool_id: toolId/);
assert.match(tools, /status\?: ManageStatus/);

const page = read('app/dashboard/page.tsx');
const linkedStatusStart = page.indexOf('  const renderLinkedStatusControl = (');
const linkedStatusEnd = page.indexOf('\n  const renderToolRow', linkedStatusStart);
assert(linkedStatusStart >= 0 && linkedStatusEnd > linkedStatusStart);
const linkedStatus = page.slice(linkedStatusStart, linkedStatusEnd);
assert.match(linkedStatus, /className="linked-status-readonly"/);
assert.doesNotMatch(linkedStatus, /renderDropdown|updateLinkedManageStatus/);
assert.match(page, /isRelationshipRenewalEligible\(detail\.status\)/);
assert.match(page, /isRelationshipRenewalEligible\(detail\?\.status\)/);
assert.doesNotMatch(page, /function normaliseManageStatus/);

const subscriptions = read('components/SubscriptionsView.tsx');
assert.match(subscriptions, /const statuses = \["Active", "Paused", "Goodbye"\]/);
assert.doesNotMatch(subscriptions, /On a Break|On a break/);

const billingDirectory = read('components/BillingDirectory.tsx');
assert.match(billingDirectory, /billingStatusGroups = \["Active", "Paused", "Goodbye"\]/);
assert.doesNotMatch(billingDirectory, /On a Break|On a break/);

const billingDetails = read('components/BillingDetailsView.tsx');
assert.match(billingDetails, /status: ManageStatus/);
assert.doesNotMatch(billingDetails, /On a Break|On a break/);

const subscriptionAccount = read('components/SubscriptionAccountView.tsx');
assert.match(subscriptionAccount, /id="subscription-manage"/);
assert.match(subscriptionAccount, /const pauseEligible = canPauseSubscription\(/);
assert.match(subscriptionAccount, /const resumeEligible = canResumeSubscription\(/);
assert.match(subscriptionAccount, /pauseEligible \|\| resumeEligible \? <DropdownControl[\s\S]*options=\{pauseEligible \? \[\{ value: "pause", label: "Pause subscription" \}\] : \[\{ value: "resume", label: "Resume subscription" \}\]\}/);
assert.match(subscriptionAccount, /disabled title="No lifecycle actions are currently available"/);
assert.match(subscriptionAccount, /tool-status-chip status-muted subscription-lifecycle-pill/);
assert.doesNotMatch(subscriptionAccount, /id="subscription-status"/);

const subscriptionResume = read('lib/subscriptionResume.ts');
assert.match(subscriptionResume, /input\.lifecycleStatus === "Paused"/);
assert.match(subscriptionResume, /input\.planStatus === "Active" \|\| input\.planStatus === "Paid"/);
assert.match(subscriptionResume, /Boolean\(input\.retiredComponentId\)/);
assert.match(subscriptionResume, /input\.retiredBillingType === "Monthly" \|\| input\.retiredBillingType === "Yearly"/);

const linkModal = read('components/LinkAIToolModal.tsx');
assert.match(linkModal, /\{ label: "Paused", value: "Paused" \}/);

// Tool-level ai_tools.status wording remains distinct from relationship lifecycle parsing.
assert.match(page, /Active: "Running"/);
assert.match(page, /Paused: "On a break"/);
assert.match(page, /Cancelled: "Goodbye, it was a journey"/);

console.log('PASS: Relationship lifecycle values canonicalise safely, unknown values fail closed, renewal eligibility is explicit, and relationship UI uses Active/Paused/Goodbye without changing ai_tools.status semantics.');
