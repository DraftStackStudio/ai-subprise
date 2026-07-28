import { Fragment, type ReactNode } from "react";

type FavouriteTool = {
  accounts: string[];
  id: string;
  name: string;
};

type FavouritesViewProps = {
  isExpanded: boolean;
  onOpenLinkedAccounts: () => void;
  onRemoveFavourite: () => void;
  onToggleExpanded: () => void;
  renderAccount: (accountLabel: string, compact?: boolean) => ReactNode;
  renderCategory: () => ReactNode;
  renderSingleAccount: (accountLabel: string) => ReactNode;
  renderToolName: () => ReactNode;
  renderUrl: () => ReactNode;
  tool: FavouriteTool;
};

export default function FavouritesView({
  isExpanded,
  onOpenLinkedAccounts,
  onRemoveFavourite,
  onToggleExpanded,
  renderAccount,
  renderCategory,
  renderSingleAccount,
  renderToolName,
  renderUrl,
  tool,
}: FavouritesViewProps) {
  const primaryAccount = tool.accounts[0] ?? "";
  const hasManyAccounts = tool.accounts.length > 1;

  return (
    <Fragment>
      <article
        className="account-table-row tool-table-row favourite-tool-row"
        onClick={() => {
          if (hasManyAccounts) onToggleExpanded();
        }}
      >
        <span />
        <button
          aria-label={`Remove ${tool.name} from favourites`}
          aria-pressed="true"
          className="notion-star-checkbox is-checked"
          onClick={(event) => {
            event.stopPropagation();
            onRemoveFavourite();
          }}
          type="button"
        >
          <span className="notion-checkbox-box">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 4.8 14.1 9l4.6.7-3.3 3.2.8 4.5-4.2-2.2-4.1 2.2.8-4.5L5.3 9.7 9.9 9 12 4.8Z" />
            </svg>
          </span>
        </button>
        <div data-label="Tool Name">{renderToolName()}</div>
        <div className="category-cell" data-label="Category">{renderCategory()}</div>
        <div
          className={hasManyAccounts ? "account-used-cell linked-account-summary-cell" : "account-used-cell"}
          data-label="Account Used"
        >
          {primaryAccount ? (
            hasManyAccounts ? (
              <>
                <span className="linked-account-count-pill">{tool.accounts.length} accounts</span>
                <button
                  aria-label={isExpanded ? `Collapse ${tool.name}` : `Expand ${tool.name}`}
                  aria-expanded={isExpanded}
                  className={
                    isExpanded
                      ? "row-toggle-control linked-row-toggle tooltip-target is-open"
                      : "row-toggle-control linked-row-toggle tooltip-target"
                  }
                  data-tooltip={isExpanded ? "Collapse accounts" : "Expand accounts"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleExpanded();
                  }}
                  type="button"
                >
                  <span />
                </button>
              </>
            ) : (
              renderSingleAccount(primaryAccount)
            )
          ) : (
            <span className="muted-cell">No account linked</span>
          )}
        </div>
        <span data-label="URL">{renderUrl()}</span>
        <span className="row-actions" data-label="Action">
          <button
            className="action-btn"
            onClick={(event) => {
              event.stopPropagation();
              onOpenLinkedAccounts();
            }}
            type="button"
          >
            {tool.accounts.length > 0 ? "Linked" : "Not linked"}
          </button>
        </span>
      </article>
      {isExpanded && hasManyAccounts ? (
        <div className="linked-accordion-panel favourite-accordion-panel" style={{ borderLeft: 0, borderRight: 0 }}>
          {tool.accounts.map((accountLabel) => (
            <div
              className="tool-account-subrow favourite-account-row"
              key={`${tool.id}-${accountLabel}`}
              style={{
                boxSizing: "border-box",
                gridTemplateColumns: "var(--favorites-table-columns)",
                height: 54,
                minHeight: 54,
                padding: 0,
              }}
            >
              <span style={{ padding: "8px 12px" }} />
              <span style={{ padding: "8px 12px" }} />
              <span style={{ padding: "8px 12px" }} />
              <span style={{ padding: "8px 12px" }} />
              {renderAccount(accountLabel, true)}
              <span style={{ padding: "8px 12px" }} />
              <span style={{ padding: "8px 12px" }} />
            </div>
          ))}
        </div>
      ) : null}
    </Fragment>
  );
}
