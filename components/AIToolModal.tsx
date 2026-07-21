"use client";

import type { FormEvent, ReactNode, RefObject } from "react";

type DropdownOption = {
  description?: string;
  disabled?: boolean;
  label: string;
  tag?: string;
  value: string;
};

type DropdownConfig = {
  ariaLabel?: string;
  className?: string;
  id: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  options: DropdownOption[];
  placeholder?: string;
  selectedLabel?: string;
  value: string;
};

type AIToolModalProps = {
  archiveIcon: ReactNode;
  category: string;
  categoryOptions: string[];
  categoryRequiredError: string;
  customCategoryOption: string;
  isCustomCategoryMode: boolean;
  isEditing: boolean;
  isSaving: boolean;
  name: string;
  nameDuplicateError: string;
  nameInputRef: RefObject<HTMLInputElement | null>;
  nameRequiredError: string;
  onArchive: () => void;
  onCategoryChange: (value: string) => void;
  onClose: () => void;
  onDelete: () => void;
  onNameChange: (value: string) => void;
  onSave: (
    event?: FormEvent<HTMLFormElement>,
    options?: { addAnother?: boolean },
  ) => void | Promise<void>;
  onUrlChange: (value: string) => void;
  renderDropdown: (config: DropdownConfig) => ReactNode;
  toolDataError: string;
  trashIcon: ReactNode;
  url: string;
};

export default function AIToolModal({
  archiveIcon,
  category,
  categoryOptions,
  categoryRequiredError,
  customCategoryOption,
  isCustomCategoryMode,
  isEditing,
  isSaving,
  name,
  nameDuplicateError,
  nameInputRef,
  nameRequiredError,
  onArchive,
  onCategoryChange,
  onClose,
  onDelete,
  onNameChange,
  onSave,
  onUrlChange,
  renderDropdown,
  toolDataError,
  trashIcon,
  url,
}: AIToolModalProps) {
  return (
    <div className="welcome-modal-overlay" role="presentation">
      <section aria-labelledby="add-tool-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
        {isEditing ? (
          <>
            <button
              aria-label="Delete AI tool"
              className="modal-tool-action-button modal-tool-trash-button"
              onClick={onDelete}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                {trashIcon}
              </svg>
            </button>
            <button
              aria-label="Archive AI tool"
              className="modal-tool-action-button modal-tool-archive-button"
              onClick={onArchive}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                {archiveIcon}
              </svg>
            </button>
          </>
        ) : null}
        <button aria-label="Close AI tool modal" className="modal-close-button" onClick={onClose} type="button">
          x
        </button>
        <h2 id="add-tool-modal-title">{isEditing ? "Edit AI Tool" : "New AI Tool"}</h2>
        <form className="modal-form" onSubmit={(event) => void onSave(event)}>
          {toolDataError ? (
            <div className="data-state-message error" role="alert">
              {toolDataError}
            </div>
          ) : null}
          <label className="form-field">
            <span>AI Tool Name</span>
            <input
              ref={nameInputRef}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="ChatGPT, Claude, Midjourney..."
              type="text"
              value={name}
            />
            {nameRequiredError ? (
              <small className="field-feedback error">{nameRequiredError}</small>
            ) : nameDuplicateError ? (
              <small className="field-feedback error">{nameDuplicateError}</small>
            ) : null}
          </label>
          <label className="form-field">
            <span>Category</span>
            {isCustomCategoryMode ? (
              <input
                onChange={(event) => onCategoryChange(event.target.value)}
                placeholder="Category name"
                type="text"
                value={category}
              />
            ) : (
              renderDropdown({
                id: "tool-category",
                onChange: onCategoryChange,
                options: [
                  ...categoryOptions.map((categoryOption) => ({
                    label: categoryOption,
                    value: categoryOption,
                  })),
                  { label: customCategoryOption, value: customCategoryOption },
                ],
                placeholder: "Select category",
                value: category,
              })
            )}
            {categoryRequiredError ? <small className="field-feedback error">{categoryRequiredError}</small> : null}
          </label>
          <label className="form-field">
            <span>URL (optional)</span>
            <input
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="https://example.com"
              type="url"
              value={url}
            />
          </label>
          <div className="welcome-modal-actions account-modal-actions">
            {!isEditing ? (
              <button
                className="btn-sm btn-sm-charcoal"
                disabled={isSaving}
                onClick={() => void onSave(undefined, { addAnother: true })}
                type="button"
              >
                + Add next
              </button>
            ) : null}
            <button className="btn-sm btn-sm-primary" disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : isEditing ? "Save changes" : "Save AI tool"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
