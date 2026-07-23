"use client";

import type { ReactNode } from "react";

type DeleteAccountModalProps = {
  accountLabel: string;
  error: string;
  isDeleting: boolean;
  trashIcon: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteAccountModal({
  accountLabel,
  error,
  isDeleting,
  trashIcon,
  onCancel,
  onConfirm,
}: DeleteAccountModalProps) {
  return (
    <div className="welcome-modal-overlay" role="presentation">
      <section
        aria-labelledby="delete-account-modal-title"
        aria-modal="true"
        className="welcome-modal delete-account-modal"
        role="dialog"
      >
        <button
          aria-label="Close delete account modal"
          className="modal-close-button"
          onClick={onCancel}
          type="button"
        >
          x
        </button>
        <div className="delete-account-icon">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            {trashIcon}
          </svg>
        </div>
        <h2 id="delete-account-modal-title">Delete Account?</h2>
        <p>
          This action is irreversible. All AI tools under <strong>{accountLabel}</strong> will be permanently removed.
        </p>
        {error ? (
          <div className="data-state-message error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="welcome-modal-actions">
          <button className="btn-sm btn-sm-ghost" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="btn-sm btn-sm-danger" disabled={isDeleting} onClick={onConfirm} type="button">
            {isDeleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </section>
    </div>
  );
}
