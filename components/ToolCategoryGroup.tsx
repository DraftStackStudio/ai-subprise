import { Fragment, type ReactNode } from "react";

type GroupTool = {
  id: string;
  name: string;
};

type ToolCategoryGroupProps<Tool extends GroupTool> = {
  category: string;
  isToolboxSection: boolean;
  onToggleSelection?: () => void;
  renderToolRow: (tool: Tool) => ReactNode;
  subgroups?: Array<{ label: string; tools: string[] }>;
  tools: Tool[];
};

export default function ToolCategoryGroup<Tool extends GroupTool>({
  category,
  isToolboxSection,
  onToggleSelection,
  renderToolRow,
  subgroups,
  tools,
}: ToolCategoryGroupProps<Tool>) {
  const subgroupToolNames = new Set(
    subgroups?.flatMap((subgroup) => subgroup.tools.map((toolName) => toolName.toLowerCase())) ?? [],
  );

  return (
    <Fragment>
      <div className="tool-category-row-header">
        <span className="category-row-label">
          <span>{category}</span>
          <span>{tools.length}</span>
        </span>
        {tools.length > 0 && onToggleSelection ? (
          <button onClick={onToggleSelection} type="button">
            Select all
          </button>
        ) : null}
      </div>
      {!isToolboxSection && subgroups ? (
        <>
          {subgroups.map((subgroup) => {
            const subgroupNames = new Set(subgroup.tools.map((toolName) => toolName.toLowerCase()));
            const subgroupTools = tools.filter((tool) => subgroupNames.has(tool.name.trim().toLowerCase()));
            if (subgroupTools.length === 0) return null;
            return (
              <Fragment key={`${category}-${subgroup.label}`}>
                <div className="tool-subgroup-label">{subgroup.label}</div>
                {subgroupTools.map((tool) => renderToolRow(tool))}
              </Fragment>
            );
          })}
          {tools
            .filter((tool) => !subgroupToolNames.has(tool.name.trim().toLowerCase()))
            .map((tool) => renderToolRow(tool))}
        </>
      ) : (
        tools.map((tool) => renderToolRow(tool))
      )}
    </Fragment>
  );
}
