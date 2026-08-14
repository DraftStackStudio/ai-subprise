type BulkToolActionsProps = {
  isFloating?: boolean;
  isArchiveSection: boolean;
  onArchive: () => void;
  onClear: () => void;
  onDelete: () => void;
  selectedCount: number;
};

export default function BulkToolActions({
  isFloating = false,
  isArchiveSection,
  onArchive,
  onClear,
  onDelete,
  selectedCount,
}: BulkToolActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={isFloating ? "bulk-action-bar is-floating" : "bulk-action-bar"} role="status">
      <span className="bulk-action-count">
        <span className="bulk-action-count-number">{selectedCount}</span>
        selected
      </span>
      {!isArchiveSection ? (
        <button className="bulk-action-btn" onClick={onArchive} type="button">
          Archive
        </button>
      ) : null}
      <button className="bulk-action-btn danger" onClick={onDelete} type="button">
        Delete
      </button>
      <button className="bulk-action-btn ghost" onClick={onClear} type="button">
        Clear
      </button>
    </div>
  );
}
