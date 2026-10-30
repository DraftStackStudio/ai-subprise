const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "lib/paymentCorrectionAvailability.ts"), "utf8");

function loadAvailability(environment) {
  const previous = { ...process.env };
  for (const key of [
    "NEXT_PUBLIC_PAYMENT_CORRECTIONS_ENABLED",
    "NEXT_PUBLIC_VERCEL_ENV",
    "NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF",
  ]) delete process.env[key];
  Object.assign(process.env, environment);

  try {
    const moduleRecord = { exports: {} };
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function("require", "module", "exports", output)(require, moduleRecord, moduleRecord.exports);
    return moduleRecord.exports;
  } finally {
    process.env = previous;
  }
}

const previewBranch = "codex/payment-correction-preview";

assert.equal(loadAvailability({}).paymentCorrectionsEnabled, false, "missing variables must fail closed");
assert.equal(loadAvailability({
  NEXT_PUBLIC_PAYMENT_CORRECTIONS_ENABLED: "false",
  NEXT_PUBLIC_VERCEL_ENV: "preview",
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: previewBranch,
}).paymentCorrectionsEnabled, false, "an explicit false value must remain disabled");
assert.equal(loadAvailability({
  NEXT_PUBLIC_PAYMENT_CORRECTIONS_ENABLED: "true",
  NEXT_PUBLIC_VERCEL_ENV: "production",
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: previewBranch,
}).paymentCorrectionsEnabled, false, "production must remain disabled even if the rollout variable is set");
assert.equal(loadAvailability({
  NEXT_PUBLIC_PAYMENT_CORRECTIONS_ENABLED: "true",
  NEXT_PUBLIC_VERCEL_ENV: "preview",
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: "refactor/dashboard-modals",
}).paymentCorrectionsEnabled, false, "other Preview branches must remain disabled");
assert.equal(loadAvailability({
  NEXT_PUBLIC_PAYMENT_CORRECTIONS_ENABLED: "true",
  NEXT_PUBLIC_VERCEL_ENV: "preview",
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: previewBranch,
}).paymentCorrectionsEnabled, true, "only the dedicated temporary Preview branch may enable corrections");

const nextConfig = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
assert.match(nextConfig, /NEXT_PUBLIC_VERCEL_ENV: process\.env\.VERCEL_ENV \?\? ""/);
assert.match(nextConfig, /NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: process\.env\.VERCEL_GIT_COMMIT_REF \?\? ""/);

console.log("PASS: payment corrections fail closed and can only enable on the dedicated protected Preview branch.");
