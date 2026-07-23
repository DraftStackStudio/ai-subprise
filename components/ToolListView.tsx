import type { ReactNode } from "react";

type ToolListSection = "tools" | "linked" | "watchlist" | "favorites" | "archive" | "recovery";

type ToolListItem = {
  id: string;
};

type ToolListViewProps<Tool extends ToolListItem> = {
  activeCategory: string;
  areAllVisibleToolsSelected: boolean;
  emptyBody: ReactNode;
  emptyTitle: ReactNode;
  isLoadingTools: boolean;
  renderToolRow: (tool: Tool) => ReactNode;
  section: ToolListSection;
  toggleVisibleToolSelection: () => void;
  visibleTools: Tool[];
};

function FavouriteHeaderIcon() {
  return (
    <span aria-label="Favourite" className="tool-head-icon">
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 4.8 14.1 9l4.6.7-3.3 3.2.8 4.5-4.2-2.2-4.1 2.2.8-4.5L5.3 9.7 9.9 9 12 4.8Z" />
      </svg>
    </span>
  );
}

export default function ToolListView<Tool extends ToolListItem>({
  activeCategory,
  areAllVisibleToolsSelected,
  emptyBody,
  emptyTitle,
  isLoadingTools,
  renderToolRow,
  section,
  toggleVisibleToolSelection,
  visibleTools,
}: ToolListViewProps<Tool>) {
  const selectAll = (
    <span>
      <input
        aria-label="Select all visible tools"
        checked={areAllVisibleToolsSelected}
        className="tool-row-checkbox"
        onChange={toggleVisibleToolSelection}
        type="checkbox"
      />
    </span>
  );

  return (
    <>
      <div className="account-table-head tool-table-head">
        {section === "linked" ? (
          <>
            {selectAll}
            <FavouriteHeaderIcon />
            <span>Tool Name</span>
            <span>Account</span>
            <span>Plan</span>
            <span>Action</span>
          </>
        ) : section === "favorites" ? (
          <>
            <span />
            <FavouriteHeaderIcon />
            <span>Tool Name</span>
            <span>Category</span>
            <span>Account Used</span>
            <span>URL</span>
            <span>Action</span>
          </>
        ) : section === "archive" ? (
          <>
            {selectAll}
            <span>Tool Name</span>
            <span>Category</span>
            <span>Last Status</span>
            <span>Archived On</span>
            <span>Action</span>
          </>
        ) : (
          <>
            {selectAll}
            <FavouriteHeaderIcon />
            <span>Tool Name</span>
            <span>Category</span>
            <span>URL</span>
            <span>Watchlist</span>
            <span>Action</span>
          </>
        )}
      </div>
      {isLoadingTools ? (
        <div className="empty-state tool-onboarding-empty">
          <strong>Loading AI tools</strong>
          <span>Getting your toolbox ready.</span>
        </div>
      ) : visibleTools.length > 0 ? (
        visibleTools.map((tool) => renderToolRow(tool))
      ) : (
        <div className="empty-state tool-onboarding-empty">
          {section === "watchlist" && activeCategory ? (
            <span className="plain-empty-copy">{`Nothing on your ${activeCategory} radar yet`}</span>
          ) : (
            <strong>{emptyTitle}</strong>
          )}
          {emptyBody}
        </div>
      )}
    </>
  );
}
