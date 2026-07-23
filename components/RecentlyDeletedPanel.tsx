"use client";

type RecoveryTool = {
  id: string;
  name: string;
};

type RecoveryArchive = {
  createdAt: string;
  data: Array<{
    category: string;
    tools: RecoveryTool[];
  }>;
  id: string;
};

type RecentlyDeletedPanelProps = {
  archives: RecoveryArchive[];
  expandedArchiveIds: string[];
  onClose: () => void;
  onDeleteTool: (archiveId: string, toolId: string) => void;
  onRestoreSelected: (selectedKeys: string[]) => void;
  onRestoreTool: (archiveId: string, toolId: string) => void;
  onSearchChange: (value: string) => void;
  onToggleArchive: (archiveId: string) => void;
  onToggleTool: (archiveId: string, toolId: string) => void;
  searchValue: string;
  selectedKeys: string[];
  selectedVisibleKeys: string[];
};

function TrashIconPaths() {
  return (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v5M14 11v5" />
    </>
  );
}

export default function RecentlyDeletedPanel({
  archives,
  expandedArchiveIds,
  onClose,
  onDeleteTool,
  onRestoreSelected,
  onRestoreTool,
  onSearchChange,
  onToggleArchive,
  onToggleTool,
  searchValue,
  selectedKeys,
  selectedVisibleKeys,
}: RecentlyDeletedPanelProps) {
  return (
    <div className="recovery-dismiss-layer" onClick={onClose} role="presentation">
      <section
        aria-label="Recently Deleted"
        className="recovery-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <label className="recovery-search">
          <input
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="search in Recently Deleted"
            type="search"
            value={searchValue}
          />
        </label>
        <div className="recovery-list">
          {archives.length > 0 ? (
            archives.map((archive) => {
              const isExpanded = expandedArchiveIds.includes(archive.id);
              const archiveToolsCount = archive.data.reduce((count, group) => count + group.tools.length, 0);

              return (
                <section className="recovery-group" key={archive.id}>
                  <button
                    aria-expanded={isExpanded}
                    className="recovery-group-header"
                    onClick={() => onToggleArchive(archive.id)}
                    type="button"
                  >
                    <span>
                      <strong>
                        {new Date(archive.createdAt).toLocaleString("en-GB", {
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </strong>
                      <small>{archiveToolsCount} {archiveToolsCount === 1 ? "tool" : "tools"}</small>
                    </span>
                    <span className="recovery-group-handle" aria-hidden="true" />
                  </button>
                  {isExpanded ? (
                    <>
                      {archive.data.map((group) => (
                        <div className="recovery-category-group" key={`${archive.id}-${group.category}`}>
                          {group.tools.map((tool) => {
                            const recoveryKey = `${archive.id}:${tool.id}`;
                            return (
                              <article className="recovery-item" key={recoveryKey}>
                                <input
                                  aria-label={`Select ${tool.name}`}
                                  checked={selectedKeys.includes(recoveryKey)}
                                  onChange={() => onToggleTool(archive.id, tool.id)}
                                  type="checkbox"
                                />
                                <span className="recovery-item-copy">
                                  <strong>{tool.name}</strong>
                                </span>
                                <span className="recovery-item-category">{group.category}</span>
                                <span className="recovery-item-actions">
                                  <button
                                    aria-label={`Restore ${tool.name}`}
                                    className="recovery-icon-button"
                                    onClick={() => onRestoreTool(archive.id, tool.id)}
                                    type="button"
                                  >
                                    <svg aria-hidden="true" viewBox="0 0 24 24">
                                      <path d="M9 10H5V6" />
                                      <path d="M5 10a7 7 0 1 0 2-5" />
                                    </svg>
                                  </button>
                                  <button
                                    aria-label={`Delete ${tool.name} permanently`}
                                    className="recovery-icon-button"
                                    onClick={() => onDeleteTool(archive.id, tool.id)}
                                    type="button"
                                  >
                                    <svg aria-hidden="true" viewBox="0 0 24 24">
                                      <TrashIconPaths />
                                    </svg>
                                  </button>
                                </span>
                              </article>
                            );
                          })}
                        </div>
                      ))}
                    </>
                  ) : null}
                </section>
              );
            })
          ) : (
            <div className="recovery-empty">No recovered tools here yet</div>
          )}
        </div>
        <div className="recovery-footer">
          <span className="recovery-note">
            Once it has been in Recently Deleted for 30 days, it will be automatically deleted.
          </span>
          <button
            className={
              selectedVisibleKeys.length > 1
                ? "recovery-restore-selected is-bulk-ready"
                : "recovery-restore-selected"
            }
            disabled={selectedVisibleKeys.length === 0}
            onClick={() => onRestoreSelected(selectedVisibleKeys)}
            type="button"
          >
            Restore selected ({selectedVisibleKeys.length})
          </button>
        </div>
      </section>
    </div>
  );
}
