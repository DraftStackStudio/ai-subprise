import { Fragment, type ReactNode } from "react";

type LinkedTool = {
  favorite: boolean;
  id: string;
  name: string;
};

type LinkedViewProps = {
  accountLabels: string[];
  isExpanded: boolean;
  isSelected: boolean;
  onEditAccount: (accountLabel: string) => void;
  onToggleExpanded: () => void;
  onToggleFavorite: () => void;
  onToggleSelected: () => void;
  renderAccount: (accountLabel: string, compact?: boolean) => ReactNode;
  renderPlan: (accountLabel: string) => ReactNode;
  renderStatusControl: (accountLabel: string) => ReactNode;
  renderToolName: () => ReactNode;
  tool: LinkedTool;
};

export default function LinkedView({
  accountLabels,
  isExpanded,
  isSelected,
  onEditAccount,
  onToggleExpanded,
  onToggleFavorite,
  onToggleSelected,
  renderAccount,
  renderPlan,
  renderStatusControl,
  renderToolName,
  tool,
}: LinkedViewProps) {
  const accountLabel = accountLabels[0] ?? "";
  const hasManyAccounts = accountLabels.length > 1;

  return (
    <Fragment>
      <article
        className={
          hasManyAccounts
            ? "account-table-row tool-table-row linked-tool-row"
            : "account-table-row tool-table-row linked-tool-row is-single-account"
        }
        onClick={() => {
          if (hasManyAccounts) onToggleExpanded();
        }}
      >
        <span className="tool-select-cell linked-select-cell" onClick={(event) => event.stopPropagation()}>
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
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
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
        <div className="linked-tool-name-cell" data-label="Tool Name">
          {renderToolName()}
        </div>
        <div className={hasManyAccounts ? "linked-account-summary-cell" : undefined} data-label="Account">
          {hasManyAccounts ? (
            <>
              <span className="linked-account-count-pill">{accountLabels.length} accounts</span>
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
          ) : accountLabel ? (
            renderAccount(accountLabel)
          ) : null}
        </div>
        <span data-label="Plan">{!hasManyAccounts && accountLabel ? renderPlan(accountLabel) : null}</span>
        <span className="linked-tool-action-cell" data-label="Action">
          {!hasManyAccounts && accountLabel ? (
            <span className="linked-row-actions">
              {renderStatusControl(accountLabel)}
              <button
                className="linked-text-action"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditAccount(accountLabel);
                }}
                type="button"
              >
                Edit
              </button>
            </span>
          ) : null}
        </span>
      </article>
      {isExpanded ? (
        <div className="linked-accordion-panel">
          {accountLabels.map((expandedAccountLabel) => (
            <div
              className="tool-account-subrow linked-account-identity-row"
              key={`${tool.id}-${expandedAccountLabel}`}
              style={{
                boxSizing: "border-box",
                gridTemplateColumns: "var(--linked-table-columns)",
                height: 54,
                minHeight: 54,
                padding: 0,
              }}
            >
              <span style={{ padding: "8px 12px" }} />
              <span style={{ padding: "8px 12px" }} />
              <span style={{ padding: "8px 12px" }} />
              {renderAccount(expandedAccountLabel, true)}
              <span className="linked-expanded-plan-cell" data-label="Plan" style={{ padding: "8px 12px" }}>
                {renderPlan(expandedAccountLabel)}
              </span>
              <span className="linked-row-actions" style={{ padding: "8px 12px", transform: "translateX(-40px)" }}>
                {renderStatusControl(expandedAccountLabel)}
                <button
                  className="linked-text-action"
                  onClick={() => onEditAccount(expandedAccountLabel)}
                  type="button"
                >
                  Edit
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Fragment>
  );
}
