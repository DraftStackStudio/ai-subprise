"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

type Section =
  | "dashboard"
  | "tools"
  | "linked"
  | "accounts"
  | "billing"
  | "watchlist"
  | "account"
  | "providers"
  | "favorites"
  | "archive"
  | "recovery"
  | "settings";

type NavItem = {
  icon: string;
  id: Section;
  label: string;
};

type SidebarAccount = {
  id?: string;
  label: string;
  linked: number;
  login: string;
  tag: string;
};

type DashboardSidebarProps = {
  activeCategory: string;
  activeSection: Section;
  hasConfirmedCategories: boolean;
  hasMoreSidebarAccounts: boolean;
  isSidebarCollapsed: boolean;
  isSidebarOpen: boolean;
  navBadgeCounts: Partial<Record<Section, number>>;
  navItems: NavItem[];
  onCloseMobile: () => void;
  viewAllAccountsHref: string;
  onSelectCategory: (category: string) => void;
  onSelectSection: (section: Section) => void;
  onSelectTools: () => void;
  onSelectUtility: (section: Section) => void;
  onSignOut: () => void;
  onToggleCollapsed: () => void;
  renderIcon: (name: string) => ReactNode;
  showRecoveryPanel: boolean;
  userEmail: string;
  userName: string;
  toolboxSidebarCategoryGroups: Array<{ categories: string[] }>;
  visibleSidebarAccounts: SidebarAccount[];
};

