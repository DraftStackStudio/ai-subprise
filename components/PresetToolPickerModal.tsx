"use client";

import toolboxPresetsData from "@/config/toolboxPresets";

type ToolboxPresetCategory = {
  description: string;
  id: string;
  label: string;
  pendingTools?: string[];
  subgroups?: Array<{ label: string; tools: string[] }>;
  tools?: string[];
};

type ToolboxPresetConfig = {
  categories: ToolboxPresetCategory[];
  clusters: Array<{ categories: string[]; id: string; label: string }>;
};

type PresetTool = {
  category: string;
  name: string;
};

type PresetToolPickerModalProps = {
  expandedCategoryIds: string[];
  isSaving: boolean;
  normalizeCategory: (category: string) => string;
  onClose: () => void;
  onDone: () => void;
  onExpandCategory: (categoryId: string) => void;
  onToggleShowAllCategories: () => void;
  onToggleTool: (toolName: string) => void;
  selectedCategoryLabels: string[];
  selectedRole: string;
  selectedRoleCategoryLabels: string[];
  selectedToolNames: string[];
  showAllCategories: boolean;
  tools: PresetTool[];
};

const toolboxPresets = toolboxPresetsData as ToolboxPresetConfig;
const presetCategoryById = new Map(toolboxPresets.categories.map((category) => [category.id, category]));

export default function PresetToolPickerModal({
  expandedCategoryIds,
  isSaving,
  normalizeCategory,
  onClose,
  onDone,
  onExpandCategory,
  onToggleShowAllCategories,
  onToggleTool,
  selectedCategoryLabels,
  selectedRole,
  selectedRoleCategoryLabels,
  selectedToolNames,
  showAllCategories,
  tools,
}: PresetToolPickerModalProps) {
  return (
    <div className="welcome-modal-overlay" role="presentation">
      <section
        aria-labelledby="preset-tool-picker-title"
        aria-modal="true"
        className="welcome-modal preset-tool-picker-modal"
        role="dialog"
      >
        <button
          aria-label="Close tool suggestions"
          className="modal-close-button"
          onClick={onClose}
          type="button"
        >
          x
        </button>
        <h2 id="preset-tool-picker-title">Add AI tools</h2>
        <p>Choose as many as you use. Added tools stay visible so you can keep browsing.</p>
        <div className="preset-tool-picker-filter">
          <span className="preset-role-tag">{selectedRole}</span>
          <div className="preset-tool-picker-filter-actions">
            <button
              aria-pressed={showAllCategories}
              className={showAllCategories ? "btn-sm btn-sm-charcoal" : "btn-sm btn-sm-ghost"}
              onClick={onToggleShowAllCategories}
              type="button"
            >
              {showAllCategories ? "Show selected categories" : "Show all categories"}
            </button>
          </div>
        </div>
        <div className="preset-tool-picker-content">
          {toolboxPresets.clusters.map((cluster) => {
            const categories = cluster.categories
              .map((categoryId) => presetCategoryById.get(categoryId))
              .filter((category): category is ToolboxPresetCategory => Boolean(category))
              .filter(
                (category) =>
                  Boolean(category.tools?.length) ||
                  Boolean(category.subgroups?.some((subgroup) => subgroup.tools.length > 0)) ||
                  tools.some((tool) => normalizeCategory(tool.category) === category.label),
              )
              .filter(
                (category) =>
                  showAllCategories ||
                  (selectedCategoryLabels.length > 0
                    ? selectedCategoryLabels.includes(category.label)
                    : selectedRoleCategoryLabels.includes(category.label)),
              );
            if (categories.length === 0) return null;

            return (
              <section className="preset-tool-cluster" key={cluster.id}>
                <h3>{cluster.label}</h3>
                {categories.map((category) => {
                  const renderPresetPill = (presetName: string) => {
                    const isAdded = selectedToolNames.includes(presetName.trim().toLowerCase());
                    return (
                      <button
                        aria-label={`${isAdded ? "Added" : "Add"} ${presetName}`}
                        className={isAdded ? "preset-tool-pill is-added" : "preset-tool-pill"}
                        disabled={isSaving}
                        key={`${category.id}-${presetName}`}
                        onClick={() => onToggleTool(presetName)}
                        type="button"
                      >
                        {isAdded ? (
                          <svg
                            aria-hidden="true"
                            className="preset-tool-pill-icon"
                            fill="none"
                            height="16"
                            viewBox="0 0 24 24"
                            width="16"
                          >
                            <path
                              d="m5 12 4 4L19 6"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                            />
                          </svg>
                        ) : (
                          <svg
                            aria-hidden="true"
                            className="preset-tool-pill-icon"
                            fill="none"
                            height="16"
                            viewBox="0 0 24 24"
                            width="16"
                          >
                            <path
                              d="M12 5v14M5 12h14"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                            />
                          </svg>
                        )}
                        {presetName}
                      </button>
                    );
                  };
                  const categoryTools =
                    category.tools && category.tools.length > 0
                      ? category.tools
                      : tools
                          .filter((tool) => normalizeCategory(tool.category) === category.label)
                          .map((tool) => tool.name)
                          .sort((firstName, secondName) => firstName.localeCompare(secondName));
                  const isExpanded = expandedCategoryIds.includes(category.id);
                  const visibleCategoryTools = isExpanded ? categoryTools : categoryTools.slice(0, 8);

                  return (
                    <div className="preset-tool-category" key={category.id}>
                      <h4>{category.label}</h4>
                      {category.subgroups ? (
                        category.subgroups.map((subgroup) => (
                          <div className="preset-tool-subgroup" key={`${category.id}-${subgroup.label}`}>
                            <span>{subgroup.label}</span>
                            <div className="preset-tool-pills">{subgroup.tools.map(renderPresetPill)}</div>
                          </div>
                        ))
                      ) : (
                        <div className="preset-tool-pills">
                          {visibleCategoryTools.map(renderPresetPill)}
                          {categoryTools.length === 0 ? (
                            <span className="preset-tool-empty">No preset tools yet</span>
                          ) : null}
                          {!isExpanded && categoryTools.length > 8 ? (
                            <button
                              className="preset-tool-pill preset-tool-more"
                              onClick={() => onExpandCategory(category.id)}
                              type="button"
                            >
                              +{categoryTools.length - 8} more
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
        <div className="welcome-modal-actions preset-tool-picker-actions">
          <button className="btn-sm btn-sm-primary" disabled={isSaving} onClick={onDone} type="button">
            Done
          </button>
        </div>
      </section>
    </div>
  );
}
