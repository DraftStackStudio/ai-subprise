"use client";

import { useEffect, useState } from "react";

export type ResetMode = "blank" | "template";

type ResetAIToolsModalsProps = {
  archiveToolCount: number;
  pendingResetMode: ResetMode | null;
  showArchiveWarning: boolean;
  showDangerModal: boolean;
  isResetting: boolean;
  resetError: string;
  onCancelArchiveWarning: () => void;
  onCancelDanger: () => void;
  onConfirmDanger: () => void;
  onContinueArchiveWarning: () => void;
};

export default function ResetAIToolsModals({
  archiveToolCount,
  pendingResetMode,
  showArchiveWarning,
  showDangerModal,
  isResetting,
  resetError,
  onCancelArchiveWarning,
  onCancelDanger,
  onConfirmDanger,
  onContinueArchiveWarning,
}: ResetAIToolsModalsProps) {
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (!showDangerModal) setConfirmation("");
  }, [showDangerModal]);

  const isConfirmed = confirmation.trim().toUpperCase() === "RESET";

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

      {showDangerModal && pendingResetMode ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="reset-danger-modal-title"
            aria-modal="true"
            className="welcome-modal reset-overview-modal reset-confirmation-modal"
            role="dialog"
          >
            <h2 id="reset-danger-modal-title">Reset AI Subprise?</h2>
            <p>Start fresh while keeping your saved Logins.</p>
            <div className="reset-overview-list">
              <div className="reset-overview-group is-removed">
                <strong>This will be removed:</strong>
                <ul>
                  <li><span aria-hidden="true">×</span>AI tools</li>
                  <li><span aria-hidden="true">×</span>Linked accounts</li>
                  <li><span aria-hidden="true">×</span>Subscriptions</li>
                  <li><span aria-hidden="true">×</span>Billing settings and payments</li>
                  <li><span aria-hidden="true">×</span>Account activity and history</li>
                  <li><span aria-hidden="true">×</span>Watchlist, Favourites, Archived and Recently Deleted tool records</li>
                </ul>
              </div>
              <div className="reset-overview-group is-kept">
                <strong>This will be kept:</strong>
                <ul><li><span aria-hidden="true">✓</span>Your saved Logins</li></ul>
              </div>
            </div>
            <div className="reset-overview-final-warning">
              <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 10v5M12 7h.01" /></svg>
              <span>This cannot be undone.</span>
            </div>
            <label className="reset-confirmation-field">
              <span>Type <strong>reset</strong> to confirm</span>
              <input
                autoComplete="off"
                disabled={isResetting}
                onChange={(event) => setConfirmation(event.target.value)}
                value={confirmation}
              />
            </label>
            <div aria-live="polite" className="reset-confirmation-error">{resetError}</div>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" disabled={isResetting} onClick={onCancelDanger} type="button">
                Cancel
              </button>
              <button className="btn-sm btn-sm-danger" disabled={!isConfirmed || isResetting} onClick={onConfirmDanger} type="button">
                {isResetting ? "Resetting..." : "Reset AI Subprise"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
