import type { ReactNode } from "react";

type DashboardPageHeaderProps = {
  activeSection: string;
  hasConfirmedCategories: boolean;
  isPendingActionsExpanded: boolean;
  onAddAccount: () => void;
  onAddTool: () => void;
  onBackToLogins: () => void;
  onEditCategories: () => void;
  onEditProviders: () => void;
  onOpenPresets: () => void;
  onResetTools: () => void;
  onTogglePendingActions: () => void;
  pendingActionCount: number;
  subtitle: ReactNode;
  title: string;
};

export default function DashboardPageHeader({
  activeSection,
  hasConfirmedCategories,
  isPendingActionsExpanded,
  onAddAccount,
  onAddTool,
  onBackToLogins,
  onEditCategories,
  onEditProviders,
  onOpenPresets,
  onResetTools,
  onTogglePendingActions,
  pendingActionCount,
  subtitle,
  title,
}: DashboardPageHeaderProps) {
  return (
    <header className="main-header">
      <div>
        <h1 className="main-title">{title}</h1>
        <p className="main-subtitle">{activeSection === "linked" ? "Every tool, matched to the account behind it." : subtitle}</p>
      </div>
      <div className="header-actions">
        {activeSection === "billing" && pendingActionCount > 0 ? (
          <button aria-expanded={isPendingActionsExpanded} className="pending-actions-indicator" onClick={onTogglePendingActions} type="button">
            <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
              <path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
            {pendingActionCount} {pendingActionCount === 1 ? "item needs" : "items need"} attention
          </button>
        ) : null}
        {activeSection === "providers" ? (
          <button className="btn-sm btn-sm-ghost button-with-icon" onClick={onBackToLogins} type="button">
            <svg aria-hidden="true" className="button-inline-icon" fill="none" viewBox="0 0 24 24">
              <path d="M19 12H5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
              <path d="m12 19-7-7 7-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
            Back
          </button>
        ) : null}
        {activeSection === "account" ? <button className="btn-sm btn-sm-charcoal" onClick={onEditProviders} type="button">+ Edit Provider</button> : null}
        {activeSection === "tools" && hasConfirmedCategories ? (
          <>
            <button className="btn-sm btn-sm-ghost" onClick={onResetTools} type="button">Reset AI Tools</button>
            <button className="btn-sm btn-sm-charcoal" onClick={onEditCategories} type="button">Edit Category</button>
          </>
        ) : null}
        {activeSection === "tools" ? <button className="btn-sm btn-sm-ghost" onClick={onOpenPresets} type="button">Presets</button> : null}
        {activeSection !== "dashboard" && activeSection !== "billing" && activeSection !== "settings" ? (
          <button className="btn-sm btn-sm-primary" onClick={activeSection === "account" || activeSection === "providers" ? onAddAccount : onAddTool} type="button">
            {activeSection === "account" || activeSection === "providers" ? "+ Add Logins" : activeSection === "linked" ? "+ Link AI Tool" : "+ AI Tool"}
          </button>
        ) : null}
      </div>
    </header>
  );
}
