"use client";

import type { FormEvent, ReactNode } from "react";

type ProviderManagementModalsProps = {
  deletingProvider: string | null;
  editingProvider: string | null;
  providerName: string;
  trashIcon: ReactNode;
  onCancelDelete: () => void;
  onCloseEdit: () => void;
  onConfirmDelete: () => void;
  onProviderNameChange: (value: string) => void;
  onRequestDelete: (provider: string) => void;
  onSaveProvider: (event: FormEvent<HTMLFormElement>) => void;
};

export default function ProviderManagementModals({
  deletingProvider,
  editingProvider,
  providerName,
  trashIcon,
  onCancelDelete,
  onCloseEdit,
  onConfirmDelete,
  onProviderNameChange,
  onRequestDelete,
  onSaveProvider,
}: ProviderManagementModalsProps) {
  return (
    <>
      {editingProvider ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="edit-provider-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            <button
              aria-label="Close edit provider modal"
              className="modal-close-button"
              onClick={onCloseEdit}
              type="button"
            >
              x
            </button>
            <button
              aria-label="Delete provider"
              className="modal-trash-button"
              onClick={() => onRequestDelete(editingProvider)}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                {trashIcon}
              </svg>
            </button>
            <h2 id="edit-provider-modal-title">Edit Provider</h2>
            <form className="modal-form" onSubmit={onSaveProvider}>
              <label className="form-field">
                <span>Provider Name</span>
                <input
                  onChange={(event) => onProviderNameChange(event.target.value)}
                  placeholder="Provider name"
                  type="text"
                  value={providerName}
                />
              </label>
              <div className="welcome-modal-actions">
                <button className="btn-sm btn-sm-primary" type="submit">
                  Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {deletingProvider ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="delete-provider-modal-title"
            aria-modal="true"
            className="welcome-modal delete-account-modal"
            role="dialog"
          >
            <button
              aria-label="Close delete provider modal"
              className="modal-close-button"
              onClick={onCancelDelete}
              type="button"
            >
              x
            </button>
            <div className="delete-account-icon">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                {trashIcon}
              </svg>
            </div>
            <h2 id="delete-provider-modal-title">Delete Provider?</h2>
            <p>
              This action is irreversible. Provider <strong>{deletingProvider}</strong> will be permanently removed.
            </p>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" onClick={onCancelDelete} type="button">
                Cancel
              </button>
              <button className="btn-sm btn-sm-danger" onClick={onConfirmDelete} type="button">
                Delete Provider
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
