"use client";

import { Fragment } from "react";

export type RoleOption =
  | "Creator"
  | "Designer"
  | "Developer"
  | "Business"
  | "Researcher"
  | "AI Enthusiast"
  | "Custom";

type CategorySetupModalsProps = {
  categoryDescriptions: Record<string, string>;
  defaultToolCategories: string[];
  onChooseRole: (role: RoleOption) => void;
  onCloseCategoryGuide: () => void;
  onCloseCategoryPreview: () => void;
  onCloseRoleQuestion: () => void;
  onContinueSelecting: () => void;
  onOpenCategoryGuide: () => void;
  onSaveRoleCategories: () => void;
  onSwitchPreviewRole: (role: RoleOption) => void;
  onTogglePreviewCategory: (category: string) => void;
  roleCategoryMap: Record<RoleOption, string[]>;
  roleOptions: RoleOption[];
  roleQuestionChoice: RoleOption | "";
  selectedRole: RoleOption;
  selectedRoleCategories: string[];
  showCategoryGuide: boolean;
  showCategoryPreview: boolean;
  showCategorySelectionWarning: boolean;
  showRoleQuestion: boolean;
};

export default function CategorySetupModals({
  categoryDescriptions,
  defaultToolCategories,
  onChooseRole,
  onCloseCategoryGuide,
  onCloseCategoryPreview,
  onCloseRoleQuestion,
  onContinueSelecting,
  onOpenCategoryGuide,
  onSaveRoleCategories,
  onSwitchPreviewRole,
  onTogglePreviewCategory,
  roleCategoryMap,
  roleOptions,
  roleQuestionChoice,
  selectedRole,
  selectedRoleCategories,
  showCategoryGuide,
  showCategoryPreview,
  showCategorySelectionWarning,
  showRoleQuestion,
}: CategorySetupModalsProps) {
  return (
    <>
      {showRoleQuestion ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="role-question-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            <button
              aria-label="Close role question modal"
              className="modal-close-button"
              onClick={onCloseRoleQuestion}
              type="button"
            >
              x
            </button>
            <h2 id="role-question-modal-title">Start with a template</h2>
            <p>This just shapes your setup, you can always edit later.</p>
            <div className="modal-question-label">What best describes you?</div>
            <div className="role-radio-list">
              {roleOptions.map((role) => (
                <label className="role-radio-option" key={role}>
                  <input
                    checked={roleQuestionChoice === role}
                    onChange={() => onChooseRole(role)}
                    type="radio"
                    value={role}
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {showCategoryPreview ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="category-preview-modal-title"
            aria-modal="true"
            className="welcome-modal category-preview-modal"
            role="dialog"
          >
            <button
              aria-label="Close category preview modal"
              className="modal-close-button"
              onClick={onCloseCategoryPreview}
              type="button"
            >
              x
            </button>
            <h2 id="category-preview-modal-title">Choose your categories</h2>
            <p>Review the suggested categories for your workspace.</p>
            <div className="category-matrix-wrap">
              <div className="category-matrix">
                <div
                  className="category-matrix-highlight"
                  aria-hidden="true"
                  style={{ transform: `translate3d(${roleOptions.indexOf(selectedRole) * 100}%, 0, 0)` }}
                />
                <div className="category-matrix-head category-name-head">
                  <span>Category</span>
                  <button
                    aria-label="View category descriptions"
                    className="category-info-button tooltip-target"
                    data-tooltip="Category guide"
                    onClick={onOpenCategoryGuide}
                    type="button"
                  >
                    i
                  </button>
                </div>
                {roleOptions.map((role) => (
                  <div className="category-matrix-head" key={role}>
                    {role}
                  </div>
                ))}
                {defaultToolCategories.map((category) => (
                  <Fragment key={category}>
                    <div className="category-matrix-cell category-name-cell">{category}</div>
                    {roleOptions.map((role) => (
                      <div className="category-matrix-cell category-role-cell" key={`${category}-${role}`}>
                        {role === "Custom" && selectedRole === "Custom" ? (
                          <input
                            aria-label={`Custom category ${category}`}
                            className="category-matrix-checkbox"
                            checked={selectedRoleCategories.includes(category)}
                            onChange={() => onTogglePreviewCategory(category)}
                            type="checkbox"
                          />
                        ) : roleCategoryMap[role].includes(category) ? (
                          <span className="matrix-tick">✓</span>
                        ) : null}
                      </div>
                    ))}
                  </Fragment>
                ))}
                <p className="category-matrix-role-hint">Select to change role</p>
                <span
                  aria-hidden="true"
                  className="category-matrix-radio-indicator"
                  style={{ transform: `translate3d(${roleOptions.indexOf(selectedRole) * 100}%, 0, 0)` }}
                />
                {roleOptions.map((role) => (
                  <label className="category-matrix-radio-cell" key={`role-radio-${role}`}>
                    <input
                      aria-label={role}
                      checked={selectedRole === role}
                      onChange={() => onSwitchPreviewRole(role)}
                      type="radio"
                      value={role}
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-primary" onClick={onSaveRoleCategories} type="button">
                Confirm
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showCategoryGuide ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="category-info-modal-title"
            aria-modal="true"
            className="welcome-modal category-info-modal"
            role="dialog"
          >
            <h2 id="category-info-modal-title">Category guide</h2>
            <div className="category-info-table">
              {defaultToolCategories.map((category) => (
                <Fragment key={`info-${category}`}>
                  <span>{category}</span>
                  <span>{categoryDescriptions[category]}</span>
                </Fragment>
              ))}
            </div>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-primary" onClick={onCloseCategoryGuide} type="button">
                Got it
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showCategorySelectionWarning ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="category-selection-warning-title"
            aria-modal="true"
            className="welcome-modal compact-copy-modal category-selection-warning-modal"
            role="dialog"
            style={{ maxWidth: 360, padding: 28, textAlign: "center" }}
          >
            <div className="category-selection-warning-icon" aria-hidden="true" style={{ margin: "0 auto 14px" }}>
              <svg viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="3" />
                <path d="m8 9 1.5 1.5L12 8" />
                <path d="M14 9h3" />
                <path d="m8 14 1.5 1.5L12 13" />
                <path d="M14 14h3" />
              </svg>
            </div>
            <h2 id="category-selection-warning-title">Select at least one category</h2>
            <p>You can always add more later from settings.</p>
            <div className="welcome-modal-actions" style={{ justifyContent: "center", marginTop: 26 }}>
              <button
                className="btn-sm btn-sm-primary"
                onClick={onContinueSelecting}
                style={{ minWidth: 148 }}
                type="button"
              >
                Continue selecting
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
