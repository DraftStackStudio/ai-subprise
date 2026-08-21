"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardSidebar from "@/components/DashboardSidebar";
import RecentlyDeletedPanel from "@/components/RecentlyDeletedPanel";
import { getAccountRecords } from "@/lib/supabase/accounts";
import {
  getDeletedToolRecords,
  getToolRecords,
  permanentlyDeleteToolRecords,
  restoreToolRecord,
  type ToolRecord,
} from "@/lib/supabase/tools";
import { createClient } from "@/lib/supabase/client";

function SidebarIcon({ name }: { name: string }) {
  return (
    <svg aria-hidden="true" className="sidebar-icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {name === "dashboard" ? <><circle cx="12" cy="12" r="7.5" /><path d="M12 4.5v3M19.5 12h-3M12 19.5v-3M4.5 12h3" /><circle cx="12" cy="12" r="3.5" /></> : null}
      {name === "user" ? <><circle cx="12" cy="8" r="3" /><path d="M5.5 19c.8-3.5 3-5.2 6.5-5.2s5.7 1.7 6.5 5.2" /></> : null}
      {name === "list" ? <><path d="M7 7h11M7 12h11M7 17h8" /><circle cx="4" cy="7" r=".6" fill="currentColor" /><circle cx="4" cy="12" r=".6" fill="currentColor" /><circle cx="4" cy="17" r=".6" fill="currentColor" /></> : null}
      {name === "link" ? <><path d="m9.5 14.5 5-5" /><path d="m10.5 7.5 1.5-1.5a4 4 0 0 1 5.7 5.7l-1.5 1.5M13.5 16.5 12 18a4 4 0 0 1-5.7-5.7l1.5-1.5" /></> : null}
      {name === "billing" ? <><rect height="12" rx="2" width="15" x="4.5" y="6" /><path d="M4.5 10h15M8 14h3" /></> : null}
      {name === "eye" ? <><path d="M4 12s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" /><circle cx="12" cy="12" r="2.2" /></> : null}
      {name === "star" ? <path d="m12 4.5 2.3 4.7 5.2.7-3.8 3.7.9 5.2-4.6-2.4-4.6 2.4.9-5.2-3.8-3.7 5.2-.7L12 4.5Z" /> : null}
      {name === "archive" ? <><rect height="10" rx="1.5" width="11" x="6.5" y="9" /><path d="M5.5 6h13v3h-13zM10 13h4" /></> : null}
      {name === "trash" ? <><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></> : null}
    </svg>
  );
}

