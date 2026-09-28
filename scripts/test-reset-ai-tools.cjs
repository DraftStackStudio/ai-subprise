// Focused source-contract checks; no database, browser, or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const migration = read('supabase/migrations/0024_reset_ai_tools_clean_slate.sql');
assert.match(migration, /security definer/i);
assert.match(migration, /set search_path = pg_catalog, public/i);
assert.match(migration, /current_user_id uuid := auth\.uid\(\)/);
assert.match(migration, /if current_user_id is null then\s+raise exception 'Not authenticated'/i);
assert.doesNotMatch(migration, /reset_ai_tools_clean_slate\s*\([^)]*user_id/i);
assert.match(migration, /delete from public\.billing_transactions\s+where user_id = current_user_id/i);
assert.match(migration, /delete from public\.ai_tools\s+where user_id = current_user_id/i);
assert.ok(
  migration.indexOf('delete from public.billing_transactions') < migration.indexOf('delete from public.ai_tools'),
  'transactions must be deleted before tools',
);
assert.match(migration, /revoke all on function public\.reset_ai_tools_clean_slate\(\) from public/i);
assert.match(migration, /revoke all on function public\.reset_ai_tools_clean_slate\(\) from anon/i);
assert.match(migration, /grant execute on function public\.reset_ai_tools_clean_slate\(\) to authenticated/i);
assert.doesNotMatch(migration, /delete from public\.logins/i);

const tools = read('lib/supabase/tools.ts');
assert.match(tools, /supabase\.rpc\("reset_ai_tools_clean_slate"\)/);

const page = read('app/dashboard/page.tsx');
const resetHandler = page.slice(page.indexOf('  const confirmPendingReset = async'), page.indexOf('  const openRestoreArchiveModal'));
assert.match(resetHandler, /await resetAIToolsCleanSlate\(\)/);
assert.match(resetHandler, /const resetMode: "blank" = "blank"/);
assert.ok(
  resetHandler.indexOf('await resetAIToolsCleanSlate()') < resetHandler.indexOf('applyAuthenticatedResetState'),
  'authenticated state must not clear before the RPC succeeds',
);
assert.match(resetHandler, /getToolLinkDetailRecords\(\{ includeUnlinked: true \}\)/);
assert.match(resetHandler, /getBillingTransactions\(\)/);

const modal = read('components/ResetAIToolsModals.tsx');
assert.match(modal, /Start fresh while keeping your saved Logins\./);
assert.match(modal, /Watchlist, Favourites, Archived and Recently Deleted tool records/);
assert.doesNotMatch(modal, />Continue<\/button>/);
assert.match(modal, /Type <strong>reset<\/strong> to confirm/);
assert.doesNotMatch(modal, /Start from scratch/);
assert.doesNotMatch(modal, /Choose a new template/);
assert.match(modal, /confirmation\.trim\(\)\.toUpperCase\(\) === "RESET"/);
assert.match(modal, /disabled=\{!isConfirmed \|\| isResetting\}/);

const header = read('components/DashboardPageHeader.tsx');
assert.doesNotMatch(header, /Reset AI Tools/);
assert.doesNotMatch(header, /onResetTools/);

const settings = read('components/SettingsView.tsx');
assert.match(settings, /<h2>Workspace Data<\/h2>/);
assert.match(settings, /<h3>Reset AI Subprise<\/h3>/);
assert.match(settings, /onClick=\{onResetWorkspace\}/);
assert.doesNotMatch(settings, />Data management<\/span>/i);

console.log('Reset AI Tools focused checks passed.');
