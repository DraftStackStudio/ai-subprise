"use client";

import {
  type DragEvent,
  type FormEvent,
  type PointerEvent,
  useEffect,
  useState,
} from "react";

type CategoryDeleteWarning = {
  category: string;
  index: number;
  toolCount: number;
};

type EditCategoryModalProps = {
  categoryDeleteWarning: CategoryDeleteWarning | null;
  categoryDiscardWarning: boolean;
  categoryDrafts: string[];
  newCategoryName: string;
  onAddCategory: () => void;
  onCancelDelete: () => void;
  onCancelDiscard: () => void;
  onConfirmDelete: () => void;
  onDeleteCategory: (index: number) => void;
  onDiscard: () => void;
  onMoveCategory: (draggedIndex: number, targetIndex: number) => void;
  onNewCategoryNameChange: (value: string) => void;
  onRequestClose: () => void;
  onSave: () => void;
  onUpdateCategory: (index: number, value: string) => void;
};

function TrashIconPaths() {
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      <path d="M8.2 7V5.9A2.9 2.9 0 0 1 11.1 3h1.8a2.9 2.9 0 0 1 2.9 2.9V7" />
      <path d="M5.2 7h13.6v3.4H5.2V7Z" />
      <path d="m7.1 10.4.6 8.4A2.4 2.4 0 0 0 10.1 21h3.8a2.4 2.4 0 0 0 2.4-2.2l.6-8.4" />
      <path d="M10.2 13.2v4.6" />
      <path d="M12 13.2v4.6" />
      <path d="M13.8 13.2v4.6" />
    </g>
  );
}

export default function EditCategoryModal({
  categoryDeleteWarning,
  categoryDiscardWarning,
  categoryDrafts,
  newCategoryName,
  onAddCategory,
  onCancelDelete,
  onCancelDiscard,
  onConfirmDelete,
  onDeleteCategory,
  onDiscard,
  onMoveCategory,
  onNewCategoryNameChange,
  onRequestClose,
  onSave,
  onUpdateCategory,
}: EditCategoryModalProps) {
  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<number | null>(null);

  const moveDraggedCategory = (targetIndex: number) => {
    if (draggedCategoryIndex === null || draggedCategoryIndex === targetIndex) return;
    onMoveCategory(draggedCategoryIndex, targetIndex);
    setDraggedCategoryIndex(targetIndex);
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, index: number) => {
    setDraggedCategoryIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  };

  const handlePointerDown = (_event: PointerEvent<HTMLButtonElement>, index: number) => {
    setDraggedCategoryIndex(index);
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    moveDraggedCategory(index);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    moveDraggedCategory(index);
    setDraggedCategoryIndex(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave();
  };

  useEffect(() => {
    if (draggedCategoryIndex === null) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const hoveredRow = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-category-index]");
      const targetIndex = Number(hoveredRow?.dataset.categoryIndex);

      if (Number.isInteger(targetIndex) && targetIndex !== draggedCategoryIndex) {
        moveDraggedCategory(targetIndex);
      }
    };

    const handlePointerUp = () => setDraggedCategoryIndex(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedCategoryIndex]);

  return (
    <div
      className="welcome-modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onRequestClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="edit-category-modal-title"
        aria-modal="true"
        className={
          categoryDeleteWarning
            ? "welcome-modal compact-copy-modal delete-account-modal category-delete-danger-modal"
            : categoryDiscardWarning
              ? "welcome-modal compact-copy-modal delete-account-modal category-discard-warning-modal"
              : "welcome-modal compact-copy-modal"
        }
        role="dialog"
      >
        {categoryDeleteWarning ? (
          <div className="category-delete-confirmation">
            <div className="delete-account-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <TrashIconPaths />
              </svg>
            </div>
            <h2 id="edit-category-modal-title">Delete "{categoryDeleteWarning.category}"?</h2>
            <p className="reset-danger-copy">
              <span>
                This category has {categoryDeleteWarning.toolCount} AI{" "}
                {categoryDeleteWarning.toolCount === 1 ? "tool" : "tools"} in it.
              </span>
              <span>
                Deleting the category will also delete{" "}
                {categoryDeleteWarning.toolCount === 1 ? "it" : "them"}. This can&apos;t be undone.
              </span>
            </p>
            <div className="welcome-modal-actions category-delete-confirmation-actions">
              <button className="btn-sm btn-sm-ghost" onClick={onCancelDelete} type="button">
                Cancel
              </button>
              <button className="btn-sm btn-sm-danger" onClick={onConfirmDelete} type="button">
                Delete category
              </button>
            </div>
          </div>
        ) : categoryDiscardWarning ? (
          <div className="category-delete-confirmation">
            <div className="delete-account-icon category-discard-warning-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 3 2.8 19h18.4L12 3Z" />
                <path d="M12 9v4.5" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <h2 id="edit-category-modal-title">Discard unsaved changes?</h2>
            <p>Your category changes have not been saved.</p>
            <div className="welcome-modal-actions category-delete-confirmation-actions category-discard-actions">
              <button className="btn-sm btn-sm-ghost" onClick={onCancelDiscard} type="button">
                Keep Editing
              </button>
              <button className="btn-sm btn-sm-danger" onClick={onDiscard} type="button">
                Discard &amp; Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 id="edit-category-modal-title">Edit Category</h2>
            <p>Hold and drag â ¿ to reorder. Rename or delete categories to fit your workflow</p>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="category-edit-list">
                {categoryDrafts.map((category, index) => (
                  <div
                    className={[
                      "category-edit-row",
                      "form-field",
                      draggedCategoryIndex === index ? "is-dragging" : "",
                    ].filter(Boolean).join(" ")}
                    data-category-index={index}
                    key={`category-draft-${index}`}
                    onDragEnter={(event) => handleDragEnter(event, index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, index)}
                    onPointerEnter={(event) => {
                      if (event.buttons === 1) moveDraggedCategory(index);
                    }}
                    onPointerUp={() => setDraggedCategoryIndex(null)}
                  >
                    <div className="category-edit-field">
                      <button
                        aria-label={`Reorder ${category}`}
                        className="drag-handle category-drag-handle"
                        draggable
                        onDragEnd={() => setDraggedCategoryIndex(null)}
                        onDragStart={(event) => handleDragStart(event, index)}
                        onPointerDown={(event) => handlePointerDown(event, index)}
                        type="button"
                      >
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </button>
                      <input
                        aria-label={`Edit ${category}`}
                        onChange={(event) => onUpdateCategory(index, event.target.value)}
                        placeholder="AI Assistant"
                        type="text"
                        value={category}
                      />
                      <button
                        aria-label={`Delete ${category}`}
                        className="category-icon-button danger"
                        onClick={() => onDeleteCategory(index)}
                        type="button"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <TrashIconPaths />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <label className="category-add-row form-field">
                <span>Add new category</span>
                <div className="category-add-controls">
                  <input
                    onChange={(event) => onNewCategoryNameChange(event.target.value)}
                    placeholder="Data & Analytics"
                    type="text"
                    value={newCategoryName}
                  />
                  <button className="btn-sm btn-sm-charcoal" onClick={onAddCategory} type="button">
                    Add
                  </button>
                </div>
              </label>
              <div className="welcome-modal-actions category-save-actions">
                <button className="btn-sm btn-sm-primary" type="submit">
                  Save &amp; Close
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
