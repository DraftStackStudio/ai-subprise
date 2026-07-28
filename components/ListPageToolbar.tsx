import type { ReactNode } from "react";

type ToolSortRange = "All" | "Category" | "A-G" | "H-N" | "O-S" | "T-Z";

type ListPageToolbarProps = {
  activeCategory: boolean;
  activeSection: "tools" | "linked" | "watchlist" | "billing" | "favorites" | "archive";
  billingView: "All" | "Month";
  linkedPlanFilter: ReactNode;
  onBillingViewChange: (value: "All" | "Month") => void;
  onSearchQueryChange: (value: string) => void;
  onToolSortChange: (value: ToolSortRange) => void;
  searchQuery: string;
  selectedToolSort: ToolSortRange;
  toolSortOptions: Array<{ label: string; value: ToolSortRange }>;
};

export default function ListPageToolbar({
  activeCategory,
  activeSection,
  billingView,
  linkedPlanFilter,
  onBillingViewChange,
  onSearchQueryChange,
  onToolSortChange,
  searchQuery,
  selectedToolSort,
  toolSortOptions,
}: ListPageToolbarProps) {
  return (
    <div className="table-controls">
      <div
        className={activeSection === "tools" && activeCategory ? "category-view-tabs subcategory-view-tabs" : "category-view-tabs"}
        aria-label={
          activeSection === "billing"
            ? "Billing views"
            : activeSection === "favorites" || activeSection === "archive"
              ? "Search tools"
              : "Category views"
        }
      >
        <span
          className="category-view-helper"
          aria-hidden={
            (activeSection === "tools" && activeCategory) ||
            activeSection === "favorites" ||
            activeSection === "archive"
          }
        >
          {(activeSection === "tools" && activeCategory) ||
          activeSection === "favorites" ||
          activeSection === "archive"
            ? "\u00a0"
            : activeSection === "billing"
              ? "Browse by billing."
              : "Browse by type."}
        </span>
        <div className="category-view-action-row">
          {activeSection === "billing" ? (
            <div className="category-view-tab-list">
              {[
                { label: "All", value: "All" as const },
                { label: "By Month", value: "Month" as const },
              ].map((option) => (
                <button
                  className={billingView === option.value ? "category-view-tab active" : "category-view-tab"}
                  key={option.value}
                  onClick={() => onBillingViewChange(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : activeSection === "tools" && activeCategory ? (
            <span className="category-view-tab-spacer" aria-hidden="true" />
          ) : activeSection === "favorites" || activeSection === "archive" ? (
            <span className="category-view-tab-spacer" aria-hidden="true" />
          ) : (
            <div className="category-view-tab-list">
              {toolSortOptions.map((option) => (
                <button
                  className={selectedToolSort === option.value ? "category-view-tab active" : "category-view-tab"}
                  key={option.value}
                  onClick={() => onToolSortChange(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <div className="table-search-filter-group">
            {activeSection === "linked" ? linkedPlanFilter : null}
            <label className="search-box">
              <span className="search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="6" />
                  <path d="m16 16 4 4" />
                </svg>
              </span>
              <input
                onChange={(event) => onSearchQueryChange(event.target.value)}
                placeholder="search tool"
                type="search"
                value={searchQuery}
              />
              {searchQuery ? (
                <button
                  aria-label="Clear search"
                  className="search-clear-button"
                  onClick={() => onSearchQueryChange("")}
                  type="button"
                >
                  ×
                </button>
              ) : null}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
