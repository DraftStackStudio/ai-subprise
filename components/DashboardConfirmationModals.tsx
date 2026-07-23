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
  pendingResolutionConfirmation: PendingResolutionConfirmation;
  showCreateAccountModal: boolean;
  showPresetSelectionWarning: boolean;
  toolStateConfirmation: ToolStateConfirmation;
  watchlistMoveToolName: string | null;
  onClosePendingResolution: () => void;
  onClosePresetSelectionWarning: () => void;
  onCloseToolStateConfirmation: () => void;
  onCloseWatchlistMove: () => void;
  onConfirmPendingResolution: () => void;
  onConfirmToolStateChange: () => void;
  onConfirmWatchlistMove: () => void;
  onDismissCreateAccount: () => void;
  onOpenAccountSetup: () => void;
};

export default function DashboardConfirmationModals({
  pendingResolutionConfirmation,
  showCreateAccountModal,
  showPresetSelectionWarning,
  toolStateConfirmation,
  watchlistMoveToolName,
  onClosePendingResolution,
  onClosePresetSelectionWarning,
  onCloseToolStateConfirmation,
  onCloseWatchlistMove,
  onConfirmPendingResolution,
  onConfirmToolStateChange,
  onConfirmWatchlistMove,
  onDismissCreateAccount,
  onOpenAccountSetup,
}: DashboardConfirmationModalsProps) {
  return (
    <>
      {showCreateAccountModal ? (
        <div className="welcome-modal-overlay" role="presentation">
          <section aria-labelledby="welcome-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
            <div className="welcome-modal-icon">AI</div>
            <h2 id="welcome-modal-title">Start by adding your first account.</h2>
            <p>Add the account you use most often, then link your AI tools to it as you build your directory.</p>
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
                : "welcome-modal delete-account-modal"
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
        <div className="welcome-modal-overlay" role="presentation">
          <section
            aria-labelledby="preset-selection-warning-title"
            aria-modal="true"
            className="welcome-modal compact-copy-modal"
            role="dialog"
          >
            <h2 id="preset-selection-warning-title">Select at least one AI tool</h2>
            <p>Choose at least one tool before continuing.</p>
            <div className="welcome-modal-actions">
              <button className="btn-sm btn-sm-primary" onClick={onClosePresetSelectionWarning} type="button">
                Continue selecting
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
