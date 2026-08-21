type BulkToolActionsProps = {
  actionSet?: "toolbox" | "watchlist" | "archive";
  isFloating?: boolean;
  onArchive: () => void;
  onClear: () => void;
  onDelete: () => void;
  onUnwatch?: () => void;
  selectedCount: number;
};

export default function BulkToolActions({
  actionSet = "toolbox",
  isFloating = false,
  onArchive,
  onClear,
  onDelete,
  onUnwatch,
  selectedCount,
}: BulkToolActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={isFloating ? "bulk-action-bar is-floating" : "bulk-action-bar"} role="status">
      <span className="bulk-action-count">
        <span className="bulk-action-count-number">{selectedCount}</span>
        selected
      </span>
      {actionSet === "toolbox" ? (
        <button className="bulk-action-btn danger" onClick={onDelete} type="button">
          Delete
        </button>
      ) : null}
      {actionSet === "watchlist" ? (
        <button className="bulk-action-btn" onClick={onUnwatch} type="button">
          Unwatch
        </button>
      ) : null}
      {actionSet !== "archive" ? (
        <button className="bulk-action-btn" onClick={onArchive} type="button">
          Archive
        </button>
      ) : null}
      {actionSet === "archive" ? (
        <button className="bulk-action-btn danger" onClick={onDelete} type="button">
          Delete
        </button>
      ) : null}
      <button className="bulk-action-btn ghost" onClick={onClear} type="button">
        Clear
      </button>
    </div>
  );
}
