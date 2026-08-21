import ArchiveView from "@/components/ArchiveView";
import FavouritesView from "@/components/FavouritesView";
import LinkedView from "@/components/LinkedView";
import ToolboxToolRow from "@/components/ToolboxToolRow";
import type { KeyboardEvent, ReactNode } from "react";

type ToolRowItem = {
  accounts: string[];
  favorite: boolean;
  id: string;
  name: string;
  status: string;
};

type ToolRowRendererProps = {
  accountLabels: string[];
  archivedOn: string;
  isExpanded: boolean;
  isSelected: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onEditAccount: (accountLabel: string) => void;
  onOpenLinkedAccounts: () => void;
  onOpenLinkState: () => void;
  onRemoveFavourite: () => void;
  onRestore: () => void;
  onToggleExpanded: () => void;
  onToggleFavorite: () => void;
  onToggleSelected: () => void;
  onToggleWatchlist: () => void;
  renderAccount: (accountLabel: string, compact?: boolean) => ReactNode;
  renderCategory: () => ReactNode;
  renderLastStatus: () => ReactNode;
  renderPlan: (accountLabel: string) => ReactNode;
  renderSingleAccount: (accountLabel: string) => ReactNode;
  renderStatusControl: (accountLabel: string) => ReactNode;
  renderToolName: () => ReactNode;
  renderUrl: () => ReactNode;
  renderWatchlistNote: () => ReactNode;
  section: string;
  tool: ToolRowItem;
};

export default function ToolRowRenderer({
  accountLabels,
  archivedOn,
  isExpanded,
  isSelected,
  onDelete,
  onEdit,
  onEditAccount,
  onOpenLinkedAccounts,
  onOpenLinkState,
  onRemoveFavourite,
  onRestore,
  onToggleExpanded,
  onToggleFavorite,
  onToggleSelected,
  onToggleWatchlist,
  renderAccount,
  renderCategory,
  renderLastStatus,
  renderPlan,
  renderSingleAccount,
  renderStatusControl,
  renderToolName,
  renderUrl,
  renderWatchlistNote,
  section,
  tool,
}: ToolRowRendererProps) {
  if (section === "linked" || section === "accounts") {
    return (
      <LinkedView
        accountLabels={accountLabels}
        isExpanded={isExpanded}
        onEditAccount={onEditAccount}
        onToggleExpanded={onToggleExpanded}
        onToggleFavorite={onToggleFavorite}
        renderAccount={renderAccount}
        renderPlan={renderPlan}
        renderStatusControl={renderStatusControl}
        renderToolName={renderToolName}
        splitStatusAction={section === "linked" || section === "accounts"}
        tool={tool}
      />
    );
  }

  if (section === "favorites") {
    return (
      <FavouritesView
        isExpanded={isExpanded}
        onOpenLinkedAccounts={onOpenLinkedAccounts}
        onRemoveFavourite={onRemoveFavourite}
        onToggleExpanded={onToggleExpanded}
        renderAccount={renderAccount}
        renderCategory={renderCategory}
        renderSingleAccount={renderSingleAccount}
        renderToolName={renderToolName}
        renderUrl={renderUrl}
        tool={tool}
      />
    );
  }

  if (section === "archive") {
    return (
      <ArchiveView
        archivedOn={archivedOn}
        isSelected={isSelected}
        onDelete={onDelete}
        onRestore={onRestore}
        onToggleSelected={onToggleSelected}
        renderCategory={renderCategory}
        renderLastStatus={renderLastStatus}
        renderToolName={renderToolName}
        tool={tool}
      />
    );
  }

  return (
    <ToolboxToolRow
      isSelected={isSelected}
      onEdit={onEdit}
      onOpenLinkState={onOpenLinkState}
      onToggleFavorite={onToggleFavorite}
      onToggleSelected={onToggleSelected}
      onToggleWatchlist={onToggleWatchlist}
      renderCategory={renderCategory}
      renderToolName={renderToolName}
      renderUrl={renderUrl}
      renderWatchlistNote={renderWatchlistNote}
      section={section}
      tool={tool}
    />
  );
}

