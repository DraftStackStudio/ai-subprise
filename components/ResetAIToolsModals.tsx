"use client";

import type { ReactNode } from "react";

export type ResetMode = "blank" | "template";

type ResetAIToolsModalsProps = {
  archiveToolCount: number;
  pendingResetMode: ResetMode | null;
  showArchiveWarning: boolean;
  showDangerModal: boolean;
  showTypeModal: boolean;
  trashIcon: ReactNode;
  onCancelArchiveWarning: () => void;
  onCancelDanger: () => void;
  onCloseTypeModal: () => void;
  onConfirmDanger: () => void;
  onContinueArchiveWarning: () => void;
  onRequestReset: (mode: ResetMode) => void;
};

export default function ResetAIToolsModals({
  archiveToolCount,
  pendingResetMode,
  showArchiveWarning,
  showDangerModal,
  showTypeModal,
  trashIcon,
  onCancelArchiveWarning,
  onCancelDanger,
  onCloseTypeModal,
  onConfirmDanger,
  onContinueArchiveWarning,
  onRequestReset,
}: ResetAIToolsModalsProps) {
  return (
    <>
      {showArchiveWarning && archiveToolCount > 0 ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="reset-warning-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            <h2 id="reset-warning-modal-title">Previous Reset Found</h2>
            <p>
              You have {archiveToolCount} tools from previous resets that have not been restored. Resetting now will remove
              them permanently.
            </p>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" onClick={onCancelArchiveWarning} type="button">
                Cancel
              </button>
              <button className="btn-sm btn-sm-danger" onClick={onContinueArchiveWarning} type="button">
                Continue Reset
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showTypeModal ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="reset-type-modal-title"
            aria-modal="true"
            className="welcome-modal compact-copy-modal"
            role="dialog"
          >
            <button aria-label="Close reset modal" className="modal-close-button" onClick={onCloseTypeModal} type="button">
              x
            </button>
            <h2 id="reset-type-modal-title">Reset AI Tools</h2>
            <p>Choose how to rebuild your AI tool directory.</p>
            <div className="reset-choice-list">
              <button className="reset-choice-card" onClick={() => onRequestReset("blank")} type="button">
                <strong>Start from scratch</strong>
                <span>Clear active tools and categories so you can rebuild manually.</span>
              </button>
              <button className="reset-choice-card" onClick={() => onRequestReset("template")} type="button">
                <strong>Choose a new template</strong>
                <span>Clear active tools, then reopen the role template selection flow.</span>
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showDangerModal && pendingResetMode ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="reset-danger-modal-title"
            aria-modal="true"
            className="welcome-modal delete-account-modal"
            role="dialog"
          >
            <div className="delete-account-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">{trashIcon}</svg>
            </div>
            <h2 id="reset-danger-modal-title">Reset AI Tools?</h2>
            <p className="reset-danger-copy">
              <span>These tools will be removed from AI Subprise on all your devices.</span>
              <span>
                They&apos;ll be in <strong>Recently Deleted</strong> for 30 days.
              </span>
            </p>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" onClick={onCancelDanger} type="button">
                Cancel
              </button>
              <button className="btn-sm btn-sm-danger" onClick={onConfirmDanger} type="button">
                Reset AI Tools
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
