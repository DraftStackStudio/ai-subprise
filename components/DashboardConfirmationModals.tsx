"use client";

type PendingResolutionConfirmation = {
  originalEvent: string;
  title: string;
} | null;

type ToolStateConfirmation = {
  action: "unarchive" | "unwatchlist";
  toolName: string;
} | null;

type DashboardConfirmationModalsProps = {
  duplicateRestoreToolName: string | null;
  duplicateRestoreName: string;
  pendingResolutionConfirmation: PendingResolutionConfirmation;
  dontShowOnboardingAgain: boolean;
  showCreateAccountModal: boolean;
  showPresetSelectionWarning: boolean;
  toolStateConfirmation: ToolStateConfirmation;
  watchlistMoveToolName: string | null;
  onCancelDuplicateRestore: () => void;
  onDuplicateRestoreNameChange: (value: string) => void;
  onClosePendingResolution: () => void;
  onClosePresetSelectionWarning: () => void;
  onCloseToolStateConfirmation: () => void;
  onCloseWatchlistMove: () => void;
  onConfirmPendingResolution: () => void;
  onConfirmDuplicateRestore: () => void;
  onConfirmToolStateChange: () => void;
  onConfirmWatchlistMove: () => void;
  onDismissCreateAccount: () => void;
  onDontShowOnboardingAgainChange: (checked: boolean) => void;
  onOpenAccountSetup: () => void;
};

