import { Fragment, type ReactNode } from "react";
import ToolListView from "@/components/ToolListView";

type ToolSection = "tools" | "linked" | "watchlist" | "favorites" | "archive" | "recovery";
type ToolSortRange = "All" | "Category" | "A-G" | "H-N" | "O-S" | "T-Z";

type ToolListItem = {
  id: string;
};

type ToolCategoryGroup<Tool extends ToolListItem> = {
  category: string;
  tools: Tool[];
};

type AIToolboxViewProps<Tool extends ToolListItem> = {
  activeCategory: string;
  areAllVisibleToolsSelected: boolean;
  emptyBody: ReactNode;
  emptyTitle: ReactNode;
  groupedEmptyBody: ReactNode;
  groupedEmptyTitle: ReactNode;
  groupedToolCategories: ToolCategoryGroup<Tool>[];
  isGroupedView: boolean;
  isLoadingTools: boolean;
  renderToolCategoryGroup: (group: ToolCategoryGroup<Tool>) => ReactNode;
  renderToolRow: (tool: Tool) => ReactNode;
  section: ToolSection;
  selectedToolSort: ToolSortRange;
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

export default function AIToolboxView<Tool extends ToolListItem>({
  activeCategory,
  areAllVisibleToolsSelected,
  emptyBody,
  emptyTitle,
  groupedEmptyBody,
  groupedEmptyTitle,
  groupedToolCategories,
  isGroupedView,
  isLoadingTools,
  renderToolCategoryGroup,
  renderToolRow,
  section,
  selectedToolSort,
  toggleVisibleToolSelection,
  visibleTools,
}: AIToolboxViewProps<Tool>) {
  return (
    <div
      className={
        [
          "account-table",
          "tool-database",
          `tool-database-${section}`,
          !["tools", "linked", "watchlist"].includes(section) || activeCategory || selectedToolSort !== "Category"
            ? "tool-database-flat"
            : "",
          section === "tools" && (activeCategory || selectedToolSort !== "Category")
            ? "tool-database-tools-flat-view"
            : "",
        ].filter(Boolean).join(" ")
      }
    >
      {isGroupedView ? (
        <>
          <div className="account-table-head tool-table-head">
            {section === "linked" ? (
              <>
                <span />
                <FavouriteHeaderIcon />
                <span>Tool Name</span>
                <span>Account</span>
                <span>Plan</span>
                <span>Action</span>
              </>
            ) : (
              <>
                <span />
                <FavouriteHeaderIcon />
                <span>Tool Name</span>
                <span>Category</span>
                <span>URL</span>
                <span>Watchlist</span>
                <span>{section === "watchlist" ? "Notes" : "Action"}</span>
              </>
            )}
          </div>
          {groupedToolCategories.length > 0 ? (
            section === "tools" ? (
              groupedToolCategories.map((group) => renderToolCategoryGroup(group))
            ) : (
              groupedToolCategories.map((group) => (
                <Fragment key={group.category}>
                  {renderToolCategoryGroup(group)}
                  {group.tools.length === 0 ? (
                    <div className="empty-state compact-empty category-empty-state">
                      <span className="plain-empty-copy">
                        {section === "watchlist"
                          ? `Nothing on your ${group.category} radar yet`
                          : "No linked tools yet"}
                      </span>
                    </div>
                  ) : null}
                </Fragment>
              ))
            )
          ) : (
            <div className="empty-state tool-onboarding-empty">
              <strong>{groupedEmptyTitle}</strong>
              {groupedEmptyBody}
            </div>
          )}
        </>
      ) : (
        <ToolListView
          activeCategory={activeCategory}
          areAllVisibleToolsSelected={areAllVisibleToolsSelected}
          emptyBody={emptyBody}
          emptyTitle={emptyTitle}
          isLoadingTools={isLoadingTools}
          renderToolRow={renderToolRow}
          section={section}
          toggleVisibleToolSelection={toggleVisibleToolSelection}
          visibleTools={visibleTools}
        />
      )}
    </div>
  );
}
