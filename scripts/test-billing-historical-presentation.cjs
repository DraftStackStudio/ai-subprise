// Focused local checks; no database or network access.
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
  billingRelationshipSelectorLabel,
  isHistoricalBillingRelationship,
} = compile('lib/billingRelationshipPresentation.ts');

assert.equal(isHistoricalBillingRelationship({ currentRelationshipId: 'current', relationshipId: 'current', unlinkedAt: '' }), false);
assert.equal(isHistoricalBillingRelationship({ currentRelationshipId: 'current', relationshipId: 'old', unlinkedAt: '' }), true);
assert.equal(isHistoricalBillingRelationship({ currentRelationshipId: 'current', relationshipId: 'current', unlinkedAt: '2026-09-01T00:00:00Z' }), true);
assert.equal(isHistoricalBillingRelationship({ currentRelationshipId: '', relationshipId: 'old', unlinkedAt: '' }), true);
assert.equal(billingRelationshipSelectorLabel('Personal', 'Max', false), 'Personal · Max');
assert.equal(billingRelationshipSelectorLabel('Personal', 'Max', true), 'Personal · Max · Historical');
assert.equal(billingRelationshipSelectorLabel('Personal', '', true), 'Personal · Historical');

const directory = read('components/BillingDirectory.tsx');
assert(directory.includes('!account.isHistorical && account.status === status'));
assert(directory.includes('{ groups: groupAccounts((account) => account.isHistorical), status: "History" }'));
assert(directory.includes('account.isHistorical ? "Historical"'));

const details = read('components/BillingDetailsView.tsx');
assert(details.includes('account.isHistorical ? "Last Billing Setup" : "Current Billing"'));
assert(details.includes('isHistorical ? "Last recorded renewal" : "Next renewal"'));
assert(details.includes('{!account.isHistorical ? <DetailsSection title="Upcoming">'));
assert(details.includes('title="Payments"'));
assert(details.includes('title="Account Activity"'));
assert(details.includes('billingRelationshipSelectorLabel(account.accountLabel, account.planName, account.isHistorical)'));

const page = read('app/dashboard/page.tsx');
assert(page.includes('currentRelationshipId: toolAccountDetails[tool.id]?.[relationship.accountLabel]?.relationshipId'));
assert(page.includes('unlinkedAt: relationship.unlinkedAt'));
assert(page.includes('isHistorical: directoryAccount.isHistorical'));

console.log('PASS: Billing current and historical presentation remains relationship-specific and read-only.');