export default function DashboardConfirmationModals({
  duplicateRestoreToolName,
  duplicateRestoreName,
  pendingResolutionConfirmation,
  dontShowOnboardingAgain,
  showCreateAccountModal,
  showPresetSelectionWarning,
  toolStateConfirmation,
  watchlistMoveToolName,
  onCancelDuplicateRestore,
  onDuplicateRestoreNameChange,
  onClosePendingResolution,
  onClosePresetSelectionWarning,
  onCloseToolStateConfirmation,
  onCloseWatchlistMove,
  onConfirmPendingResolution,
  onConfirmDuplicateRestore,
  onConfirmToolStateChange,
  onConfirmWatchlistMove,
  onDismissCreateAccount,
  onDontShowOnboardingAgainChange,
  onOpenAccountSetup,
}: DashboardConfirmationModalsProps) {
  return (
    <>
      {duplicateRestoreToolName ? (
        <div className="welcome-modal-overlay duplicate-restore-overlay" role="presentation">
          <section
            aria-labelledby="duplicate-restore-title"
            aria-modal="true"
            className="welcome-modal compact-copy-modal duplicate-restore-modal"
            role="dialog"
          >
            <h2 id="duplicate-restore-title">This tool already exists</h2>
            <p className="duplicate-restore-existing-copy">
              You already have &quot;{duplicateRestoreToolName}.&quot;
            </p>
            <div className="duplicate-restore-rename-copy">
              <p>Restoring will rename this one:</p>
              <label className="duplicate-restore-name-field">
              <span className="sr-only">Restored tool name</span>
              <input
                aria-label="Restored tool name"
                onChange={(event) => onDuplicateRestoreNameChange(event.target.value)}
                type="text"
                value={duplicateRestoreName}
              />
                <span aria-hidden="true" className="duplicate-restore-edit-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 20h4l11-11-4-4L4 16v4Z" />
                    <path d="m13.5 6.5 4 4" />
                  </svg>
                </span>
              </label>
            </div>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" onClick={onCancelDuplicateRestore} type="button">
                Cancel
              </button>
              <button
                className="btn-sm btn-sm-primary"
                disabled={!duplicateRestoreName.trim()}
                onClick={onConfirmDuplicateRestore}
                type="button"
              >
                Restore
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showCreateAccountModal ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="welcome-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            <button
              aria-label="Close onboarding modal"
              className="modal-close-button"
              onClick={onDismissCreateAccount}
              type="button"
            >
              x
            </button>
            <div className="welcome-modal-icon">AI</div>
            <h2 id="welcome-modal-title">Start by adding your first login.</h2>
            <p>Add the login you use most often, then link your AI tools to it as you build your directory.</p>
            <label className="onboarding-opt-out">
              <input
                checked={dontShowOnboardingAgain}
                onChange={(event) => onDontShowOnboardingAgainChange(event.target.checked)}
                type="checkbox"
              />
              <span>Don&apos;t show this again.</span>
            </label>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" onClick={onDismissCreateAccount} type="button">
                Not now
              </button>
              <button className="btn-sm btn-sm-primary" onClick={onOpenAccountSetup} type="button">
                Go to Logins
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {pendingResolutionConfirmation ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="pending-resolution-confirmation-title"
            aria-modal="true"
            className="welcome-modal pending-resolution-confirmation-modal"
            role="dialog"
          >
            <h2 id="pending-resolution-confirmation-title">{pendingResolutionConfirmation.title}</h2>
            <p>
              This will add a new entry to Billing History. The original {pendingResolutionConfirmation.originalEvent} entry
              will stay unchanged.
            </p>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" onClick={onClosePendingResolution} type="button">
                Go back
              </button>
              <button className="btn-sm btn-sm-primary" onClick={onConfirmPendingResolution} type="button">
                Confirm
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {toolStateConfirmation ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="tool-state-confirm-modal-title"
            aria-modal="true"
            className={
              toolStateConfirmation.action === "unwatchlist"
                ? "welcome-modal delete-account-modal watchlist-removal-modal"
                : "welcome-modal delete-account-modal unarchive-confirmation-modal"
            }
            role="dialog"
            style={toolStateConfirmation.action === "unwatchlist" ? { border: "none" } : undefined}
          >
            <button
              aria-label="Close confirmation modal"
              className="modal-close-button"
              onClick={onCloseToolStateConfirmation}
              type="button"
            >
              x
            </button>
            <h2 id="tool-state-confirm-modal-title">
              {toolStateConfirmation.action === "unwatchlist" ? "Remove from Watchlist?" : "Unarchive Tool?"}
            </h2>
            <p>
              {toolStateConfirmation.action === "unwatchlist" ? (
                <>You can still find this tool in AI Toolbox.</>
              ) : (
                <>
                  <strong>{toolStateConfirmation.toolName}</strong> will return to AI Toolbox.
                </>
              )}
            </p>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" onClick={onCloseToolStateConfirmation} type="button">
                Cancel
              </button>
              <button className="btn-sm btn-sm-primary" onClick={onConfirmToolStateChange} type="button">
                {toolStateConfirmation.action === "unwatchlist" ? "Confirm" : "Unarchive"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {watchlistMoveToolName ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="watchlist-move-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            <button
              aria-label="Close move to Linked modal"
              className="modal-close-button"
              onClick={onCloseWatchlistMove}
              type="button"
            >
              x
            </button>
            <h2 id="watchlist-move-modal-title">Move to Linked?</h2>
            <p>
              Link <strong>{watchlistMoveToolName}</strong> to an account so it appears on the Linked page.
            </p>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-ghost" onClick={onCloseWatchlistMove} type="button">
                Cancel
              </button>
              <button className="btn-sm btn-sm-primary" onClick={onConfirmWatchlistMove} type="button">
                Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showPresetSelectionWarning ? (
        <div className="welcome-modal-overlay" role="presentation" style={{ zIndex: 110 }}>
          <section
            aria-labelledby="preset-selection-warning-title"
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
            <h2 id="preset-selection-warning-title">Select at least one AI tool</h2>
            <p>Choose at least one tool before continuing.</p>
            <div className="welcome-modal-actions" style={{ justifyContent: "center", marginTop: 26 }}>
              <button
                className="btn-sm btn-sm-primary"
                onClick={onClosePresetSelectionWarning}
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
