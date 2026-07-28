import type { ReactNode } from "react";

type ArchivedTool = {
  id: string;
  name: string;
};

type ArchiveViewProps = {
  archivedOn: string;
  isSelected: boolean;
  onDelete: () => void;
  onRestore: () => void;
  onToggleSelected: () => void;
  renderCategory: () => ReactNode;
  renderLastStatus: () => ReactNode;
  renderToolName: () => ReactNode;
  tool: ArchivedTool;
};

export default function ArchiveView({
  archivedOn,
  isSelected,
  onDelete,
  onRestore,
  onToggleSelected,
  renderCategory,
  renderLastStatus,
  renderToolName,
  tool,
}: ArchiveViewProps) {
  return (
    <article className="account-table-row tool-table-row archived-tool-row">
      <span className="tool-select-cell" data-label="Select">
        <input
          aria-label={`Select ${tool.name}`}
          checked={isSelected}
          className="tool-row-checkbox"
          onChange={onToggleSelected}
          type="checkbox"
        />
      </span>
      <div data-label="Tool Name">{renderToolName()}</div>
      <div className="category-cell" data-label="Category">{renderCategory()}</div>
      <div className="status-cell" data-label="Last Status">{renderLastStatus()}</div>
      <span className="muted-cell small-date" data-label="Archived On">{archivedOn}</span>
      <span className="row-actions" data-label="Action">
        <button className="text-action-link" onClick={onRestore} type="button">
          Restore
        </button>
        <button aria-label={`Delete ${tool.name}`} className="row-icon-action danger" onClick={onDelete} type="button">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
              <path d="M8.2 7V5.9A2.9 2.9 0 0 1 11.1 3h1.8a2.9 2.9 0 0 1 2.9 2.9V7" />
              <path d="M5.2 7h13.6v3.4H5.2V7Z" />
              <path d="m7.1 10.4.6 8.4A2.4 2.4 0 0 0 10.1 21h3.8a2.4 2.4 0 0 0 2.4-2.2l.6-8.4" />
              <path d="M10.2 13.2v4.6M12 13.2v4.6M13.8 13.2v4.6" />
            </g>
          </svg>
        </button>
      </span>
    </article>
  );
}
