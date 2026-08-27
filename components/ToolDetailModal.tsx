"use client";

import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type {
  ToolDetailAccountDraft,
  ToolStatus,
} from "@/types/toolDetail";

type ToolDetailModalProps = {
  accountTagClass: (accountLabel: string) => string;
  drafts: ToolDetailAccountDraft[];
  formatPlanName: (value: string) => string;
  hasUnsavedChanges: boolean;
  onAddAccount: () => void;
  onArchive: () => void;
  onClose: () => void;
  onCloseDropdowns: () => void;
  onSave: () => void;
  onUnlink: (draft: ToolDetailAccountDraft) => void;
  onUpdateDraft: (draftId: string, updates: Partial<ToolDetailAccountDraft>) => void;
  renderAccountSelector: (draft: ToolDetailAccountDraft) => ReactNode;
  renderDateField: (
    ariaLabel: string,
    value: string,
    onChange: (value: string) => void,
  ) => ReactNode;
  renderPlanSelector: (
    value: ToolStatus | "",
    onChange: (nextPlan: ToolStatus | "") => void,
  ) => ReactNode;
  renderStatusSelector: (draft: ToolDetailAccountDraft) => ReactNode;
  renderTrialOutcomeSelector: (
    draft: ToolDetailAccountDraft,
    placeholder: "Select outcome" | "Change trial outcome",
  ) => ReactNode;
  trialOutcomeState: (draft: ToolDetailAccountDraft) => {
    conversionDate?: string;
    state: "pending" | "converted";
  } | null;
  tool: {
    id: string;
    initials: string;
    logoBg: string;
    name: string;
  };
};

function ArchiveBoxIconPaths() {
  return (
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      <path d="M5.5 7.2h13v3.1h-13V7.2Z" />
      <path d="M6.7 10.3h10.6v8.2c0 .75-.6 1.35-1.35 1.35h-7.9c-.75 0-1.35-.6-1.35-1.35v-8.2Z" />
      <path d="M9.9 13.2h4.2" />
    </g>
  );
}

type AccountColumnAssignment = [string[], string[]];
const ACCOUNT_COLUMN_GAP_PX = 20;
const PLAN_SORT_PRIORITY: Partial<Record<ToolStatus, number>> = {
  Active: 0,
  Paid: 0,
  Trial: 1,
  Free: 2,
  "Free Tier": 2,
};

function balanceAccountColumns(
  drafts: ToolDetailAccountDraft[],
  heights: Record<string, number>,
): AccountColumnAssignment {
  const paidDrafts = drafts.filter((draft) => draft.plan === "Active" || draft.plan === "Paid");
  const trialDrafts = drafts.filter((draft) => draft.plan === "Trial");

  if (
    paidDrafts.length === 1
    && trialDrafts.length >= 2
    && paidDrafts.length + trialDrafts.length === drafts.length
  ) {
    return [
      [paidDrafts[0].draftId ?? paidDrafts[0].accountLabel],
      trialDrafts.map((draft) => draft.draftId ?? draft.accountLabel),
    ];
  }

  const columns: AccountColumnAssignment = [[], []];
  const columnHeights = [0, 0];
  const draftOrder = new Map(drafts.map((draft, index) => [draft.draftId ?? draft.accountLabel, index]));

  [...drafts]
    .sort((left, right) => {
      const leftPriority = left.plan ? PLAN_SORT_PRIORITY[left.plan] ?? 3 : 3;
      const rightPriority = right.plan ? PLAN_SORT_PRIORITY[right.plan] ?? 3 : 3;
      const planDifference = leftPriority - rightPriority;
      if (planDifference) return planDifference;

      const leftId = left.draftId ?? left.accountLabel;
      const rightId = right.draftId ?? right.accountLabel;
      const heightDifference = (heights[rightId] ?? 1) - (heights[leftId] ?? 1);
      return heightDifference || (draftOrder.get(leftId) ?? 0) - (draftOrder.get(rightId) ?? 0);
    })
    .forEach((draft) => {
      const columnIndex = columnHeights[0] <= columnHeights[1] ? 0 : 1;
      const interCardGap = columns[columnIndex].length > 0 ? ACCOUNT_COLUMN_GAP_PX : 0;
      const draftId = draft.draftId ?? draft.accountLabel;
      columns[columnIndex].push(draftId);
      columnHeights[columnIndex] += interCardGap + (heights[draftId] ?? 1);
    });

  return columns;
}

