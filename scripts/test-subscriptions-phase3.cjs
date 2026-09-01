// Focused local checks; no database or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function compile(source, dependencies = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', js)((name) => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
    return require(name);
  }, module, module.exports);
  return module.exports;
}
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const load = (file, dependencies) => compile(read(file), dependencies);
const { subscriptionBillingPatch, subscriptionState, validSubscriptionBillingTypes } = load('lib/subscriptions.ts');
const { subscriptionPaymentPrefill, resolvePaymentDate } = load('lib/subscriptionPaymentPrefill.ts');
assert.equal(resolvePaymentDate({ billingType: 'Monthly', paymentDate: '', nextRenewalDate: '2026-03-31' }), '2026-02-28');
assert.equal(resolvePaymentDate({ billingType: 'Yearly', paymentDate: '', nextRenewalDate: '2028-02-29' }), '2027-02-28');
assert.equal(resolvePaymentDate({ billingType: 'Monthly', paymentDate: '2026-01-10', nextRenewalDate: '2026-03-31' }), '2026-01-10');
assert.equal(resolvePaymentDate({ billingType: 'Monthly', paymentDate: '', nextRenewalDate: '' }), '');
assert.equal(resolvePaymentDate({ billingType: 'Top-up', paymentDate: '', nextRenewalDate: '2026-03-31' }), '');
assert.equal(resolvePaymentDate({ billingType: 'Monthly', paymentDate: '2026-02-30', nextRenewalDate: '2026-03-31' }), '');
const { firstTimeBillingComponents } = load('lib/firstTimeBillingSetup.ts');
assert.throws(() => firstTimeBillingComponents([{ billingType: 'Monthly', currency: 'SGD', amount: '30', paymentDate: '2026-08-25' }]));
assert.throws(() => firstTimeBillingComponents([{ billingType: 'Monthly', currency: '', amount: '30', paymentDate: '2026-08-25', nextRenewalDate: '2026-09-25' }]));
const setupComponents = firstTimeBillingComponents([{ billingType: 'Monthly', currency: 'SGD', amount: '30', paymentDate: '2026-08-25', nextRenewalDate: '2026-09-25' }, { billingType: 'Top-up', currency: 'SGD', amount: '5', paymentDate: '2026-08-26' }]);
assert.equal(setupComponents[0].nextRenewalDate, '2026-09-25');
assert.equal(setupComponents[1].lastTopUpDate, '2026-08-26');
const prefillComponents = [
  { id: 'm', billingType: 'Monthly', amount: '30', currency: 'SGD', nextRenewalDate: '2026-09-25' },
  { id: 't', billingType: 'Top-up', amount: '5', currency: 'USD', lastTopUpDate: '2026-08-10' },
];
const prefillBefore = JSON.stringify(prefillComponents);
assert.equal(subscriptionPaymentPrefill(prefillComponents, 'single'), null);
assert.equal(subscriptionPaymentPrefill(prefillComponents, 'single', 'Monthly').paymentDate, '2026-08-25');
assert.equal(subscriptionPaymentPrefill(prefillComponents, 'single', 'Top-up').paymentDate, '2026-08-10');
assert.equal(subscriptionPaymentPrefill(prefillComponents, 'period').billingType, 'Monthly');
assert.equal(subscriptionPaymentPrefill(prefillComponents, 'period').currency, 'SGD');
assert.equal(subscriptionPaymentPrefill(prefillComponents, 'period').amount, '30');
assert.equal(subscriptionPaymentPrefill(prefillComponents, 'period').nextRenewalDate, '2026-09-25');
assert.equal(subscriptionPaymentPrefill([prefillComponents[1]], 'period'), null);
assert.equal(subscriptionPaymentPrefill([{ ...prefillComponents[0], nextRenewalDate: '' }], 'period').paymentDate, '');
assert.equal(subscriptionPaymentPrefill([{ ...prefillComponents[0], nextRenewalDate: '2026-03-31' }], 'single').paymentDate, '2026-02-28');
assert.equal(subscriptionPaymentPrefill([{ ...prefillComponents[0], billingType: 'Yearly', nextRenewalDate: '2028-02-29' }], 'period').paymentDate, '2027-02-28');
for (const billingType of ['Lifetime', 'One-time']) assert.equal(subscriptionPaymentPrefill([{ ...prefillComponents[0], billingType, purchaseDate: '2026-08-03' }], 'single').paymentDate, '2026-08-03');
assert.equal(JSON.stringify(prefillComponents), prefillBefore);
const mainTypes = ['Monthly', 'Yearly', 'Lifetime', 'One-time'];
for (const type of mainTypes) {
  assert(validSubscriptionBillingTypes([type]));
  assert(validSubscriptionBillingTypes([type, 'Top-up']));
  for (const other of mainTypes) assert(!validSubscriptionBillingTypes([type, other]));
}
assert(validSubscriptionBillingTypes([]));
assert(validSubscriptionBillingTypes(['Top-up']));
assert(!validSubscriptionBillingTypes(['Monthly', 'Lifetime', 'Top-up']));
const monthly = { id: 'component-1', billingType: 'Monthly', amount: '30', currency: 'SGD', nextRenewalDate: '2026-09-18' };
const topup = { id: 'component-2', billingType: 'Top-up', amount: '10', currency: 'USD', lastTopUpDate: '2026-08-25' };
const saved = [monthly, topup];
const snapshot = JSON.stringify(saved);
const changed = subscriptionBillingPatch('Max', [{ ...monthly, billingType: 'Yearly' }, topup]);
assert.equal(changed.planName, 'Max');
assert.equal(changed.billingAmounts[0].id, monthly.id);
assert.equal(changed.billingAmounts[1].lastTopUpDate, topup.lastTopUpDate);
assert.equal(changed.billingAmounts[1].amount, topup.amount);
assert.equal(JSON.stringify(saved), snapshot);
assert.equal(subscriptionState(changed.billingAmounts), 'Complete');
assert.equal(subscriptionState(subscriptionBillingPatch('', []).billingAmounts), 'Not started');
assert.equal(subscriptionState(subscriptionBillingPatch('', [{ ...monthly, amount: '' }, topup]).billingAmounts), 'Incomplete');
assert.equal(subscriptionState(subscriptionBillingPatch('', [{ ...monthly, amount: '0' }]).billingAmounts), 'Complete');
assert.throws(() => subscriptionBillingPatch('', [monthly, { ...monthly, billingType: 'Yearly' }]));
assert.throws(() => subscriptionBillingPatch('', [{ ...monthly, nextRenewalDate: '2026-02-30' }]));