type ToolNameCellProps = {
  aliasText?: string;
  displayName: string;
  draft: string;
  isEditing: boolean;
  logoBackground: string;
  logoText: string;
  name: string;
  onDraftChange: (value: string) => void;
  onOpenAlias?: () => void;
  onSave: () => void;
  onStartEditing: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

export function ToolNameCell({
  aliasText,
  displayName,
  draft,
  isEditing,
  logoBackground,
  logoText,
  name,
  onDraftChange,
  onKeyDown,
  onOpenAlias,
  onSave,
  onStartEditing,
}: ToolNameCellProps) {
  return (
    <div className="tool-name-cell">
      <div className="tool-logo" style={{ background: logoBackground }}>{logoText}</div>
      <div className="tool-name-copy">
        {isEditing ? (
          <input
            aria-label={`Edit ${name} name`}
            autoFocus
            className="tool-name-input"
            onBlur={onSave}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={onKeyDown}
            type="text"
            value={draft}
          />
        ) : (
          <>
            <button
              className="tool-name editable-tool-name"
              onDoubleClick={onStartEditing}
              type="button"
            >
              {displayName}
            </button>
            {aliasText && onOpenAlias ? (
              <button
                aria-label={`View other names for ${displayName}`}
                className="tool-name-alias-button tooltip-target"
                data-tooltip="Also known as"
                onClick={onOpenAlias}
                type="button"
              >
                i
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function BillingToolNameCell({
  accountLabel,
  displayName,
  logoBackground,
  logoText,
  onOpenHistory,
}: {
  accountLabel: string;
  displayName: string;
  logoBackground: string;
  logoText: string;
  onOpenHistory: () => void;
}) {
  return (
    <div className="tool-name-cell billing-readonly-tool-name">
      <div className="tool-logo" style={{ background: logoBackground }}>{logoText}</div>
      <div className="tool-name-copy">
        <span className="tool-name">{displayName}</span>
        <button className="billing-history-link" onClick={onOpenHistory} type="button">
          More
        </button>
      </div>
    </div>
  );
}

export function LinkedAccountCell({
  accountLabel,
  compact = false,
  login,
  tagClass,
}: {
  accountLabel: string;
  compact?: boolean;
  login?: string;
  tagClass: string;
}) {
  return (
    <span
      className={`linked-account-cell ${tagClass}`}
      style={compact ? { boxSizing: "border-box", minWidth: 0, padding: "8px 12px" } : undefined}
    >
      <span className="linked-account-line">
        <span className={`tag-dot ${tagClass}`} />
        <strong>{accountLabel}</strong>
      </span>
      {login ? <span className="linked-account-address">{login}</span> : null}
    </span>
  );
}

export function BillingAccountCell({ accountLabel, tagClass }: { accountLabel: string; tagClass: string }) {
  return (
    <span className={`billing-account-cell ${tagClass}`}>
      <span className={`tag-dot ${tagClass}`} />
      <strong>{accountLabel}</strong>
    </span>
  );
}

function ToolUrlGlobeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M3.75 12h16.5" />
      <path d="M12 3.75c2.05 2.2 3.15 5.05 3.15 8.25S14.05 18.05 12 20.25" />
      <path d="M12 3.75C9.95 5.95 8.85 8.8 8.85 12s1.1 6.05 3.15 8.25" />
    </svg>
  );
}

export function ToolUrlIcon({
  name,
  onMissingUrlClick,
  url,
}: {
  name: string;
  onMissingUrlClick: () => void;
  url?: string;
}) {
  if (!url) {
    return (
      <button
        aria-label={`${name} has no URL added yet`}
        className="tool-url-icon is-disabled"
        onClick={(event) => {
          event.stopPropagation();
          onMissingUrlClick();
        }}
        title="No URL added yet"
        type="button"
      >
        <ToolUrlGlobeIcon />
      </button>
    );
  }

  return (
    <a
      aria-label={`${name} official page`}
      className="tool-url-icon"
      href={url}
      onClick={(event) => event.stopPropagation()}
      rel="noreferrer"
      target="_blank"
    >
      <ToolUrlGlobeIcon />
    </a>
  );
}