function assignmentsMatch(
  left: AccountColumnAssignment,
  right: AccountColumnAssignment,
) {
  return left.every((column, columnIndex) => (
    column.length === right[columnIndex].length
    && column.every((accountLabel, index) => accountLabel === right[columnIndex][index])
  ));
}

export default function ToolDetailModal({
  accountTagClass,
  drafts,
  formatPlanName,
  hasUnsavedChanges,
  onAddAccount,
  onArchive,
  onClose,
  onCloseDropdowns,
  onSave,
  onUnlink,
  onUpdateDraft,
  renderAccountSelector,
  renderDateField,
  renderPlanSelector,
  renderStatusSelector,
  renderTrialOutcomeSelector,
  trialOutcomeState,
  tool,
}: ToolDetailModalProps) {
  const accountCardRefs = useRef(new Map<string, HTMLDivElement>());
  const [accountCardHeights, setAccountCardHeights] = useState<Record<string, number>>({});
  const [columnAssignment, setColumnAssignment] = useState<AccountColumnAssignment>(() => (
    balanceAccountColumns(drafts, {})
  ));
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);
  const draftLayoutSignature = drafts
    .map((draft) => `${draft.draftId ?? draft.accountLabel}:${draft.accountLabel}:${draft.plan}`)
    .join("|");

  useLayoutEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setAccountCardHeights((currentHeights) => {
        let changed = false;
        const nextHeights = { ...currentHeights };

        entries.forEach((entry) => {
          const accountLabel = (entry.target as HTMLElement).dataset.toolDetailAccount;
          if (!accountLabel) return;

          const nextHeight = entry.target.getBoundingClientRect().height;
          if (Math.abs((currentHeights[accountLabel] ?? 0) - nextHeight) > 0.5) {
            nextHeights[accountLabel] = nextHeight;
            changed = true;
          }
        });

        return changed ? nextHeights : currentHeights;
      });
    });

    accountCardRefs.current.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [columnAssignment, draftLayoutSignature]);

  useLayoutEffect(() => {
    const nextAssignment = balanceAccountColumns(drafts, accountCardHeights);
    setColumnAssignment((currentAssignment) => (
      assignmentsMatch(currentAssignment, nextAssignment)
        ? currentAssignment
        : nextAssignment
    ));
  }, [accountCardHeights, draftLayoutSignature, drafts]);

  const accountColumns = useMemo(() => {
    const draftsByLabel = new Map(drafts.map((draft) => [draft.draftId ?? draft.accountLabel, draft]));
    const assignedLabels = new Set(columnAssignment.flat());
    const columns = columnAssignment.map((column) => (
      column
        .map((accountLabel) => draftsByLabel.get(accountLabel))
        .filter((draft): draft is ToolDetailAccountDraft => Boolean(draft))
    )) as [ToolDetailAccountDraft[], ToolDetailAccountDraft[]];

    drafts
      .filter((draft) => !assignedLabels.has(draft.draftId ?? draft.accountLabel))
      .forEach((draft) => {
        const targetColumn = columns[0].length <= columns[1].length ? 0 : 1;
        columns[targetColumn].push(draft);
      });

    return columns;
  }, [columnAssignment, drafts]);

  const requestClose = () => {
    if (hasUnsavedChanges) {
      onCloseDropdowns();
      setShowDiscardConfirmation(true);
      return;
    }
    onClose();
  };

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) requestClose();
  };

  const saveDrafts = () => {
    setHasAttemptedSave(true);
    if (drafts.some((draft) => !draft.plan)) return;
    onSave();
  };

  const renderAccountCard = (draft: ToolDetailAccountDraft) => {
    const draftId = draft.draftId ?? draft.accountLabel;
    const outcomeState = trialOutcomeState(draft);

    return (
      <div
        className={`tool-detail-account-block account-card${draft.plan === "Trial" ? " is-trial-account" : ""}`}
        data-tool-detail-account={draftId}
        key={draftId}
        ref={(card) => {
          if (card) {
            accountCardRefs.current.set(draftId, card);
          } else {
            accountCardRefs.current.delete(draftId);
          }
        }}
      >
        {draft.accountLabel ? <div className="tool-detail-account-heading">
          <span className={`email-tag ${accountTagClass(draft.accountLabel)}`}><span className="tag-dot" />{draft.accountLabel}</span>
          <button className="quiet-danger-link" onClick={() => onUnlink(draft)} type="button">Unlink</button>
        </div> : (
          <label className="form-field tool-detail-trial-date-field">
            <span>Account</span>
            {renderAccountSelector(draft)}
          </label>
        )}
        <div className="form-field">
          <span>Plan</span>
          {renderPlanSelector(draft.plan, (nextPlan) => {
            onUpdateDraft(draftId, { plan: nextPlan });
          })}
          {hasAttemptedSave && !draft.plan ? (
            <small className="field-feedback error">Select a plan type</small>
          ) : null}
        </div>

        {draft.plan === "Trial" ? (
          <label className="form-field">
            <span>Trial end date</span>
            {renderDateField(
              "Trial end date",
              draft.trialExpiryDate,
              (trialExpiryDate) => onUpdateDraft(draftId, { trialExpiryDate }),
            )}
          </label>
        ) : null}

        {draft.plan === "Active" ? (
          <>
            <div className="tool-detail-field-row tool-detail-plan-status-row">
              <label className="form-field">
                <span>Plan Name</span>
                <input
                  className="field-input"
                  onChange={(event) => onUpdateDraft(draftId, { planName: formatPlanName(event.target.value) })}
                  placeholder="Basic, Plus, Pro, Team, Business..."
                  type="text"
                  value={draft.planName}
                />
              </label>
              <label className="form-field">
                <span>Status</span>
                {renderStatusSelector(draft)}
              </label>
            </div>
          </>
        ) : null}

        {outcomeState ? (
          <div className="tool-detail-trial-outcome-zone">
            <span className="tool-detail-trial-outcome-label">
              {outcomeState.state === "pending"
                ? "What happened to this trial?"
                : `Converted from trial · ${outcomeState.conversionDate ?? ""}`}
            </span>
            {renderTrialOutcomeSelector(
              draft,
              outcomeState.state === "pending" ? "Select outcome" : "Change trial outcome",
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="welcome-modal-overlay" onClick={closeFromBackdrop} role="presentation">
      <section aria-labelledby="tool-detail-modal-title" aria-modal="true" className="welcome-modal tool-detail-modal" role="dialog">
        <button
          aria-label="Archive AI tool"
          className="modal-tool-action-button modal-tool-archive-button"
          onClick={onArchive}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24"><ArchiveBoxIconPaths /></svg>
        </button>
        <button aria-label="Close tool detail modal" className="modal-close-button" onClick={requestClose} type="button">x</button>
        <h2 id="tool-detail-modal-title">Tool Detail</h2>
        <div className="modal-tool-identity manage-modal-tool-identity">
          <span className="tool-avatar" style={{ background: tool.logoBg }}>{tool.initials}</span>
          <span className="modal-tool-name">{tool.name}</span>
        </div>
        <div className="tool-detail-account-grid">
          {accountColumns.map((column, columnIndex) => (
            <div className="tool-detail-account-column" key={`account-column-${columnIndex}`}>
              {column.map(renderAccountCard)}
            </div>
          ))}
        </div>
        <div className="welcome-modal-actions tool-detail-modal-footer">
          <button className="inline-text-link tool-detail-add-account" onClick={onAddAccount} type="button">+ Add another account</button>
          <button className="btn-sm btn-sm-primary" onClick={saveDrafts} type="button">Save</button>
        </div>
      </section>
      {showDiscardConfirmation ? (
        <div className="welcome-modal-overlay tool-detail-discard-overlay" role="presentation">
          <section
            aria-labelledby="tool-detail-discard-modal-title"
            aria-modal="true"
            className="welcome-modal delete-account-modal"
            role="dialog"
          >
            <h2 id="tool-detail-discard-modal-title">Discard changes?</h2>
            <p>You have unsaved changes. Closing now will discard them.</p>
            <div className="welcome-modal-actions">
              <button
                className="btn-sm btn-sm-ghost"
                onClick={() => setShowDiscardConfirmation(false)}
                type="button"
              >
                Keep editing
              </button>
              <button className="btn-sm btn-sm-danger" onClick={onClose} type="button">
                Discard &amp; close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
