const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function load(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  const moduleRecord = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", output)((name) => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      return load(fs.existsSync(path.join(root, `${stem}.ts`)) ? `${stem}.ts` : `${stem}.tsx`, dependencies);
    }
    return require(name);
  }, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}

function queryResult(result) {
  const chain = {
    from() { return chain; },
    select() { return chain; },
    in() { return chain; },
    order() { return chain; },
    range() { return Promise.resolve(result); },
  };
  return chain;
}

function pagedQuery(records, ranges, count = records.length) {
  const chain = {
    from() { return chain; },
    select() { return chain; },
    in() { return chain; },
    order() { return chain; },
    range(from, to) {
      ranges.push([from, to]);
      return Promise.resolve({ count, data: records.slice(from, to + 1), error: null });
    },
  };
  return chain;
}

function correctionRecord(index, relationshipId = "relationship-1") {
  const suffix = String(index).padStart(4, "0");
  const snapshot = {
    amount: "10.000000", billingType: "Monthly", currency: "USD", note: "", paymentDate: "2026-10-01",
    planName: "Pro", relationshipId, source: "manual", sourceKey: `manual-${suffix}`, status: "Paid", transactionId: `payment-${suffix}`,
  };
  return {
    after_snapshot: snapshot, before_snapshot: snapshot, changed_fields: ["note"], created_at: `2026-10-01T00:00:00.${suffix}Z`,
    effective_date: "2026-10-01", id: `event-${suffix}`, payment_source: "manual", payment_transaction_id: `payment-${suffix}`,
    request_id: `request-${suffix}`, tool_email_link_id: relationshipId, user_id: "user-1",
  };
}

const unavailable = "Payment corrections are temporarily unavailable until the database update is complete.";
const disabledAvailability = { paymentCorrectionsEnabled: false, paymentCorrectionsUnavailableMessage: unavailable };
const enabledAvailability = { paymentCorrectionsEnabled: true, paymentCorrectionsUnavailableMessage: unavailable };