// Run the actual page save wiring with state and persistence spies.
const page = read('app/dashboard/page.tsx');
const saves = page.slice(page.indexOf('  const subscriptionTarget ='), page.indexOf('  const saveCurrentBillingSettings ='));
const context = `
let toolAccountDetails = { tool: { Personal: { relationshipId: 'r1', billingAmounts: saved }, Work: { relationshipId: 'r2', planName: 'Other' } } };
let planNames = {}; let details = [{ relationshipId: 'r1' }, { relationshipId: 'r2' }];
const subscriptionRows = [{ relationshipId: 'r1', toolId: 'tool', accountLabel: 'Personal' }];
const subscriptionCandidates = new Map([['r1', { unlinkedAt: '' }]]);
const toolList = [{ id: 'tool' }]; const accountList = []; const shouldUseSupabase = true;
const writes = []; const transactions = [{ id: 'p1', relationshipId: 'r1', amount: '20' }, { id: 'p2', relationshipId: 'r2' }];
const updateToolLinkDetails = async (...args) => { writes.push(args); };
const setToolAccountDetails = (fn) => { toolAccountDetails = fn(toolAccountDetails); };
const setToolAccountPlanNames = (fn) => { planNames = fn(planNames); };
const setBillingRelationshipDetails = (fn) => { details = fn(details); };
const showToast = () => {}; const updateLinkedManageStatus = async () => {};
${saves}
module.exports = { saveSubscriptionBilling, writes, transactions, get: () => ({ toolAccountDetails, planNames, details }) };`;
const wiring = compile(`const { subscriptionBillingPatch } = require('helper'); const saved = ${JSON.stringify(saved)};\n${context}`, { helper: { subscriptionBillingPatch } });

