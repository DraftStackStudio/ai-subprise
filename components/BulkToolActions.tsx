type BulkToolActionsProps = {
  isArchiveSection: boolean;
  onArchive: () => void;
  onClear: () => void;
  onDelete: () => void;
  selectedCount: number;
};

export default function BulkToolActions({
  isArchiveSection,
  onArchive,
  onClear,
  onDelete,
  selectedCount,
}: BulkToolActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bulk-action-bar" role="status">
      <span>{selectedCount} selected</span>
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
