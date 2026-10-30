const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/0035_add_billing_payment_correction_events.sql");
const payments = read("components/SubscriptionPayments.tsx");
const transactions = read("lib/supabase/billingTransactions.ts");
const renewalPeriods = read("lib/supabase/billingRenewalPeriods.ts");
const correctionHistory = read("lib/supabase/billingPaymentCorrectionEvents.ts");
const availability = read("lib/paymentCorrectionAvailability.ts");
const historyPanel = read("components/BillingHistoryPanel.tsx");
const page = read("app/dashboard/page.tsx");

assert.match(migration, /create table public\.billing_payment_correction_events/);
assert.match(migration, /unique \(user_id, request_id\)/, "request IDs must make retries idempotent");
assert.match(migration, /before_snapshot jsonb not null/);
assert.match(migration, /after_snapshot jsonb not null/);
assert.match(migration, /v_transaction\.updated_at is distinct from p_expected_updated_at/g,
  "manual and renewal corrections must reject stale saves");
assert.match(migration, /if cardinality\(v_changed\) = 0 then[\s\S]*?null::uuid/g,
  "no-op saves must not create events");
assert.match(migration, /payment_transaction_id uuid not null,/);
assert.doesNotMatch(migration, /payment_transaction_id uuid[^\n]*references public\.billing_transactions/,
  "manual hard deletion must not delete or be blocked by immutable correction history");
assert.match(migration, /drop policy if exists "billing_transactions_owner_update"/);
assert.match(migration, /revoke update on table public\.billing_transactions from authenticated/,
  "direct updates must not bypass correction recording");
assert.match(migration, /set actual_payment_date = p_payment_date, plan_name_snapshot = v_plan_name,[\s\S]*?billing_type_snapshot = p_billing_type/,
  "renewal corrections must update the exact period snapshot");
assert.doesNotMatch(migration, /update public\.tool_link_billing_components/,
  "historical corrections must not alter Current Billing or future cadence");
assert.doesNotMatch(migration, /insert into public\.billing_renewal_activity/,
  "new payment corrections must not duplicate legacy renewal activity");

assert.match(payments, /const renewalTypes: BillingTransactionType\[\] = \["Monthly", "Yearly"\]/);
assert.match(payments, /expectedUpdatedAt: originalPayment\.updatedAt/);
assert.match(payments, /requestId,/);
assert.match(payments, /originalPayment\?\.source === "manual" && value\.amount !== originalPayment\.amount/,
  "renewal edits must not show the Current Billing amount question");
assert.match(transactions, /correct_manual_billing_payment/);
assert.match(availability, /paymentCorrectionsEnabled = false/);
assert.match(correctionHistory, /if \(!paymentCorrectionsEnabled\) return \[\]/,
  "disabled compatibility mode must not query the 0035-only correction table");
assert.match(transactions, /if \(!paymentCorrectionsEnabled\) throw new Error\(paymentCorrectionsUnavailableMessage\)/,
  "manual correction must fail locally while migration 0035 is unavailable");
assert.match(renewalPeriods, /if \(!paymentCorrectionsEnabled\) throw new Error\(paymentCorrectionsUnavailableMessage\)/,
  "renewal correction must fail locally while migration 0035 is unavailable");
assert.match(payments, /const canEditPayment = paymentCorrectionsEnabled && canAdd/,
  "persisted Payment edit actions must be hidden while compatibility mode is disabled");
assert.match(historyPanel, /transaction\.source === "manual" && \(!allowPaymentCorrections \|\| !paymentCorrectionsEnabled\) \? <span>—<\/span>/,
  "Billing History must require both an enabled rollout and explicit Subscriptions correction permission");
assert.match(historyPanel, /allowPaymentCorrections = false/,
  "Billing History must default to read-only Payment rows");
assert.doesNotMatch(transactions, /\.from\("billing_transactions"\)[\s\S]{0,120}\.update\(/,
  "the client must not directly update historical payments");
assert.match(page, /getBillingPaymentCorrectionEventsByRelationship\(relationshipId\)/);
assert.match(page, /setBillingPaymentCorrectionEvents/);

console.log("PASS: immutable payment-correction ledger, guarded manual and renewal saves, no-op/stale/idempotency guards, exact period isolation, and refresh wiring verified.");