(async () => {
  let clientCalls = 0;
  const disabledHistory = load("lib/supabase/billingPaymentCorrectionEvents.ts", {
    "@/lib/paymentCorrectionAvailability": disabledAvailability,
    "@/lib/supabase/client": { createClient: () => { clientCalls += 1; throw new Error("unexpected Supabase history request"); } },
  });
  assert.deepEqual(await disabledHistory.getBillingPaymentCorrectionEventsByRelationships(["relationship-1"]), []);
  assert.equal(clientCalls, 0, "disabled correction history must not create a Supabase client");

  let historyQueries = 0;
  const enabledHistory = load("lib/supabase/billingPaymentCorrectionEvents.ts", {
    "@/lib/paymentCorrectionAvailability": enabledAvailability,
    "@/lib/supabase/client": { createClient: () => ({ from: () => { historyQueries += 1; return queryResult({ count: 0, data: [], error: null }); } }) },
  });
  assert.deepEqual(await enabledHistory.getBillingPaymentCorrectionEventsByRelationships(["relationship-1"]), []);
  assert.equal(historyQueries, 1, "enabled correction history must retain the Supabase query");

  const historyRecords = Array.from({ length: 501 }, (_, index) => correctionRecord(index));
  const historyRanges = [];
  const pagedHistory = load("lib/supabase/billingPaymentCorrectionEvents.ts", {
    "@/lib/paymentCorrectionAvailability": enabledAvailability,
    "@/lib/supabase/client": { createClient: () => ({ from: () => pagedQuery(historyRecords, historyRanges) }) },
  });
  const completeHistory = await pagedHistory.getBillingPaymentCorrectionEventsByRelationships(["relationship-1"]);
  assert.equal(completeHistory.length, 501, "enabled correction history must load every page");
  assert.deepEqual(historyRanges, [[0, 499], [500, 999]], "correction history must continue until the exact count is loaded");
  assert.equal(completeHistory[0].id, "event-0500", "paginated history must retain newest-first presentation order");

  const incompleteHistory = load("lib/supabase/billingPaymentCorrectionEvents.ts", {
    "@/lib/paymentCorrectionAvailability": enabledAvailability,
    "@/lib/supabase/client": { createClient: () => ({ from: () => pagedQuery(historyRecords.slice(0, 500), [], 501) }) },
  });
  await assert.rejects(
    incompleteHistory.getBillingPaymentCorrectionEventsByRelationships(["relationship-1"]),
    /ended before every record was loaded/,
    "correction history must fail closed instead of returning a silently truncated result",
  );

  const databaseError = { code: "42501", message: "permission denied for payment correction history" };
  const failingHistory = load("lib/supabase/billingPaymentCorrectionEvents.ts", {
    "@/lib/paymentCorrectionAvailability": enabledAvailability,
    "@/lib/supabase/client": { createClient: () => ({ from: () => queryResult({ count: null, data: null, error: databaseError }) }) },
  });
  await assert.rejects(
    failingHistory.getBillingPaymentCorrectionEventsByRelationships(["relationship-1"]),
    (error) => error === databaseError,
    "enabled correction history must not swallow unrelated database errors",
  );

  let disabledRpcClients = 0;
  const disabledClient = { createClient: () => { disabledRpcClients += 1; throw new Error("unexpected correction RPC client"); } };
  const disabledTransactions = load("lib/supabase/billingTransactions.ts", {
    "@/lib/paymentCorrectionAvailability": disabledAvailability,
    "@/lib/supabase/client": disabledClient,
  });
  const disabledRenewals = load("lib/supabase/billingRenewalPeriods.ts", {
    "@/lib/paymentCorrectionAvailability": disabledAvailability,
    "@/lib/supabase/client": disabledClient,
  });
  const manualPayment = {
    amount: "10", billingTypeSnapshot: "Monthly", currency: "USD", id: "manual-1", note: "",
    paymentDate: "2026-10-01", planNameSnapshot: "Pro", relationshipId: "relationship-1",
    source: "manual", sourceKey: "manual-1", status: "Paid", updatedAt: "2026-10-01T00:00:00.000Z",
  };
  await assert.rejects(
    disabledTransactions.correctManualBillingTransaction(manualPayment, {}, "request-1"),
    new RegExp(unavailable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  await assert.rejects(
    disabledRenewals.updateBillingRenewalPayment("relationship-1", "period-1", "renewal-1", {
      amount: "10", billingType: "Monthly", currency: "USD", expectedUpdatedAt: manualPayment.updatedAt,
      paymentDate: "2026-10-01", planName: "Pro", requestId: "request-2",
    }),
    new RegExp(unavailable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.equal(disabledRpcClients, 0, "disabled correction wrappers must fail before creating a Supabase client");

  let enabledRpcCalls = 0;
  const rpcError = { message: "enabled RPC reached Supabase" };
  const enabledClient = { createClient: () => ({ rpc: async () => { enabledRpcCalls += 1; return { data: null, error: rpcError }; } }) };
  const enabledTransactions = load("lib/supabase/billingTransactions.ts", {
    "@/lib/paymentCorrectionAvailability": enabledAvailability,
    "@/lib/supabase/client": enabledClient,
  });
  const enabledRenewals = load("lib/supabase/billingRenewalPeriods.ts", {
    "@/lib/paymentCorrectionAvailability": enabledAvailability,
    "@/lib/supabase/client": enabledClient,
  });
  await assert.rejects(enabledTransactions.correctManualBillingTransaction(manualPayment, {}, "request-3"), (error) => error === rpcError);
  await assert.rejects(enabledRenewals.updateBillingRenewalPayment("relationship-1", "period-1", "renewal-1", {
    amount: "10", billingType: "Monthly", currency: "USD", expectedUpdatedAt: manualPayment.updatedAt,
    paymentDate: "2026-10-01", planName: "Pro", requestId: "request-4",
  }), (error) => error === rpcError);
  assert.equal(enabledRpcCalls, 2, "enabled compatibility state must retain both correction RPC paths");

  const page = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8");
  const historyPanel = fs.readFileSync(path.join(root, "components/BillingHistoryPanel.tsx"), "utf8");
  const subscriptionAccount = fs.readFileSync(path.join(root, "components/SubscriptionAccountView.tsx"), "utf8");
  assert.match(page, /catch \(error: unknown\) \{[\s\S]*?Could not detect overdue renewals\.[\s\S]*?return;[\s\S]*?Could not load renewal and Account Activity data\./,
    "synchronization and subsequent data-loading errors must use separate handling");
  assert.match(page, /typeof message === "string" && message\.trim\(\)/,
    "plain Supabase error objects must retain their actual messages");
  assert.match(historyPanel, /allowPaymentCorrections = false/,
    "Billing History must default to read-only correction permissions");
  assert.match(historyPanel, /transaction\.source === "manual" && \(!allowPaymentCorrections \|\| !paymentCorrectionsEnabled\) \? <span>—<\/span>/,
    "Billing History must hide manual-payment editing unless its Subscriptions caller explicitly allows corrections");
  assert.match(subscriptionAccount, /<BillingHistoryPanel allowPaymentCorrections/,
    "Subscriptions must explicitly opt its payment workflow into correction editing");
  assert.doesNotMatch(page, /<BillingHistoryPanel\s+allowPaymentCorrections/,
    "Billing must never opt its history panel into correction editing");

  console.log("PASS: disabled payment-correction compatibility avoids 0035 reads and RPCs, hides edits, preserves Add Payment, and restores normal paths when enabled.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
