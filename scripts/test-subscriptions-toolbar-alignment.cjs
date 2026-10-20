const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "components/SubscriptionsView.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
const toolbarStart = source.indexOf('<div className="category-view-tabs subscriptions-view-tabs"');
const tableStart = source.indexOf('{selectedView === "Upcoming" ? <BillingUpcomingView', toolbarStart);
const toolbar = source.slice(toolbarStart, tableStart);

assert.notEqual(toolbarStart, -1, "Subscriptions view toolbar must exist");
assert.match(toolbar, /category-view-tab-list/);
assert.match(toolbar, /table-search-filter-group/);
assert.match(toolbar, /Filter subscriptions by state/);
assert.match(toolbar, /Search subscriptions/);
assert.match(toolbar, /selectedView === "Subscriptions"/);
assert.doesNotMatch(source, /subscriptions-toolbar/,
  "Subscriptions must not render a separate filter and search row");
assert.doesNotMatch(css, /\.subscriptions-toolbar/,
  "the obsolete separate toolbar styling must be removed");

console.log("PASS: Subscription tabs, State filter, and search share the standard category toolbar row.");
