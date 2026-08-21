"use client";

type RemovalTool = {
  accounts: string[];
  hasBillingHistory: boolean;
  id: string;
  name: string;
};

type PresetToolRemovalModalProps = {
  addingToolNames?: string[];
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  tools: RemovalTool[];
};

export default function PresetToolRemovalModal({
  addingToolNames = [],
  isSaving,
  onCancel,
  onConfirm,
  tools,
}: PresetToolRemovalModalProps) {
  const hasAnyBillingHistory = tools.some((tool) => tool.hasBillingHistory);
  const isCombinedChange = addingToolNames.length > 0;

  return (
    <div className="welcome-modal-overlay preset-removal-confirmation-overlay" role="presentation">
      <section
        aria-labelledby="preset-removal-confirmation-title"
        aria-modal="true"
        className="welcome-modal delete-account-modal preset-removal-confirmation-modal"
        role="dialog"
      >
        <div className="delete-account-icon" aria-hidden="true">
          <svg fill="none" viewBox="0 0 24 24">
            <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
          </svg>
        </div>
        <h2 id="preset-removal-confirmation-title">
          {isCombinedChange
            ? "Confirm changes?"
            : `Remove ${tools.length} ${tools.length === 1 ? "tool" : "tools"}?`}
        </h2>
        <div className="preset-change-sections">
          {isCombinedChange ? (
            <div className="preset-change-section">
              <p className="preset-change-section-label preset-change-section-label-adding">
                Adding · {addingToolNames.length}
              </p>
              <div className="preset-removal-tool-list preset-addition-tool-list">
                {addingToolNames.map((toolName) => (
                  <div className="preset-removal-tool preset-addition-tool" key={toolName}>
                    <svg aria-hidden="true" className="preset-removal-row-icon" viewBox="0 0 24 24">
                      <path d="m5 12 4 4L19 6" />
                    </svg>
                    <span>{toolName}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="preset-change-section">
            {isCombinedChange ? (
              <p className="preset-change-section-label">Removing · {tools.length}</p>
            ) : null}
            <div className="preset-removal-tool-list">
              {tools.map((tool) => (
                <div className="preset-removal-tool" key={tool.id}>
                  {tool.accounts.length > 0 ? (
                    <svg aria-hidden="true" className="preset-removal-row-icon" viewBox="0 0 24 24">
                      <path d="M9.5 14.5 14.5 9.5" />
                      <path d="M10.5 7.5 12 6a4 4 0 0 1 5.7 5.7l-1.5 1.5" />
                      <path d="M13.5 16.5 12 18a4 4 0 0 1-5.7-5.7l1.5-1.5" />
                      <path d="M4.5 4.5 19.5 19.5" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" className="preset-removal-row-icon" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                  <span>
                    {tool.accounts.length > 0
                      ? `${tool.name} will unlink from ${tool.accounts.join(", ")}`
                      : `${tool.name} is not linked to any account`}
                  </span>
                </div>
              ))}
              {hasAnyBillingHistory ? (
                <div className="preset-removal-tool preset-removal-history-row">
                  <svg aria-hidden="true" className="preset-removal-row-icon" viewBox="0 0 24 24">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                  <span>Billing history is not affected.</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <p className="preset-removal-irreversible">
          {isCombinedChange ? "Removals cannot be undone." : "This cannot be undone."}
        </p>
        <div className="welcome-modal-actions">
          <button className="btn-sm btn-sm-ghost" disabled={isSaving} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="btn-sm btn-sm-danger" disabled={isSaving} onClick={onConfirm} type="button">
            {isSaving ? "Saving..." : "Confirm"}
          </button>
        </div>
      </section>
    </div>
  );
}