export default function PricingSidebar() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [collapsed, setCollapsed] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ id: string; label: string; linked: number; login: string; tag: string }>>([]);
  const [counts, setCounts] = useState({ account: 0, linked: 0, billing: 0, watchlist: 0, favorites: 0, archive: 0, recovery: 0 });
  const [user, setUser] = useState({ name: "Guest", email: "Explore mode" });
  const [deletedTools, setDeletedTools] = useState<ToolRecord[]>([]);
  const [showRecoveryPanel, setShowRecoveryPanel] = useState(false);
  const [recoverySearch, setRecoverySearch] = useState("");
  const [expandedArchiveIds, setExpandedArchiveIds] = useState<string[]>([]);
  const [selectedRecoveryKeys, setSelectedRecoveryKeys] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([getAccountRecords(), getToolRecords(), getDeletedToolRecords(), supabase.auth.getUser()]).then(([accountRows, tools, deleted, auth]) => {
      if (!active) return;
      setAccounts(accountRows.map((account) => ({ id: account.id, label: account.label, linked: account.linked, login: account.email_address, tag: account.colour })));
      setDeletedTools(deleted);
      setExpandedArchiveIds(deleted.map((tool) => `deleted-${tool.id}`));
      setCounts({
        account: accountRows.length,
        linked: tools.filter((tool) => tool.accounts.length > 0).length,
        billing: tools.filter((tool) => tool.billing !== "None").length,
        watchlist: tools.filter((tool) => tool.status === "Considering").length,
        favorites: tools.filter((tool) => tool.favorite).length,
        archive: tools.filter((tool) => tool.archived).length,
        recovery: deleted.length,
      });
      const authUser = auth.data.user;
      if (authUser) setUser({ email: authUser.email ?? "", name: String(authUser.user_metadata.full_name ?? authUser.user_metadata.name ?? "").trim() });
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const categoryGroups = useMemo(() => [{ categories: ["AI Assistant", "Visual & Audio", "Productivity", "Research", "AI Agents", "Automation", "Vibe Coding", "Coding & Dev", "Website & Funnels"] }], []);
  const go = (view?: string) => router.push(view ? `/dashboard?view=${view}` : "/dashboard");

  const recoveryArchives = useMemo(() => {
    const query = recoverySearch.trim().toLocaleLowerCase();
    return deletedTools
      .filter((tool) => !query || [tool.name, tool.category, ...tool.accounts].some((value) => value.toLocaleLowerCase().includes(query)))
      .map((tool) => ({
        createdAt: tool.deletedAt ?? new Date().toISOString(),
        data: [{ category: tool.category, tools: [{ id: tool.id, name: tool.name }] }],
        id: `deleted-${tool.id}`,
      }));
  }, [deletedTools, recoverySearch]);
  const visibleRecoveryKeys = useMemo(
    () => recoveryArchives.flatMap((archive) => archive.data.flatMap((group) => group.tools.map((tool) => `${archive.id}:${tool.id}`))),
    [recoveryArchives],
  );
  const selectedVisibleRecoveryKeys = selectedRecoveryKeys.filter((key) => visibleRecoveryKeys.includes(key));

  const refreshRecoveryTools = async () => {
    const [tools, deleted] = await Promise.all([getToolRecords(), getDeletedToolRecords()]);
    setDeletedTools(deleted);
    setExpandedArchiveIds(deleted.map((tool) => `deleted-${tool.id}`));
    setSelectedRecoveryKeys((keys) => keys.filter((key) => deleted.some((tool) => key.endsWith(`:${tool.id}`))));
    setCounts((current) => ({
      ...current,
      archive: tools.filter((tool) => tool.archived).length,
      billing: tools.filter((tool) => tool.billing !== "None").length,
      favorites: tools.filter((tool) => tool.favorite).length,
      linked: tools.filter((tool) => tool.accounts.length > 0).length,
      recovery: deleted.length,
      watchlist: tools.filter((tool) => tool.status === "Considering").length,
    }));
  };

  const restoreRecoveryTools = async (keys: string[]) => {
    await Promise.all(keys.map((key) => restoreToolRecord(key.split(":").at(-1) ?? "")));
    await refreshRecoveryTools();
  };

  const deleteRecoveryTool = async (_archiveId: string, toolId: string) => {
    await permanentlyDeleteToolRecords([toolId]);
    await refreshRecoveryTools();
  };

  return (
    <>
      <DashboardSidebar
      activeCategory=""
      activeSection="settings"
      hasConfirmedCategories
      hasMoreSidebarAccounts={accounts.length > 2}
      isSidebarCollapsed={collapsed}
      isSidebarOpen={false}
      navBadgeCounts={counts}
      navItems={[
        { id: "dashboard", icon: "dashboard", label: "Dashboard" },
        { id: "account", icon: "user", label: "Logins" },
        { id: "tools", icon: "list", label: "AI Toolbox" },
        { id: "linked", icon: "link", label: "Linked" },
        { id: "billing", icon: "billing", label: "Billing" },
        { id: "watchlist", icon: "eye", label: "Watchlist" },
        { id: "favorites", icon: "star", label: "Favourites" },
        { id: "archive", icon: "archive", label: "Archived" },
        { id: "recovery", icon: "trash", label: "Recently Deleted" },
      ]}
      onCloseMobile={() => undefined}
      onSelectCategory={(category) => router.push(`/dashboard?view=tools&category=${encodeURIComponent(category)}`)}
      onSelectSection={(section) => go(section === "dashboard" ? undefined : section)}
      onSelectTools={() => go("tools")}
      onSelectUtility={(section) => {
        if (section === "recovery") {
          setShowRecoveryPanel((isVisible) => !isVisible);
          return;
        }
        go(section);
      }}
      onSignOut={async () => { await supabase.auth.signOut(); router.push("/login"); }}
      onToggleCollapsed={() => setCollapsed((value) => !value)}
      renderIcon={(name) => <SidebarIcon name={name} />}
      showRecoveryPanel={showRecoveryPanel}
      toolboxSidebarCategoryGroups={categoryGroups}
      userEmail={user.email}
      userName={user.name}
      viewAllAccountsHref="/accounts"
      visibleSidebarAccounts={accounts.slice(0, 2)}
      />
      {showRecoveryPanel ? (
        <RecentlyDeletedPanel
          archives={recoveryArchives}
          expandedArchiveIds={expandedArchiveIds}
          onClose={() => setShowRecoveryPanel(false)}
          onDeleteTool={(archiveId, toolId) => void deleteRecoveryTool(archiveId, toolId)}
          onRestoreSelected={(keys) => void restoreRecoveryTools(keys)}
          onRestoreTool={(archiveId, toolId) => void restoreRecoveryTools([`${archiveId}:${toolId}`])}
          onSearchChange={setRecoverySearch}
          onToggleArchive={(archiveId) => setExpandedArchiveIds((ids) => ids.includes(archiveId) ? ids.filter((id) => id !== archiveId) : [...ids, archiveId])}
          onToggleTool={(archiveId, toolId) => {
            const key = `${archiveId}:${toolId}`;
            setSelectedRecoveryKeys((keys) => keys.includes(key) ? keys.filter((currentKey) => currentKey !== key) : [...keys, key]);
          }}
          searchValue={recoverySearch}
          selectedKeys={selectedRecoveryKeys}
          selectedVisibleKeys={selectedVisibleRecoveryKeys}
        />
      ) : null}
    </>
  );
}
