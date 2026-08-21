"use client";

import type { ReactNode } from "react";

type DeleteAccountModalProps = {
  accountLabel: string;
  linkedToolCount: number;
  error: string;
  isDeleting: boolean;
  trashIcon: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteAccountModal({
  accountLabel,
  linkedToolCount,
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
        <h2 id="delete-account-modal-title">Delete {accountLabel}?</h2>
        <div className="delete-account-copy">
          {linkedToolCount === 0 ? (
            <p className="delete-account-empty-message">This action is irreversible.</p>
          ) : (
            <>
              <div className="delete-account-impact-panel">
                <div className="delete-account-impact-row">
                  <svg aria-hidden="true" className="delete-account-unlink-icon" viewBox="0 0 24 24">
                    <path d="M9.5 14.5 14.5 9.5" />
                    <path d="M10.5 7.5 12 6a4 4 0 0 1 5.7 5.7l-1.5 1.5" />
                    <path d="M13.5 16.5 12 18a4 4 0 0 1-5.7-5.7l1.5-1.5" />
                    <path d="M4.5 4.5 19.5 19.5" />
                  </svg>
                  <span>{linkedToolCount} AI {linkedToolCount === 1 ? "tool" : "tools"} will be unlinked</span>
                </div>
                <div className="delete-account-impact-row">
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                  <span>Tools stay in your AI Toolbox</span>
                </div>
                <div className="delete-account-impact-row">
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                  <span>Billing history is not affected</span>
                </div>
              </div>
              <p className="delete-account-irreversible">This cannot be undone.</p>
            </>
          )}
        </div>
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
            {isDeleting ? "Deleting..." : "Delete account"}
          </button>
        </div>
      </section>
    </div>
  );
}
