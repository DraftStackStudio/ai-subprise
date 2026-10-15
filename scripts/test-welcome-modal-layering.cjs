const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const styles = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
const modals = fs.readFileSync(path.join(root, "components", "DashboardConfirmationModals.tsx"), "utf8");

assert.match(
  styles,
  /\.dashboard-attention-panel\s*\{[^}]*\bisolation:\s*isolate;/s,
  "Action Needed must contain its decorative z-index layers inside a local stacking context.",
);
assert.match(
  styles,
  /\.welcome-modal-overlay\s*\{[^}]*\bposition:\s*fixed;[^}]*\bz-index:\s*100;/s,
  "Welcome modals must retain the shared fixed full-application overlay layer.",
);
assert.match(
  modals,
  /className="welcome-modal-overlay"[\s\S]*className="welcome-modal onboarding-how-it-works-modal"/,
  "How it works must continue to use the shared welcome modal overlay.",
);

console.log("PASS: Welcome modal backdrop contains Dashboard decorative layers without changing modal behaviour.");
