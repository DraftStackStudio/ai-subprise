const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(relativePath, dependencies = {}) {
  const cacheKey = dependencies && Object.keys(dependencies).length ? null : relativePath;
  if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey);
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const moduleRecord = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", output)((name) => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      return load(fs.existsSync(path.join(root, `${stem}.ts`)) ? `${stem}.ts` : `${stem}.tsx`);
    }
    return require(name);
  }, moduleRecord, moduleRecord.exports);
  if (cacheKey) cache.set(cacheKey, moduleRecord.exports);
  return moduleRecord.exports;
}

let hooks = [];
let cursor = 0;
const react = {
  useRef(initial) {
    const index = cursor++;
    return hooks[index] ?? (hooks[index] = { current: initial });
  },
  useState(initial) {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = initial;
    return [hooks[index], (value) => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
  },
};
const DateFieldControl = (props) => ({ type: "date-field-control", props });
const DropdownControl = (props) => ({ type: "dropdown-control", props });
const MultiSelectDropdownControl = (props) => ({ type: "multi-select-dropdown-control", props });
const Editor = load("components/SubscriptionBillingEditor.tsx", {
  react,
  "@/components/DateFieldControl": { default: DateFieldControl },
  "@/components/DropdownControls": { DropdownControl, MultiSelectDropdownControl },
  "./SubscriptionBillingEditor.module.css": { default: {
    modeCopy: "modeCopy",
    modeOption: "modeOption",
    modeOptions: "modeOptions",
    selected: "selected",
  } },
}).default;

const primaryId = "a0350000-0000-0000-0000-000000000401";
const replacementId = "a0350000-0000-0000-0000-000000000402";
const revision = {
  planName: "Pro",
  components: {
    primary: {
      amount: "30.84",
      billingType: "Monthly",
      currency: "SGD",
      id: primaryId,
      lastTopUpDate: null,
      nextRenewalDate: "2026-11-16",
      purchaseDate: null,
    },
  },
};
const account = {
  billingComponents: [{
    amount: "30.84",
    billingType: "Monthly",
    currency: "SGD",
    id: primaryId,
    nextRenewalDate: "2026-11-16",
  }],
  currentBillingRevision: revision,
  planName: "Pro",
  relationshipId: "a0350000-0000-0000-0000-000000000301",
  state: "Complete",
};
const noop = async () => {};
const baseProps = {
  account,
  currencyOptions: [{ label: "SGD", value: "SGD" }],
  onClose() {},
  onConfirmRenewalPaid: noop,
  onMarkRenewalNotCharged: noop,
  onPauseSubscription: noop,
  onRecordResumePayment: noop,
  onResumeSubscription: noop,
  onSaveBilling: noop,
  onSavePaymentAssistedBilling: noop,
  onUpdateCurrentBilling: noop,
  onUndoRenewalResolution: noop,
  onUpdateRenewalPeriodSnapshot: noop,
};
const nodes = (node) => !node || typeof node !== "object"
  ? []
  : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const nodeText = (node) => typeof node === "string" ? node : !node || typeof node !== "object"
  ? ""
  : Array.isArray(node) ? node.map(nodeText).join("") : nodeText(node.props?.children);
const button = (tree, text) => nodes(tree).find((node) => node.type === "button" && (node.props["aria-label"] === text || nodeText(node) === text));
const choice = (tree, text) => nodes(tree).find((node) => node.type === "input" && node.props.type === "radio" && node.props["aria-label"] === text);
const activityPreview = (tree) => nodes(tree).find((node) => node.props?.className === "subscription-current-activity-preview");
const flush = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
  let legacySaves = 0;
  const submissions = [];
  let saved = 0;
  const props = {
    ...baseProps,
    onSaveBilling: async () => { legacySaves++; },
    onSaved: () => { saved++; },
    preparedUpdate: {
      revision,
      onSubmit: async (input) => {
        submissions.push(input);
        if (submissions.length < 3) throw new Error("retry this save");
      },
    },
  };
  const render = () => { cursor = 0; return Editor(props); };

  let tree = render();
  assert.equal(choice(tree, "My subscription details have changed").props.checked, false);
  assert.equal(choice(tree, "I'm correcting incorrect information").props.checked, false);
  assert(!nodes(tree).some((node) => node.props?.ariaLabel === "Current Billing effective date"));
  assert(nodes(tree).some((node) => node.type === "textarea" && node.props["aria-label"] === "Current Billing update reason"));
  assert.match(nodeText(activityPreview(tree)), /Choose why you are updating these details/);
  assert.equal(button(tree, "Save changes").props.disabled, true, "unchanged drafts must not save");
  let orderedNodes = nodes(tree);
  assert(orderedNodes.indexOf(choice(tree, "My subscription details have changed")) < orderedNodes.findIndex((node) => node.props?.["aria-label"] === "Current Billing Plan Name"));
  assert(orderedNodes.findIndex((node) => node.props?.inputMode === "decimal") < orderedNodes.findIndex((node) => node.props?.["aria-label"] === "Current Billing update reason"));
  assert(orderedNodes.findIndex((node) => node.props?.["aria-label"] === "Current Billing update reason") < orderedNodes.indexOf(activityPreview(tree)));
  assert(orderedNodes.indexOf(activityPreview(tree)) < orderedNodes.indexOf(button(tree, "Save changes")));

  choice(tree, "My subscription details have changed").props.onChange();
  tree = render();
  assert.equal(choice(tree, "My subscription details have changed").props.checked, true);
  assert(nodes(tree).some((node) => node.props?.ariaLabel === "Current Billing effective date"));
  orderedNodes = nodes(tree);
  assert(orderedNodes.findIndex((node) => node.props?.inputMode === "decimal") < orderedNodes.findIndex((node) => node.props?.ariaLabel === "Current Billing effective date"));
  assert(orderedNodes.findIndex((node) => node.props?.ariaLabel === "Current Billing effective date") < orderedNodes.findIndex((node) => node.props?.["aria-label"] === "Current Billing update reason"));
  assert.match(nodeText(activityPreview(tree)), /No changes detected yet/);

  nodes(tree).find((node) => node.type === "input" && node.props.inputMode === "decimal")
    .props.onChange({ target: { value: "35" } });
  tree = render();
  assert.match(nodeText(activityPreview(tree)), /Price changed/);
  assert.match(nodeText(activityPreview(tree)), /SGD 30\.84 → SGD 35/);
  assert.equal(button(tree, "Save changes").props.disabled, false);
  const openedRevision = props.preparedUpdate.revision;
  props.preparedUpdate.revision = {
    ...revision,
    components: { primary: { ...revision.components.primary, id: replacementId } },
  };

  tree.props.onSubmit({ preventDefault() {} });
  await flush();
  tree = render();
  assert(nodes(tree).some((node) => node.props?.role === "alert" && node.props.children === "retry this save"));
  tree.props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(submissions.length, 2);
  assert.equal(submissions[0].requestId, submissions[1].requestId, "an unchanged retry must reuse its request ID");
  assert.deepEqual(submissions[0].expectedRevision, openedRevision, "the editor must retain its opening revision value");
  assert.notEqual(submissions[0].expectedRevision, props.preparedUpdate.revision, "later relationship props must not replace the opening revision");
  assert.equal(legacySaves, 0, "prepared updates must never use the legacy save callback");

  tree = render();
  nodes(tree).find((node) => node.type === "textarea").props.onChange({ target: { value: "Provider changed pricing" } });
  render().props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(submissions.length, 3);
  assert.notEqual(submissions[2].requestId, submissions[1].requestId, "editing the logical submission must reset its request ID");
  assert.equal(submissions[2].reason, "Provider changed pricing");
  assert.equal(submissions[2].mode, "change");
  assert.equal(submissions[2].components[0].amount, "35");
  assert.equal(saved, 1);
  assert.equal(legacySaves, 0);

  hooks = [];
  const correctionSubmissions = [];
  const correctionProps = {
    ...baseProps,
    preparedUpdate: { revision, onSubmit: async (input) => { correctionSubmissions.push(input); } },
  };
  const renderCorrection = () => { cursor = 0; return Editor(correctionProps); };
  tree = renderCorrection();
  choice(tree, "I'm correcting incorrect information").props.onChange();
  tree = renderCorrection();
  assert.equal(choice(tree, "I'm correcting incorrect information").props.checked, true);
  assert(!nodes(tree).some((node) => node.props?.ariaLabel === "Current Billing effective date"));
  assert(nodes(tree).some((node) => node.props?.className === "subscription-current-update-helper"));
  nodes(tree).find((node) => node.type === "input" && node.props.inputMode === "decimal")
    .props.onChange({ target: { value: "35" } });
  tree = renderCorrection();
  assert.match(nodeText(activityPreview(tree)), /Current Billing corrected/);
  assert.match(nodeText(activityPreview(tree)), /Monthly · SGD 35/);
  assert.match(nodeText(activityPreview(tree)), /Original values will remain available through View correction details/);
  tree.props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(correctionSubmissions[0].mode, "correction");
  assert.equal(correctionSubmissions[0].effectiveDate, correctionSubmissions[0].localDate);

  hooks = [];
  const renderMultiple = () => { cursor = 0; return Editor({
    ...baseProps,
    preparedUpdate: { revision, onSubmit: async () => {} },
  }); };
  tree = renderMultiple();
  choice(tree, "My subscription details have changed").props.onChange();
  tree = renderMultiple();
  nodes(tree).find((node) => node.type === "input" && node.props["aria-label"] === "Current Billing Plan Name")
    .props.onChange({ target: { value: "Business" } });
  nodes(renderMultiple()).find((node) => node.type === "input" && node.props.inputMode === "decimal")
    .props.onChange({ target: { value: "50" } });
  tree = renderMultiple();
  assert.match(nodeText(activityPreview(tree)), /Plan changed/);
  assert.match(nodeText(activityPreview(tree)), /Pro → Business/);
  assert.match(nodeText(activityPreview(tree)), /SGD 30\.84 → SGD 50/);

  hooks = [];
  const renderCycle = () => { cursor = 0; return Editor({
    ...baseProps,
    preparedUpdate: { revision, onSubmit: async () => {} },
  }); };
  tree = renderCycle();
  choice(tree, "My subscription details have changed").props.onChange();
  tree = renderCycle();
  nodes(tree).find((node) => node.props?.ariaLabel === "Billing Type").props.onChange(["Yearly"]);
  tree = renderCycle();
  assert.match(nodeText(activityPreview(tree)), /Billing cycle changed/);
  assert.match(nodeText(activityPreview(tree)), /Monthly → Yearly/);

  hooks = [];
  const renderType = () => { cursor = 0; return Editor({
    ...baseProps,
    preparedUpdate: { revision, onSubmit: async () => {} },
  }); };
  tree = renderType();
  choice(tree, "My subscription details have changed").props.onChange();
  tree = renderType();
  nodes(tree).find((node) => node.props?.ariaLabel === "Billing Type").props.onChange(["Lifetime"]);
  tree = renderType();
  assert.match(nodeText(activityPreview(tree)), /Billing type changed/);
  assert.match(nodeText(activityPreview(tree)), /Monthly → Lifetime/);

  hooks = [];
  const paymentPrefill = [{ ...account.billingComponents[0], amount: "42", currency: "USD" }];
  const paymentAssistedProps = {
    ...baseProps,
    preparedUpdate: {
      initialComponents: paymentPrefill,
      initialMode: "correction",
      revision,
      onSubmit: async () => {},
    },
  };
  const renderPaymentAssisted = () => { cursor = 0; return Editor(paymentAssistedProps); };
  tree = renderPaymentAssisted();
  assert.equal(choice(tree, "I'm correcting incorrect information").props.checked, true);
  assert.equal(nodes(tree).find((node) => node.type === "input" && node.props.inputMode === "decimal").props.value, "42");
  assert.equal(nodes(tree).find((node) => node.props?.id === "subscription-0-currency").props.value, "USD");
  assert(!nodes(tree).some((node) => node.props?.ariaLabel === "Current Billing effective date"));

  hooks = [];
  const renderPaymentChange = () => { cursor = 0; return Editor({
    ...paymentAssistedProps,
    preparedUpdate: { ...paymentAssistedProps.preparedUpdate, initialMode: "change" },
  }); };
  tree = renderPaymentChange();
  assert.equal(choice(tree, "My subscription details have changed").props.checked, true);
  assert(nodes(tree).some((node) => node.props?.ariaLabel === "Current Billing effective date"));

  hooks = [];
  let unavailableSubmissions = 0;
  const unavailableProps = {
    ...baseProps,
    preparedUpdate: { revision: null, onSubmit: async () => { unavailableSubmissions++; } },
  };
  const renderUnavailable = () => { cursor = 0; return Editor(unavailableProps); };
  tree = renderUnavailable();
  choice(tree, "My subscription details have changed").props.onChange();
  tree = renderUnavailable();
  nodes(tree).find((node) => node.type === "input" && node.props.inputMode === "decimal")
    .props.onChange({ target: { value: "35" } });
  tree = renderUnavailable();
  assert.equal(button(tree, "Save changes").props.disabled, true);
  assert(nodes(tree).some((node) => node.props?.role === "alert" && /could not be verified/.test(node.props.children)));
  tree.props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(unavailableSubmissions, 0);

  hooks = [];
  let pendingSubmissions = 0;
  let releasePending;
  const pendingProps = {
    ...baseProps,
    preparedUpdate: {
      revision,
      onSubmit: async () => {
        pendingSubmissions++;
        await new Promise((resolve) => { releasePending = resolve; });
      },
    },
  };
  const renderPending = () => { cursor = 0; return Editor(pendingProps); };
  tree = renderPending();
  choice(tree, "My subscription details have changed").props.onChange();
  tree = renderPending();
  nodes(tree).find((node) => node.type === "input" && node.props.inputMode === "decimal")
    .props.onChange({ target: { value: "35" } });
  tree = renderPending();
  tree.props.onSubmit({ preventDefault() {} });
  tree.props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(pendingSubmissions, 1, "a pending save must suppress duplicate submissions");
  releasePending();
  await flush();

  hooks = [];
  let isolatedLegacySaves = 0;
  const isolatedProps = {
    ...baseProps,
    onSaveBilling: async () => { isolatedLegacySaves++; },
    preparedUpdate: { revision },
  };
  const renderIsolated = () => { cursor = 0; return Editor(isolatedProps); };
  tree = renderIsolated();
  choice(tree, "My subscription details have changed").props.onChange();
  tree = renderIsolated();
  nodes(tree).find((node) => node.type === "input" && node.props.inputMode === "decimal")
    .props.onChange({ target: { value: "35" } });
  tree = renderIsolated();
  assert.equal(button(tree, "Save changes").props.disabled, true, "the prepared editor stays disabled until Phase 3B supplies its callback");
  tree.props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(isolatedLegacySaves, 0);

  hooks = [];
  const setupSubmissions = [];
  const incompleteRevision = {
    planName: "Pro",
    components: { primary: { ...revision.components.primary, amount: null, nextRenewalDate: null } },
  };
  const setupProps = {
    ...baseProps,
    account: {
      ...account,
      billingComponents: [{ ...account.billingComponents[0], amount: "", nextRenewalDate: "" }],
      currentBillingRevision: incompleteRevision,
      state: "Incomplete",
    },
    onSaveBilling: async (input) => {
      setupSubmissions.push(input);
      if (setupSubmissions.length === 1) throw new Error("setup refresh failed");
    },
  };
  const renderSetup = () => { cursor = 0; return Editor(setupProps); };
  tree = renderSetup();
  assert(!choice(tree, "My subscription details have changed"), "initial setup must reuse its existing interface");
  nodes(tree).find((node) => node.type === "input" && node.props.inputMode === "decimal")
    .props.onChange({ target: { value: "0" } });
  renderSetup().props.onSubmit({ preventDefault() {} });
  await flush();
  tree = renderSetup();
  assert(nodes(tree).some((node) => node.props?.role === "alert" && node.props.children === "setup refresh failed"));
  tree.props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(setupSubmissions.length, 2);
  assert.equal(setupSubmissions[0].requestId, setupSubmissions[1].requestId, "a setup retry must reuse its request ID");
  assert.deepEqual(setupSubmissions[0].expectedRevision, incompleteRevision);
  assert.equal(setupSubmissions[0].mode, "change");
  assert.equal(setupSubmissions[0].effectiveDate, setupSubmissions[0].localDate);
  assert.equal(setupSubmissions[0].components[0].amount, "0", "explicit zero must survive setup");
  assert.equal(setupSubmissions[0].components[0].nextRenewalDate, "", "an optional billing date must remain blank");

  hooks = [];
  const futureProps = {
    ...baseProps,
    preparedUpdate: { revision, onSubmit: async () => { throw new Error("must not submit"); } },
  };
  const renderFuture = () => { cursor = 0; return Editor(futureProps); };
  tree = renderFuture();
  choice(tree, "My subscription details have changed").props.onChange();
  tree = renderFuture();
  nodes(tree).find((node) => node.type === "input" && node.props.inputMode === "decimal")
    .props.onChange({ target: { value: "35" } });
  nodes(renderFuture()).find((node) => node.props?.ariaLabel === "Current Billing effective date")
    .props.onChange("9999-12-31");
  tree = renderFuture();
  assert.equal(button(tree, "Save changes").props.disabled, true);
  assert(nodes(tree).some((node) => node.props?.role === "alert" && node.props.children === "Future billing changes are not supported."));

  const accountViewSource = fs.readFileSync(path.join(root, "components/SubscriptionAccountView.tsx"), "utf8");
  const pageSource = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8");
  assert.match(accountViewSource, /const currentBillingUpdateEligible = account\.canManageBilling[\s\S]*?account\.status === "Active"[\s\S]*?account\.planStatus === "Active" \|\| account\.planStatus === "Paid"[\s\S]*?account\.state === "Complete"/);
  assert.match(accountViewSource, /preparedUpdate=\{currentBillingUpdateEligible[\s\S]*?onSubmit: actions\.onUpdateCurrentBilling[\s\S]*?revision: account\.currentBillingRevision/);
  assert.match(pageSource, /persist: updateCurrentBilling/);
  assert.match(pageSource, /refresh: refreshSubscriptionRenewalData/);
  assert.match(fs.readFileSync(path.join(root, "app/globals.css"), "utf8"), /\.subscription-current-update-fields/);

  console.log("PASS: Current Billing choices, live activity previews, audited initial setup, effective date, reason, no-op guard, trusted opening revision, stable retries, duplicate-submit prevention, and save isolation verified.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
