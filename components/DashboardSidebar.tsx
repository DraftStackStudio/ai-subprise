import type { ReactNode } from "react";
import Link from "next/link";

type Section =
  | "dashboard"
  | "tools"
  | "linked"
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
  isToolsNavOpen: boolean;
  navBadgeCounts: Partial<Record<Section, number>>;
  navItems: NavItem[];
  onCloseMobile: () => void;
  onSelectAccount: () => void;
  onSelectCategory: (category: string) => void;
  onSelectSection: (section: Section) => void;
  onSelectTools: () => void;
  onSelectUtility: (section: Section) => void;
  onToggleCollapsed: () => void;
  renderIcon: (name: string) => ReactNode;
  showRecoveryPanel: boolean;
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
  isToolsNavOpen,
  navBadgeCounts,
  navItems,
  onCloseMobile,
  onSelectAccount,
  onSelectCategory,
  onSelectSection,
  onSelectTools,
  onSelectUtility,
  onToggleCollapsed,
  renderIcon,
  showRecoveryPanel,
  toolboxSidebarCategoryGroups,
  visibleSidebarAccounts,
}: DashboardSidebarProps) {
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
        <div className="nav-label">Workspace</div>
        {navItems.slice(0, 8).map((item) => (
          item.id === "tools" ? (
            <div className="nav-tree" key={item.id}>
              <button
                aria-current={!showRecoveryPanel && activeSection === "tools" && !activeCategory ? "page" : undefined}
                aria-expanded={isToolsNavOpen}
                className={!showRecoveryPanel && activeSection === "tools" && !activeCategory ? "nav-item active nav-parent" : "nav-item nav-parent"}
                onClick={onSelectTools}
                type="button"
              >
                {renderIcon(item.icon)}
                {item.label}
                <span
                  aria-hidden="true"
                  className="nav-tree-tooltip-wrap tooltip-target"
                  data-tooltip={isToolsNavOpen ? "Collapse categories" : "Expand categories"}
                >
                  <span className="nav-tree-handle" />
                </span>
              </button>
              {isToolsNavOpen ? (
                <div className="nav-subitems">
                  {hasConfirmedCategories ? (
                    toolboxSidebarCategoryGroups.flatMap((cluster) =>
                      cluster.categories.map((category) => (
                        <button
                          aria-current={
                            !showRecoveryPanel && activeSection === "tools" && activeCategory === category
                              ? "page"
                              : undefined
                          }
                          className={
                            !showRecoveryPanel && activeSection === "tools" && activeCategory === category
                              ? "nav-subitem active"
                              : "nav-subitem"
                          }
                          key={category}
                          onClick={() => onSelectCategory(category)}
                          type="button"
                        >
                          {category}
                        </button>
                      )),
                    )
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <button
              aria-current={!showRecoveryPanel && activeSection === item.id ? "page" : undefined}
              className={!showRecoveryPanel && activeSection === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              type="button"
            >
              {renderIcon(item.icon)}
              {item.label}
              {(navBadgeCounts[item.id] ?? 0) > 0 ? (
                <span className="badge">{navBadgeCounts[item.id]}</span>
              ) : null}
            </button>
          )
        ))}
      </nav>

      <nav className="sidebar-utility" aria-label="Utilities">
        {navItems.slice(8).map((item) => (
          <button
            aria-current={item.id === "recovery" ? undefined : activeSection === item.id ? "page" : undefined}
            className={
              item.id === "recovery"
                ? showRecoveryPanel
                  ? "nav-item active"
                  : "nav-item"
                : activeSection === item.id
                  ? "nav-item active"
                  : "nav-item"
            }
            key={item.id}
            onClick={() => onSelectUtility(item.id)}
            type="button"
          >
            {renderIcon(item.icon)}
            {item.label}
            {item.id !== "recovery" && (navBadgeCounts[item.id] ?? 0) > 0 ? (
              <span className="badge">{navBadgeCounts[item.id]}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-emails">
        <div className="nav-label">Top Accounts</div>
        {visibleSidebarAccounts.map((account) => (
          <button className="email-account-item" key={account.login} onClick={onSelectAccount} type="button">
            <span className="email-account-info">
              <span className={`email-tag sidebar-email-tag ${account.tag}`}>
                <span className="tag-dot" />
                {account.label}
              </span>
              <span className="email-account-address">{account.login}</span>
            </span>
            <span className="email-tool-count">{account.linked}</span>
          </button>
        ))}
        {hasMoreSidebarAccounts ? (
          <button className="email-account-item email-view-all" onClick={onSelectAccount} type="button">
            View all
          </button>
        ) : null}
      </div>
    </aside>
  );
}