async function main() {
  // Exercise the actual payment save/review handlers without network access.
  const panelSource = read('components/BillingHistoryPanel.tsx');
  const datesSource = panelSource.slice(panelSource.indexOf('function periodDates('), panelSource.indexOf('function displayAmount('));
  const dateFunctions = compile(`const { addMonthsSafely, validBillingDate } = require('dates'); const localBillingToday = () => '2026-08-31'; ${datesSource}\nmodule.exports = { periodDates };`, { dates: load('lib/currentBilling.ts') });
  assert.deepEqual(dateFunctions.periodDates('2026-01-31', '2026-04-30', 'Monthly'), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.deepEqual(dateFunctions.periodDates('2026-08-15', '2026-11-15', 'Monthly'), ['2026-08-15']);
  assert.deepEqual(dateFunctions.periodDates('2026-08-15', '', 'Monthly'), []);
  const paymentHandlers = panelSource.slice(panelSource.indexOf('  const directPaymentDates ='), panelSource.indexOf('  const beginEdit ='));
  function setupHarness(failCurrentBilling = false) {
    return compile(`
      const { firstTimeBillingComponents, validBillingDate, resolvePaymentDate } = require('setupHelpers');
      const calls = []; const relationshipId = 'exact-setup-id';
      const prefillCurrentBilling = true, editingId = '', singlePaymentKey = 'stable-key';
      const singlePaymentBillingDrafts = [{ billingType: 'Monthly', currency: 'SGD', amount: '30', paymentDate: '2020-08-25', nextRenewalDate: '2020-09-25' }];
      const additionalTopUpDrafts = [];
      const draft = { planName: 'Pro', note: '', status: 'Paid', billingType: 'Monthly', amount: '30', currency: 'SGD', startDate: '2020-08-25', endDate: '2020-08-25' };
      const setupRenewalDate = '2020-09-25';
      const periodDraftRows = [{ ...draft, paymentDate: '2020-08-25', sourceKey: 'stable-period-key' }];
      const previewDates = ['2020-08-25'];
      let isSaving = false, error = '', reviewed = false;
      const setError = (value) => { error = value; }; const setIsSaving = (value) => { isSaving = value; };
      const setSetupBillingSaved = () => {}; const setOpenDropdownId = () => {};
      const setShowPeriodPreview = (value) => { reviewed = value; };
      const onEstablishCurrentBilling = async (...args) => { calls.push(['current', ...args]); if (${failCurrentBilling}) throw new Error('current failed'); };
      const createBillingTransaction = async (input) => { calls.push(['payment', input]); };
      const reload = async () => {}; const closeForm = () => {}; const onSetupComplete = () => { calls.push(['complete']); };
      ${paymentHandlers}
      module.exports = { saveSingle, savePeriod, reviewPeriod, calls, get: () => ({ error, reviewed }) };
    `, { setupHelpers: { firstTimeBillingComponents, resolvePaymentDate, validBillingDate: load('lib/currentBilling.ts').validBillingDate } });
  }
  const singleSetup = setupHarness();
  assert.equal(singleSetup.calls.length, 0);
  await singleSetup.saveSingle();
  assert.deepEqual(singleSetup.calls.map((call) => call[0]), ['current', 'payment', 'complete']);
  assert.equal(singleSetup.calls[0][1], 'exact-setup-id');
  assert.equal(singleSetup.calls[1][1].relationshipId, 'exact-setup-id');
  assert.equal(singleSetup.calls[1][1].paymentDate, '2020-08-25');
  assert.equal(singleSetup.calls[0][3][0].nextRenewalDate, '2020-09-25');
  const failedSetup = setupHarness(true);
  await failedSetup.saveSingle();
  assert.deepEqual(failedSetup.calls.map((call) => call[0]), ['current']);
  const periodSetup = setupHarness();
  periodSetup.reviewPeriod();
  assert.equal(periodSetup.get().reviewed, true);
  assert.equal(periodSetup.calls.length, 0);
  await periodSetup.savePeriod();
  assert.deepEqual(periodSetup.calls.map((call) => call[0]), ['current', 'payment', 'complete']);
  const history = JSON.stringify(wiring.transactions);
  await wiring.saveSubscriptionBilling('r1', 'Max', changed.billingAmounts);
  assert.equal(wiring.writes[0][4].expectedRelationshipId, 'r1');
  assert.equal(wiring.get().toolAccountDetails.tool.Personal.planName, 'Max');
  assert.equal(wiring.get().planNames.tool.Personal, 'Max');
  assert.equal(wiring.get().toolAccountDetails.tool.Work.planName, 'Other');
  await wiring.saveSubscriptionBilling('r1', 'Max', []);
  assert.deepEqual(wiring.writes[1][3].billingAmounts, []);
  assert.equal(JSON.stringify(wiring.transactions), history);
  await assert.rejects(wiring.saveSubscriptionBilling('r2', 'Wrong', []));
  assert.equal(wiring.writes.length, 2);

  const statusSource = page.slice(page.indexOf('  const updateLinkedManageStatus ='), page.indexOf('  const saveToolLink ='));
  const statusWiring = compile(`
    let toolAccountDetails = { tool: { Personal: { relationshipId: 'r1', status: 'On a Break', billingType: 'Monthly', billingAmounts: [${JSON.stringify(monthly)}] } } };
    const shouldUseSupabase = true, accountList = [], calls = [], events = [];
    const normaliseBillingType = (value) => value, normaliseCurrency = (value) => value || '';
    const relationPlan = () => 'Paid', relationPlanStatusValue = () => 'Active';
    const todayInputValue = () => '2026-08-31', recurringBillingType = () => 'Monthly';
    const advanceRecurringChargeDate = () => '2026-09-30';
    const statusLedgerEntry = (from, to) => { events.push([from, to]); return { event: 'Resumed' }; };
    const toolAccountPlanNames = {}; const setToolDetailDrafts = () => {};
    const setToolAccountDetails = (fn) => { toolAccountDetails = fn(toolAccountDetails); };
    const updateToolLinkDetails = async (...args) => { calls.push(args); };
    ${statusSource}
    module.exports = { updateLinkedManageStatus, calls, events, get: () => toolAccountDetails };
  `);
  await statusWiring.updateLinkedManageStatus({ id: 'tool' }, 'Personal', 'Active', 'r1');
  assert.equal(statusWiring.calls[0][4].expectedRelationshipId, 'r1');
  assert.deepEqual(statusWiring.events, [['On a Break', 'Active']]);
  assert.equal(statusWiring.get().tool.Personal.billingAmounts[0].nextRenewalDate, '2026-09-30');
  assert.equal(statusWiring.get().tool.Personal.relationshipId, 'r1');
  await assert.rejects(statusWiring.updateLinkedManageStatus({ id: 'tool' }, 'Personal', 'Goodbye', 'r2'));
  assert.equal(statusWiring.calls.length, 1);

  // Render the actual editor with a small hook harness; Cancel must never call Save.
  let hooks = [], cursor = 0, calls = 0;
  const react = { useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], (value) => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; }, useRef(initial) { const i = cursor++; return hooks[i] ?? (hooks[i] = { current: initial }); } };
  const Editor = load('components/SubscriptionBillingEditor.tsx', { react, '@/components/DateFieldControl': { default: () => null }, '@/components/DropdownControls': { DropdownControl: () => null } }).default;
  const props = { account: { relationshipId: 'r1', state: 'Complete', planName: 'Pro', billingComponents: saved }, currencyOptions: [], onSaveBilling: async () => { calls++; }, onClose: () => { hooks = []; } };
  const render = () => { cursor = 0; return Editor(props); };
  const nodes = (node) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const button = (tree, text) => nodes(tree).find((node) => node.type === 'button' && node.props.children === text);
  let tree = render();
  nodes(tree).find((node) => node.type === 'input' && node.props.value === '30').props.onChange({ target: { value: '35' } });
  button(render(), 'Cancel').props.onClick();
  assert.equal(calls, 0); assert.equal(JSON.stringify(saved), snapshot);
  assert(nodes(render()).some((node) => node.type === 'input' && node.props.value === '30'));
  const picker = () => nodes(render()).find((node) => node.props?.id === 'subscription-billing-types');
  picker().props.onOpenChange('subscription-billing-types');
  assert.deepEqual(picker().props.values, ['Monthly', 'Top-up']);
  picker().props.onChange(picker().props.toggleSelection(picker().props.values, 'Yearly'));
  assert.deepEqual(picker().props.values, ['Monthly', 'Top-up']);
  assert(picker().props.options.filter((option) => !picker().props.values.includes(option.value)).every((option) => option.disabled));
  assert(nodes(render()).some((node) => node.type === 'input' && node.props.value === '30'));
  const MultiSelect = load('components/DropdownControls.tsx').MultiSelectDropdownControl;
  const chipField = MultiSelect(picker().props);
  const field = nodes(chipField).find((node) => node.props?.className === 'custom-select-trigger multi-select-chip-field');
  assert(field);
  assert.equal(nodes(field).filter((node) => node.props?.className === 'tool-status-chip').length, 2);
  nodes(field).find((node) => node.props?.['aria-label'] === 'Remove Monthly').props.onClick({ stopPropagation() {} });
  assert.deepEqual(picker().props.values, ['Top-up']);
  picker().props.onChange(picker().props.toggleSelection(picker().props.values, 'Yearly'));
  assert.deepEqual(picker().props.values, ['Top-up', 'Yearly']);
  assert.equal(calls, 0);
  button(render(), 'Cancel').props.onClick();
  assert.equal(JSON.stringify(saved), snapshot);
  hooks = [];
  const savedComponents = props.account.billingComponents;
  props.account.billingComponents = [];
  assert.deepEqual(picker().props.values, []);
  assert.equal(picker().props.placeholder, 'Select billing type');
  assert.deepEqual(nodes(render()).filter((node) => node.type === 'input').map((node) => node.props?.['aria-label']), ['Current Billing Plan Name']);
  picker().props.onChange(['Lifetime']);
  assert(nodes(render()).some((node) => node.props?.ariaLabel === 'Purchased on'));
  const currencyField = (index) => nodes(render()).find((node) => node.props?.id === `subscription-${index}-currency`);
  currencyField(0).props.onChange('SGD');
  picker().props.onOpenChange('subscription-billing-types');
  picker().props.onChange(['Lifetime', 'Top-up']);
  assert.equal(picker().props.isOpen, false);
  assert.equal(currencyField(1).props.value, 'SGD');
  currencyField(0).props.onChange('EUR');
  assert.equal(currencyField(1).props.value, 'EUR');
  currencyField(0).props.onChange('SGD');
  assert.equal(currencyField(1).props.value, 'SGD');
  assert(!nodes(render()).some((node) => node.type === 'input' && node.props.type === 'checkbox'));
  currencyField(1).props.onChange('USD');
  assert.equal(currencyField(0).props.value, 'USD');
  currencyField(0).props.onChange('EUR');
  assert.equal(currencyField(1).props.value, 'EUR');
  assert.equal(calls, 0);
  button(render(), 'Cancel').props.onClick();
  picker().props.onChange(['Monthly', 'Top-up']);
  currencyField(0).props.onChange('SGD');
  assert.equal(currencyField(1).props.value, 'SGD');
  assert.equal(calls, 0);
  props.account.billingComponents = savedComponents;
  hooks = [];
  // Leaving the edit view unmounts the draft; there is no effect or autosave path.
  assert(!read('components/SubscriptionBillingEditor.tsx').includes('useEffect'));
  assert(!saves.includes('createBillingTransaction'));
  hooks = [];
  const statusCalls = [];
  const AccountView = load('components/SubscriptionAccountView.tsx', {
    react,
    '@/components/ToolRowRenderer': { LinkedAccountCell: () => null },
    '@/components/DropdownControls': { DropdownControl: () => null },
    '@/components/SubscriptionBillingEditor': { default: Editor },
    '@/components/BillingPastEntryModal': { default: () => null },
    '@/components/BillingHistoryPanel': { default: () => null },
    '@/components/SubscriptionPayments': { default: () => null },
    '@/lib/billingHistory': { billingHistoryDisplayDate: (value) => value },
  }).default;
  const account = { ...props.account, planName: '', canManageBilling: true, toolName: 'Test Tool', status: 'Active', payments: [
    { id: 'p1', relationshipId: 'r1', paymentDate: '2026-08-10', planNameSnapshot: 'Historical', billingTypeSnapshot: 'Monthly', currency: 'SGD', amount: '20', status: 'Paid' },
    { id: 'p2', relationshipId: 'r2', paymentDate: '2026-08-11' },
  ], activity: [{ id: 'a1', saved: true, event: 'Paused', date: '2026-08-01', note: 'First' }, { id: 'a2', saved: false, event: 'Resumed', date: '2026-08-02' }, { id: 'a3', saved: true, event: 'Cancelled', date: '2026-08-01', note: 'Second' }, { id: 'a4', saved: true, event: 'Trial Started', date: '2026-07-31' }] };
  const renderAccount = () => { cursor = 0; return AccountView({ ...props, account, onSaveStatus: async (...args) => statusCalls.push(args) }); };
  tree = renderAccount();
  assert(!nodes(tree).some((node) => node.props?.className === 'tool-status-chip' && node.props.children === 'Not set'));
  assert(nodes(tree).some((node) => node.props?.account?.relationshipId === 'r1' && typeof node.props?.canAdd === 'boolean'));
  assert(nodes(tree).some((node) => node.type === 'h3' && node.props.children === 'Account Activity'));
  assert.equal(nodes(tree).filter((node) => node.type === 'li').length, 2);
  assert.equal(nodes(tree).filter((node) => node.props?.className === 'subscription-activity-event').length, 3);
  assert.equal(nodes(tree).filter((node) => node.type === 'span' && node.props.children === '2026-08-01').length, 1);
  assert.deepEqual(nodes(tree).filter((node) => node.props?.className === 'subscription-activity-event').map((node) => nodes(node).find((child) => child.type === 'strong').props.children[0]), ['Paused', 'Cancelled', 'Trial Started']);
  nodes(tree).find((node) => node.props?.id === 'subscription-status').props.onChange('Goodbye');
  await button(renderAccount(), 'Save changes').props.onClick();
  assert.deepEqual(statusCalls, [['r1', 'Goodbye']]);
  nodes(renderAccount()).find((node) => node.props?.['aria-label'] === 'Edit Current Billing').props.onClick();
  tree = renderAccount();
  assert(nodes(tree).some((node) => node.type === Editor));
  assert(nodes(tree).some((node) => node.props?.className === 'subscription-current-components'));
  assert(nodes(tree).some((node) => node.props?.['aria-labelledby'] === 'subscription-current-billing-modal-title'));
  nodes(tree).find((node) => node.type === Editor).props.onClose();
  assert(nodes(renderAccount()).some((node) => node.props?.className === 'subscription-current-components'));
  nodes(renderAccount()).find((node) => node.props?.['aria-label'] === 'Edit Current Billing').props.onClick();
  const editorProps = nodes(renderAccount()).find((node) => node.type === Editor).props;
  const originalSave = props.onSaveBilling;
  props.onSaveBilling = async () => { throw new Error('save failed'); };
  await assert.rejects(nodes(renderAccount()).find((node) => node.type === Editor).props.onSaveBilling('r1', '', saved));
  assert(!nodes(renderAccount()).some((node) => node.props?.id === 'subscription-payment-prompt'));
  props.onSaveBilling = originalSave;
  await editorProps.onSaveBilling('r1', '', saved);
  editorProps.onClose();
  assert(!nodes(renderAccount()).some((node) => node.props?.id === 'subscription-payment-prompt'));
  assert.equal(account.payments[0].currency, 'SGD');
  hooks = [];
  const ChoiceModal = load('components/BillingPastEntryModal.tsx', { react: { ...react, useMemo: (fn) => fn() }, '@/components/ToolRowRenderer': { LinkedAccountCell: () => null } }).default;
  let continued;
  const scopedChoiceProps = { relationships: [account, { ...account, relationshipId: 'r2' }], lockedRelationshipId: 'r1', onCancel() {}, onContinue: (relationship) => { continued = relationship.relationshipId; } };
  const renderChoice = (props) => { cursor = 0; return ChoiceModal(props); };
  tree = renderChoice(scopedChoiceProps);
  assert(!nodes(tree).some((node) => node.type === 'input' && node.props.type === 'search'));
  assert(!nodes(tree).some((node) => node.props?.role === 'listbox'));
  nodes(tree).find((node) => node.type === 'button' && nodes(node).some((child) => child.type === 'strong' && child.props.children === 'Single Payment')).props.onClick();
  button(renderChoice(scopedChoiceProps), 'Continue').props.onClick();
  assert.equal(continued, 'r1');
  hooks = [];
  const multipleChoice = { ...scopedChoiceProps, billingComponents: prefillComponents };
  tree = renderChoice(multipleChoice);
  nodes(tree).find((node) => node.type === 'button' && nodes(node).some((child) => child.type === 'strong' && child.props.children === 'Single Payment')).props.onClick();
  assert.equal(button(renderChoice(multipleChoice), 'Continue').props.disabled, true);
  button(renderChoice(multipleChoice), 'Top-up credit').props.onClick();
  assert.equal(button(renderChoice(multipleChoice), 'Continue').props.disabled, false);
  hooks = [];
  assert(nodes(renderChoice({ ...scopedChoiceProps, lockedRelationshipId: undefined })).some((node) => node.type === 'input' && node.props.type === 'search'));
  hooks = [];
  account.billingComponents = [];
  account.state = 'Not started';
  button(renderAccount(), 'Set up billing').props.onClick();
  tree = renderAccount();
  assert(!nodes(tree).some((node) => node.type === Editor));
  const firstChoice = nodes(tree).find((node) => node.props?.lockedRelationshipId === 'r1');
  assert(firstChoice);
  firstChoice.props.onContinue(account, 'single');
  const firstPanel = nodes(renderAccount()).find((node) => node.props?.initialEntryMode === 'single');
  assert.equal(typeof firstPanel.props.onEstablishCurrentBilling, 'function');
  await assert.rejects(firstPanel.props.onEstablishCurrentBilling('r2', '', setupComponents));
  hooks = [];
  account.state = 'Incomplete';
  account.billingComponents = [{ ...monthly, amount: '' }, topup];
  button(renderAccount(), 'Complete setup').props.onClick();
  tree = renderAccount();
  assert(!nodes(tree).some((node) => node.type === Editor));
  const incompleteChoice = nodes(tree).find((node) => node.props?.lockedRelationshipId === 'r1');
  assert.deepEqual(incompleteChoice.props.billingComponents, account.billingComponents);
  incompleteChoice.props.onContinue(account, 'period');
  const incompletePanel = nodes(renderAccount()).find((node) => node.props?.initialEntryMode === 'period');
  let completedSave;
  props.onSaveBilling = async (...args) => { completedSave = args; };
  await nodes(renderAccount()).find((node) => node.props?.initialEntryMode === 'period').props.onEstablishCurrentBilling('r1', 'Pro', [setupComponents[0]]);
  assert.equal(completedSave[0], 'r1');
  assert.deepEqual(completedSave[2][1], topup);
  assert.equal(completedSave[2][0].id, monthly.id);
  assert.equal(typeof incompletePanel.props.onSetupComplete, 'function');
  hooks = [];
  account.payments = [];
  const paymentComponent = () => nodes(renderAccount()).find((node) => node.props?.account?.relationshipId === account.relationshipId && typeof node.props?.canAdd === 'boolean');
  assert.equal(paymentComponent().props.canAdd, true);
  hooks = [];
  account.canManageBilling = false;
  assert.equal(paymentComponent().props.canAdd, false);
  account.canManageBilling = true;
  account.relationshipId = '';
  assert.equal(paymentComponent().props.canAdd, false);
  hooks = [];
  {
  const writes = [];
  let failCreate = false;
  let releaseUpdate;
  let delayUpdate = false;
  const Payments = load('components/SubscriptionPayments.tsx', {
    react,
    '@/components/DropdownControls': { DropdownControl: () => null },
    '@/lib/billingHistory': { billingHistoryDisplayDate: (value) => value },
    '@/lib/supabase/billingTransactions': {
      updateBillingTransaction: async (id, values) => { writes.push({ id, values }); if (delayUpdate) await new Promise((resolve) => { releaseUpdate = resolve; }); return { ...historical, ...values, id }; },
      createBillingTransaction: async (values) => { writes.push(values); if (failCreate) throw new Error('Retry'); return { ...historical, ...values, id: 'new-payment' }; },
    },
  }).default;
  const historical = { id: 'p1', source: 'manual', relationshipId: 'r1', paymentDate: '2026-01-10', planNameSnapshot: 'Old plan', billingTypeSnapshot: 'Monthly', amount: '8', currency: 'USD', status: 'Paid', note: 'Preserved note' };
  account.relationshipId = 'r1';
  account.billingComponents = setupComponents;
  account.payments = [historical, { ...historical, id: 'legacy', source: 'legacy_json' }, { ...historical, id: 'api', source: 'api' }, { ...historical, id: 'other-account', relationshipId: 'r2' }];
  const billingBefore = JSON.stringify(account.billingComponents);
  const renderPayments = () => { cursor = 0; return Payments({ account, canAdd: true, currencyOptions: ['USD', 'SGD', 'EUR'].map((value) => ({ label: value, value })) }); };
  const field = (label) => nodes(renderPayments()).find((node) => (node.props?.['aria-label'] ?? node.props?.ariaLabel) === label);
  assert.equal(nodes(renderPayments()).filter((node) => node.props?.className === 'subscription-payment-cell').length, 5);
  for (const label of ['Date', 'Plan', 'Type', 'Currency/Amount', 'Status']) {
    field(`Edit ${label}`).props.onClick();
    assert(field('Payment Date'));
    button(renderPayments(), 'Cancel').props.onClick();
  }
  assert.equal(writes.length, 0);
  for (const id of ['legacy', 'api']) {
    const row = nodes(renderPayments()).find((node) => node.props?.['data-transaction-id'] === id);
    assert(!nodes(row).some((node) => node.type === 'button'));
  }
  assert(!nodes(renderPayments()).some((node) => node.props?.['data-transaction-id'] === 'other-account'));
  field('Edit Plan').props.onClick();
  assert.equal(field('Plan Name').props.value, 'Old plan');
  field('Amount').props.onChange({ target: { value: '99' } });
  button(renderPayments(), 'Cancel').props.onClick();
  assert.equal(writes.length, 0);
  assert.equal(historical.amount, '8');
  field('Edit Currency/Amount').props.onClick();
  field('Amount').props.onChange({ target: { value: '9' } });
  await button(renderPayments(), 'Save').props.onClick();
  assert.equal(writes[0].id, 'p1');
  assert.equal(writes[0].values.amount, '9');
  assert.equal(writes[0].values.note, undefined);
  assert.equal(writes[0].values.relationshipId, undefined);
  button(renderPayments(), '+ Add Payment').props.onClick();
  assert.equal(field('Billing Type').props.value, ''); // Monthly + Top-up is ambiguous.
  field('Billing Type').props.onChange('Top-up');
  assert.equal(field('Amount').props.value, '5');
  assert.equal(field('Currency').props.value, 'SGD');
  field('Billing Type').props.onChange('Monthly');
  assert.equal(field('Amount').props.value, '30');
  assert.equal(field('Payment Date').props.value, '2026-08-25');
  failCreate = true;
  await button(renderPayments(), 'Save').props.onClick();
  assert(field('Amount')); // Failed save retains the local draft.
  const retryKey = writes[1].sourceKey;
  failCreate = false;
  await button(renderPayments(), 'Save').props.onClick();
  assert.equal(writes[2].sourceKey, retryKey);
  assert.equal(writes[2].relationshipId, 'r1');
  assert.equal(JSON.stringify(account.billingComponents), billingBefore);
  button(renderPayments(), '+ Add Payment').props.onClick();
  button(renderPayments(), 'Cancel').props.onClick();
  assert.equal(writes.length, 3);
  account.payments.push({ ...historical, id: 'p2', amount: '12', currency: '' }, { ...historical, id: 'p3', amount: '15', currency: '' });
  const row = (id) => nodes(renderPayments()).find((node) => node.props?.['data-transaction-id'] === id);
  const rowField = (id, label) => nodes(row(id)).find((node) => (node.props?.['aria-label'] ?? node.props?.ariaLabel) === label);
  rowField('p1', 'Edit Plan').props.onClick();
  rowField('p1', 'Plan Name').props.onChange({ target: { value: 'Draft A' } });
  rowField('p2', 'Edit Currency/Amount').props.onClick();
  rowField('p2', 'Amount').props.onChange({ target: { value: '42' } });
  rowField('p3', 'Edit Currency/Amount').props.onClick();
  button(renderPayments(), '+ Add Payment').props.onClick();
  const newRow = () => nodes(renderPayments()).find((node) => node.props?.['data-draft-key'] === 'new');
  assert(newRow());
  assert.equal(rowField('p1', 'Plan Name').props.value, 'Draft A');
  assert.equal(rowField('p2', 'Amount').props.value, '42');
  const newRowField = (label) => nodes(newRow()).find((node) => (node.props?.['aria-label'] ?? node.props?.ariaLabel) === label);
  // Explicit saved currency stays intact; blank/manual and new drafts share the account entry currency.
  assert.equal(rowField('p1', 'Currency').props.value, 'USD');
  assert.equal(rowField('p2', 'Currency').props.value, 'SGD');
  assert.equal(rowField('p3', 'Currency').props.value, 'SGD');
  assert.equal(newRowField('Currency').props.value, 'SGD');
  rowField('p2', 'Currency').props.onChange('EUR');
  assert.equal(rowField('p1', 'Currency').props.value, 'USD');
  assert.equal(rowField('p3', 'Currency').props.value, 'EUR');
  assert.equal(newRowField('Currency').props.value, 'EUR');
  rowField('p3', 'Currency').props.onChange('SGD');
  assert.equal(rowField('p2', 'Currency').props.value, 'SGD');
  assert.equal(newRowField('Currency').props.value, 'SGD');
  assert.equal(account.payments.find((payment) => payment.id === 'other-account').currency, 'USD');
  assert.equal(rowField('p2', 'Amount').props.value, '42');
  assert.equal(rowField('p3', 'Amount').props.value, '15');
  assert.equal(rowField('p1', 'Amount').props.value, '9');
  assert(nodes(renderPayments()).some((node) => node.type === 'small' && node.props.children === 'Complete the current row to add another.'));
  button(row('p1'), 'Cancel').props.onClick();
  assert.equal(rowField('p2', 'Amount').props.value, '42');
  assert(newRow());
  rowField('p1', 'Edit Plan').props.onClick();
  assert.equal(rowField('p1', 'Plan Name').props.value, 'Old plan');
  rowField('p1', 'Amount').props.onChange({ target: { value: 'invalid' } });
  await button(row('p1'), 'Save').props.onClick();
  const feedback = (id) => nodes(renderPayments()).find((node) => node.props?.['data-error-key'] === id);
  assert(nodes(feedback('p1')).some((node) => node.props?.role === 'alert'));
  assert(!feedback('p2'));
  delayUpdate = true;
  const saveB = button(row('p2'), 'Save').props.onClick();
  await button(row('p2'), 'Save').props.onClick(); // Same-row double Save is ignored.
  assert.equal(writes.length, 4);
  assert.equal(button(row('p2'), 'Save').props.disabled, true);
  assert.equal(button(row('p1'), 'Save').props.disabled, false);
  rowField('p1', 'Amount').props.onChange({ target: { value: '17' } });
  delayUpdate = false;
  await button(row('p1'), 'Save').props.onClick();
  assert.equal(writes[4].id, 'p1');
  assert.equal(writes[4].values.amount, '17');
  assert.equal(rowField('p2', 'Amount').props.value, '42');
  releaseUpdate();
  await saveB;
  assert.equal(writes[3].id, 'p2');
  assert.equal(writes[3].values.amount, '42');
  assert(newRow());
  button(newRow(), 'Cancel').props.onClick();
  button(row('p3'), 'Cancel').props.onClick();
  assert.equal(JSON.stringify(account.billingComponents), billingBefore);
  assert.equal(writes.length, 5);
  }
  console.log('PASS: setup routing, billing drafts, inline payment Save/Cancel, exact isolation, prefill, read-only legacy rows, retry keys, and unchanged Current Billing.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
