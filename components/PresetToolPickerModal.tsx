"use client";

import toolboxPresetsData from "@/config/toolboxPresets";
import { getToolAliasText, toolAliasTextByName } from "@/config/toolAliases";
import { useState } from "react";

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
  isObscured: boolean;
  isSaving: boolean;
  normalizeCategory: (category: string) => string;
  onClose: () => void;
  onDone: () => void;
  onExpandCategory: (categoryId: string) => void;
  onToggleShowAllCategories: () => void;
  onToggleTool: (toolName: string) => void;
  ownedToolNames: string[];
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
  isObscured,
  isSaving,
  normalizeCategory,
  onClose,
  onDone,
  onExpandCategory,
  onToggleShowAllCategories,
  onToggleTool,
  ownedToolNames,
  selectedCategoryLabels,
  selectedRole,
  selectedRoleCategoryLabels,
  selectedToolNames,
  showAllCategories,
  tools,
}: PresetToolPickerModalProps) {
  const [aliasModalToolName, setAliasModalToolName] = useState<string | null>(null);

  return (
    <>
      <div className="welcome-modal-overlay" role="presentation">
        <section
          aria-labelledby="preset-tool-picker-title"
          aria-hidden={isObscured}
          aria-modal="true"
          className={`welcome-modal preset-tool-picker-modal${isObscured ? " is-obscured" : ""}`}
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
                    const normalizedName = presetName.trim().toLowerCase();
                    const isAdded = selectedToolNames.includes(normalizedName);
                    const isOwned = ownedToolNames.includes(normalizedName);
                    const aliasText = getToolAliasText(presetName);
                    const pillIcon = isAdded ? (
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
                    );

                    if (aliasText) {
                      return (
                        <span
                          className={`preset-tool-pill preset-tool-pill-with-info${isAdded ? " is-added" : ""}`}
                          key={`${category.id}-${presetName}`}
                        >
                          <button
                            aria-label={`${isAdded ? "Deselect" : "Select"} ${presetName}${isOwned ? " (already in your toolbox)" : ""}`}
                            className="preset-tool-pill-main"
                            disabled={isSaving}
                            onClick={() => onToggleTool(presetName)}
                            type="button"
                          >
                            {pillIcon}
                            {presetName}
                          </button>
                          <button
                            aria-label={`View other names for ${presetName}`}
                            className="preset-tool-info-button tooltip-target"
                            data-tooltip="Also known as"
                            onClick={() => setAliasModalToolName(presetName)}
                            type="button"
                          >
                            i
                          </button>
                        </span>
                      );
                    }

                    const presetButton = (
                      <button
                        aria-label={`${isAdded ? "Deselect" : "Select"} ${presetName}${isOwned ? " (already in your toolbox)" : ""}`}
                        className={`preset-tool-pill${isAdded ? " is-added" : ""}`}
                        disabled={isSaving}
                        key={`${category.id}-${presetName}`}
                        onClick={() => onToggleTool(presetName)}
                        type="button"
                      >
                        {pillIcon}
                        {presetName}
                      </button>
                    );
                    return presetButton;
                  };
                  const categoryTools =
                    category.tools && category.tools.length > 0
                      ? category.tools
                      : tools
                          .filter((tool) => normalizeCategory(tool.category) === category.label)
                          .map((tool) => tool.name)
                          .sort((firstName, secondName) => firstName.localeCompare(secondName));
                  const isExpanded = expandedCategoryIds.includes(category.id);
                  const showsAllCategoryTools = isExpanded || category.id === "coding-dev";
                  const visibleCategoryTools = showsAllCategoryTools ? categoryTools : categoryTools.slice(0, 8);

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
                          {!showsAllCategoryTools && categoryTools.length > 8 ? (
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

      {aliasModalToolName ? (
        <div className="welcome-modal-overlay preset-alias-modal-overlay" role="presentation">
          <section
            aria-labelledby="preset-alias-modal-title"
            aria-modal="true"
            className="welcome-modal category-info-modal preset-alias-modal"
            role="dialog"
          >
            <h2 id="preset-alias-modal-title">{aliasModalToolName}</h2>
            <p>{toolAliasTextByName[aliasModalToolName]}</p>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-primary" onClick={() => setAliasModalToolName(null)} type="button">
                Got it
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