export default function DashboardSidebar({
  activeCategory,
  activeSection,
  hasConfirmedCategories,
  hasMoreSidebarAccounts,
  isSidebarCollapsed,
  isSidebarOpen,
  navBadgeCounts,
  navItems,
  onCloseMobile,
  viewAllAccountsHref,
  onSelectCategory,
  onSelectSection,
  onSelectTools,
  onSelectUtility,
  onSignOut,
  onToggleCollapsed,
  renderIcon,
  showRecoveryPanel,
  toolboxSidebarCategoryGroups,
  visibleSidebarAccounts,
  userEmail,
  userName,
}: DashboardSidebarProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isToolsPortalOpen, setIsToolsPortalOpen] = useState(false);
  const [toolsPortalPosition, setToolsPortalPosition] = useState({ left: 0, top: 0 });
  const userMenuRef = useRef<HTMLDivElement>(null);
  const toolsPortalRef = useRef<HTMLDivElement>(null);
  const toolsTriggerRef = useRef<HTMLButtonElement>(null);
  const toolsRowRef = useRef<HTMLDivElement>(null);
  const displayedUserName = userName.trim() || "Guest";
  const displayedUserEmail = userEmail.trim() || "Explore mode";
  const avatarLetter = displayedUserName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) setIsUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!isToolsPortalOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!toolsPortalRef.current?.contains(target) && !toolsTriggerRef.current?.contains(target)) {
        setIsToolsPortalOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isToolsPortalOpen]);

  const toggleToolsPortal = () => {
    if (!isToolsPortalOpen && toolsRowRef.current) {
      const triggerBounds = toolsRowRef.current.getBoundingClientRect();
      setToolsPortalPosition({ left: triggerBounds.right + 8, top: triggerBounds.top });
    }
    setIsToolsPortalOpen((isOpen) => !isOpen);
  };

  const selectAllTools = () => {
    setIsToolsPortalOpen(false);
    if (activeSection === "tools" && !activeCategory) return;
    onSelectTools();
  };

  const selectToolCategory = (category: string) => {
    setIsToolsPortalOpen(false);
    if (activeSection === "tools" && activeCategory === category) return;
    onSelectCategory(category);
  };

  const renderNavItem = (item: NavItem) => item.id === "tools" ? (
    <div className="nav-tree" key={item.id}>
      <div
        aria-current={!showRecoveryPanel && activeSection === "tools" && !activeCategory ? "page" : undefined}
        className={!showRecoveryPanel && activeSection === "tools" ? "nav-item active nav-parent toolbox-nav-row" : "nav-item nav-parent toolbox-nav-row"}
        ref={toolsRowRef}
      >
        <button
          className="toolbox-nav-destination"
          onClick={() => {
            setIsToolsPortalOpen(false);
            onSelectTools();
          }}
          type="button"
        >
          {renderIcon(item.icon)}
          <span>{item.label}</span>
        </button>
        <button
          aria-expanded={isToolsPortalOpen}
          aria-label={isToolsPortalOpen ? "Close AI Toolbox categories" : "Open AI Toolbox categories"}
          className="nav-tree-tooltip-wrap toolbox-nav-toggle tooltip-target"
          data-tooltip={isToolsPortalOpen ? "Close categories" : "Open categories"}
          onClick={toggleToolsPortal}
          ref={toolsTriggerRef}
          type="button"
        >
          <span className="nav-tree-handle" />
        </button>
      </div>
    </div>
  ) : (
    <button
      aria-current={item.id === "recovery" ? undefined : !showRecoveryPanel && activeSection === item.id ? "page" : undefined}
      className={item.id === "recovery" ? showRecoveryPanel ? "nav-item active" : "nav-item" : !showRecoveryPanel && activeSection === item.id ? "nav-item active" : "nav-item"}
      key={item.id}
      onClick={() => item.id === "recovery" ? onSelectUtility(item.id) : onSelectSection(item.id)}
      type="button"
    >
      {renderIcon(item.icon)}
      {item.label}
      {(navBadgeCounts[item.id] ?? 0) > 0 ? <span className="badge">{navBadgeCounts[item.id]}</span> : null}
    </button>
  );

  const dashboardItem = navItems.find((item) => item.id === "dashboard");
  const manageItems = navItems.filter((item) => ["account", "tools", "linked", "billing"].includes(item.id));
  const listItems = navItems.filter((item) => ["watchlist", "favorites", "archive", "recovery"].includes(item.id));

  return (
    <aside
      className={[
        "sidebar",
        isSidebarOpen ? "is-open" : "",
        isSidebarCollapsed ? "is-collapsed" : "",
      ].filter(Boolean).join(" ")}
      aria-label="Dashboard navigation"
      style={isSidebarOpen ? { transform: "translateX(0)" } : undefined}
    >
      <div className="sidebar-header">
        <Link className="sidebar-logo" href="/">
          <div className="sidebar-logo-icon">AI</div>
          <div className="sidebar-logo-name">
            AI Sub<span>prise</span>
          </div>
        </Link>
        <button
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={isSidebarCollapsed}
          className="sidebar-collapse-handle tooltip-target"
          data-tooltip={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapsed}
          type="button"
        >
          <span />
        </button>
        <button
          aria-label="Close dashboard navigation"
          className="mobile-drawer-close"
          onClick={onCloseMobile}
          type="button"
        >
          <span />
          <span />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="Workspace">
        {dashboardItem ? renderNavItem(dashboardItem) : null}
        <div className="nav-label sidebar-section-label">Manage</div>
        {manageItems.map(renderNavItem)}
        <div className="nav-label sidebar-section-label">Lists</div>
        {listItems.map(renderNavItem)}
        <div className="sidebar-emails">
          <div className="nav-label sidebar-section-label">Top Accounts</div>
          {visibleSidebarAccounts.map((account) => (
            <div className="email-account-item sidebar-account-display" key={account.id ?? account.label}>
              <span className="email-account-info"><span className={`email-tag sidebar-email-tag ${account.tag}`}><span className="tag-dot" />{account.label}</span><span className="email-account-address">{account.login}</span></span>
              <span className="email-tool-count">{account.linked}</span>
            </div>
          ))}
          {hasMoreSidebarAccounts ? <a className="email-account-item email-view-all" href={viewAllAccountsHref}>View by accounts</a> : null}
        </div>
      </nav>

      <div className="sidebar-user" ref={userMenuRef}>
        {isUserMenuOpen ? (
          <div className="sidebar-user-menu" role="menu">
            <button onClick={() => { setIsUserMenuOpen(false); onSelectUtility("settings"); }} role="menuitem" type="button">
              <svg aria-hidden="true" className="sidebar-icon sidebar-settings-menu-icon" viewBox="0 0 24 24">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Settings
            </button>
            <button onClick={() => { setIsUserMenuOpen(false); onSignOut(); }} role="menuitem" type="button">
              <svg aria-hidden="true" className="sidebar-icon" viewBox="0 0 24 24">
                <path d="M10 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H10" />
                <path d="M13 8.5 16.5 12 13 15.5" />
                <path d="M8.5 12h8" />
              </svg>
              Sign out
            </button>
          </div>
        ) : null}
        <button aria-expanded={isUserMenuOpen} className="sidebar-user-trigger" onClick={() => setIsUserMenuOpen((isOpen) => !isOpen)} type="button">
          <span className="sidebar-user-avatar">{avatarLetter}</span>
          <span className="sidebar-user-copy"><strong>{displayedUserName}</strong><small>{displayedUserEmail}</small></span>
          <svg aria-hidden="true" className="sidebar-user-chevron" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>
      {isToolsPortalOpen && typeof document !== "undefined" ? createPortal(
        <div
          className="toolbox-nav-portal"
          data-dark-variant="cool"
          data-theme="dark"
          ref={toolsPortalRef}
          role="menu"
          style={{ left: toolsPortalPosition.left, top: toolsPortalPosition.top }}
        >
          <button className={activeSection === "tools" && !activeCategory ? "toolbox-nav-portal-item active" : "toolbox-nav-portal-item"} onClick={selectAllTools} role="menuitem" type="button">All tools</button>
          <div className="toolbox-nav-portal-divider" />
          <div className="toolbox-nav-portal-list">
            {hasConfirmedCategories ? toolboxSidebarCategoryGroups.flatMap((cluster) => cluster.categories.map((category) => (
              <button className={activeSection === "tools" && activeCategory === category ? "toolbox-nav-portal-item active" : "toolbox-nav-portal-item"} key={category} onClick={() => selectToolCategory(category)} role="menuitem" type="button">{category}</button>
            ))) : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </aside>
  );
}
