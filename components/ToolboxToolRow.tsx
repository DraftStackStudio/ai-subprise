import type { ReactNode } from "react";

type ToolboxTool = {
  accounts: string[];
  favorite: boolean;
  id: string;
  name: string;
  status: string;
};

type ToolboxToolRowProps = {
  isSelected: boolean;
  onEdit: () => void;
  onOpenLinkState: () => void;
  onToggleFavorite: () => void;
  onToggleSelected: () => void;
  onToggleWatchlist: () => void;
  renderCategory: () => ReactNode;
  renderToolName: () => ReactNode;
  renderUrl: () => ReactNode;
  section: string;
  tool: ToolboxTool;
};

export default function ToolboxToolRow({
  isSelected,
  onEdit,
  onOpenLinkState,
  onToggleFavorite,
  onToggleSelected,
  onToggleWatchlist,
  renderCategory,
  renderToolName,
  renderUrl,
  section,
  tool,
}: ToolboxToolRowProps) {
  const isWatchlisted = tool.status === "Considering";

  return (
    <article className="account-table-row tool-table-row toolbox-tool-row">
      <span className="tool-select-cell" data-label="Select">
        <input
          aria-label={`Select ${tool.name}`}
          checked={isSelected}
          className="tool-row-checkbox"
          onChange={onToggleSelected}
          type="checkbox"
        />
      </span>
      <button
        aria-label={tool.favorite ? `Remove ${tool.name} from favourites` : `Add ${tool.name} to favourites`}
        aria-pressed={tool.favorite}
        className={tool.favorite ? "notion-star-checkbox is-checked" : "notion-star-checkbox"}
        onClick={onToggleFavorite}
        type="button"
      >
        <span className="notion-checkbox-box">
          {tool.favorite ? (
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 4.8 14.1 9l4.6.7-3.3 3.2.8 4.5-4.2-2.2-4.1 2.2.8-4.5L5.3 9.7 9.9 9 12 4.8Z" />
            </svg>
          ) : null}
        </span>
      </button>
      <div data-label="Tool Name">{renderToolName()}</div>
      <div className="category-cell" data-label="Category">{renderCategory()}</div>
      <span data-label="URL">{renderUrl()}</span>
      <span className="watchlist-cell" data-label="Watchlist">
        <button
          aria-label={isWatchlisted ? `Remove ${tool.name} from Watchlist` : `Add ${tool.name} to Watchlist`}
          aria-pressed={isWatchlisted}
          className={
            isWatchlisted
              ? "row-icon-action watchlist-action is-active tooltip-target"
              : "row-icon-action watchlist-action tooltip-target"
          }
          data-tooltip={isWatchlisted ? "Remove from Watchlist" : "Add to Watchlist"}
          onClick={onToggleWatchlist}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 12s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" />
            <circle cx="12" cy="12" r="2.3" />
          </svg>
        </button>
      </span>
      <span
        className={`row-actions tool-link-state-actions${section === "tools" && tool.accounts.length > 0 ? " has-account-count" : ""}`}
        data-label="Action"
      >
        {section === "tools" && tool.accounts.length > 0 ? (
          <button className="linked-account-count-pill toolbox-account-count-badge" onClick={onOpenLinkState} type="button">
            {tool.accounts.length} {tool.accounts.length === 1 ? "account" : "accounts"}
          </button>
        ) : (
          <button
            className="action-btn"
            disabled={isWatchlisted}
            onClick={onOpenLinkState}
            title={isWatchlisted ? "Remove from Watchlist before linking an account" : undefined}
            type="button"
          >
            {tool.accounts.length > 0 ? "Link" : "Not linked"}
          </button>
        )}
        {section !== "watchlist" ? (
          <button className="action-btn" onClick={onEdit} type="button">
            Edit
          </button>
        ) : null}
      </span>
    </article>
  );
}
