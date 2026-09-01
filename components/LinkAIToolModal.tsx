"use client";

import type { ComponentType, Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import type { ToolStatus } from "@/types/toolDetail";
import type {
  LinkToolAccountBlock,
  LinkToolDropdownOption,
  LinkToolItem,
} from "@/types/linkTool";

type DropdownArgs = {
  ariaLabel?: string;
  className?: string;
  id: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  options: LinkToolDropdownOption[];
  placeholder?: string;
  selectedLabel?: string;
  value: string;
};

type DateFieldProps = {
  ariaLabel: string;
  onChange: (value: string) => void;
  value: string;
};

type LinkAIToolModalProps = {
  blocks: LinkToolAccountBlock[];
  closeModal: () => void;
  defaultPlanForTool: () => ToolStatus | "";
  displayToolName: (name: string) => string;
  duplicateAccountLabels: string[];
  filteredToolOptions: LinkToolItem[];
  formatPlanName: (value: string) => string;
  hasSubmitted: boolean;
  isLocked: boolean;
  isPickerOpen: boolean;
  isSaving: boolean;
  isPlanAllowedForTool: (plan: ToolStatus | "") => boolean;
  linkToolId: string;
  openAddToolModal: () => void;
  orderedAccountOptions: LinkToolDropdownOption[];
  remainingAccountOptions: LinkToolDropdownOption[];
  renderDropdown: (args: DropdownArgs) => ReactNode;
  renderPlanSelector: (
    value: ToolStatus | "",
    onChange: (nextPlan: ToolStatus | "") => void,
  ) => ReactNode;
  searchQuery: string;
  selectedTool?: LinkToolItem;
  setBlocks: Dispatch<SetStateAction<LinkToolAccountBlock[]>>;
  setIsPickerOpen: (isOpen: boolean) => void;
  setLinkToolId: (id: string) => void;
  setOpenDropdownId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  toolInitials: (name: string) => string;
  DateFieldControl: ComponentType<DateFieldProps>;
};

export default function LinkAIToolModal({
  blocks,
  closeModal,
  defaultPlanForTool,
  displayToolName,
  duplicateAccountLabels,
  filteredToolOptions,
  formatPlanName,
  hasSubmitted,
  isLocked,
  isPickerOpen,
  isSaving,
  isPlanAllowedForTool,
  linkToolId,
  openAddToolModal,
  orderedAccountOptions,
  remainingAccountOptions,
  renderDropdown,
  renderPlanSelector,
  searchQuery,
  selectedTool,
  setBlocks,
  setIsPickerOpen,
  setLinkToolId,
  setOpenDropdownId,
  setSearchQuery,
  submit,
  toolInitials,
  DateFieldControl,
}: LinkAIToolModalProps) {
  return (
    <div className="welcome-modal-overlay" role="presentation">
      <section aria-labelledby="link-tool-modal-title" aria-modal="true" className="welcome-modal link-tool-modal" role="dialog">
        <button aria-label="Close link AI tool modal" className="modal-close-button" onClick={closeModal} type="button">
          x
        </button>
        <h2 id="link-tool-modal-title">Link AI Tool</h2>
        <form className="modal-form" onSubmit={submit}>
          <label className="form-field">
            <span>Tool</span>
            {isLocked && selectedTool ? (
              <div className="link-tool-locked-field modal-tool-identity">
                <span className="tool-avatar" style={{ background: selectedTool.logoBg }}>{toolInitials(selectedTool.name)}</span>
                <span className="modal-tool-name">{displayToolName(selectedTool.name)}</span>
              </div>
            ) : (
              <div
                className="link-tool-combobox"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsPickerOpen(false);
                }}
              >
                <div className="link-tool-combobox-field">
                  {selectedTool ? (
                    <span className="tool-avatar" style={{ background: selectedTool.logoBg }}>{toolInitials(selectedTool.name)}</span>
                  ) : null}
                  <input
                    onChange={(event) => {
                      setOpenDropdownId(null);
                      setSearchQuery(event.target.value);
                      setLinkToolId("");
                      setIsPickerOpen(true);
                    }}
                    onFocus={() => {
                      setOpenDropdownId(null);
                      setIsPickerOpen(true);
                    }}
                    placeholder="Search existing tools"
                    type="search"
                    value={selectedTool ? displayToolName(selectedTool.name) : searchQuery}
                  />
                </div>
                {isPickerOpen ? (
                  <div className="link-tool-search-results">
                    {filteredToolOptions.length > 0 ? filteredToolOptions.slice(0, 6).map((tool) => (
                      <button
                        className={linkToolId === tool.id ? "link-tool-result is-selected" : "link-tool-result"}
                        key={tool.id}
                        onClick={() => {
                          setLinkToolId(tool.id);
                          setSearchQuery(tool.name);
                          setIsPickerOpen(false);
                        }}
                        type="button"
                      >
                        <span className="tool-avatar" style={{ background: tool.logoBg }}>{toolInitials(tool.name)}</span>
                        <span>{displayToolName(tool.name)}</span>
                      </button>
                    )) : <span className="link-tool-empty">No existing tools found</span>}
                    <button
                      className="link-tool-result link-tool-create-row"
                      onClick={() => {
                        closeModal();
                        openAddToolModal();
                      }}
                      type="button"
                    >
                      <span>Can&apos;t find it? <span className="inline-accent-text">+ Create new tool</span></span>
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            {selectedTool?.accounts.length ? (
              <small className="field-feedback neutral">Already linked to: {selectedTool.accounts.join(", ")}</small>
            ) : null}
          </label>

          <div className="link-account-blocks">
            {blocks.map((block, blockIndex) => {
              const otherSelectedAccountLabels = blocks
                .filter((otherBlock) => otherBlock.id !== block.id)
                .map((otherBlock) => otherBlock.accountLabel)
                .filter(Boolean);
              const accountOptionsForBlock = orderedAccountOptions.filter(
                (option) =>
                  option.value === block.accountLabel ||
                  (!selectedTool?.accounts.includes(option.value) && !otherSelectedAccountLabels.includes(option.value)),
              );
              const isAlreadyLinked = Boolean(!isSaving && block.accountLabel && selectedTool?.accounts.includes(block.accountLabel));
              const isDuplicateInSubmission = Boolean(
                block.accountLabel &&
                blocks.some((otherBlock, otherIndex) => otherIndex !== blockIndex && otherBlock.accountLabel === block.accountLabel),
              );

              return (
                <div className="link-account-block" key={block.id}>
                  <div className="link-account-block-head">
                    <span>Account {blockIndex + 1}</span>
                    {blocks.length > 1 ? (
                      <button
                        aria-label={`Remove account ${blockIndex + 1}`}
                        className="row-icon-action linked-remove-action"
                        onClick={() => setBlocks((current) => current.filter((item) => item.id !== block.id))}
                        type="button"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="m6 6 12 12" />
                          <path d="m18 6-12 12" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  <div className="link-account-layout">
                    <div className="form-field link-account-field">
                      {renderDropdown({
                        className: hasSubmitted && !block.accountLabel ? "modal-dropdown has-field-error" : "modal-dropdown",
                        id: `link-tool-account-${block.id}`,
                        onChange: (accountLabel) => setBlocks((current) =>
                          current.map((item) => item.id === block.id ? { ...item, accountLabel } : item)),
                        options: accountOptionsForBlock.length > 0
                          ? [{ disabled: true, label: "No account linked yet", value: "" }, ...accountOptionsForBlock]
                          : [{ disabled: true, label: "No accounts available", value: "" }],
                        placeholder: "Select account",
                        value: block.accountLabel,
                      })}
                      {isAlreadyLinked ? (
                        <small className="field-feedback error">Already linked to this account</small>
                      ) : isDuplicateInSubmission ? (
                        <small className="field-feedback error">This account is already selected above</small>
                      ) : hasSubmitted && !block.accountLabel ? (
                        <small className="field-feedback error">Select an account</small>
                      ) : null}
                    </div>
                    <div className="link-account-plan-billing-row">
                      <div className="form-field link-plan-field">
                        <span>Plan</span>
                        {renderPlanSelector(
                          block.plan,
                          (plan) => setBlocks((current) =>
                            current.map((item) => item.id === block.id ? { ...item, plan } : item)),
                        )}
                      </div>
                      {block.plan === "Trial" ? (
                        <label className="form-field link-account-trial-date">
                          <span>Trial end date</span>
                          <DateFieldControl
                            ariaLabel="Trial end date"
                            onChange={(trialExpiryDate) => setBlocks((current) =>
                              current.map((item) => item.id === block.id ? { ...item, trialExpiryDate } : item))}
                            value={block.trialExpiryDate}
                          />
                        </label>
                      ) : null}
                    </div>
                    {block.plan === "Active" ? (
                      <>
                        <label className="form-field link-account-paid-plan-name">
                          <span>Plan Name</span>
                          <input
                            onChange={(event) => setBlocks((current) =>
                              current.map((item) => item.id === block.id
                                ? { ...item, planName: formatPlanName(event.target.value) }
                                : item))}
                            placeholder="Basic, Plus, Pro, Team, Business, Pay as you go..."
                            type="text"
                            value={block.planName}
                          />
                        </label>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {remainingAccountOptions.length > 0 ? (
            <button
              className="inline-text-link link-add-account-block"
              onClick={() => setBlocks((current) => [
                ...current,
                {
                  accountLabel: "",
                  billingType: "",
                  id: `link-account-${Date.now().toString(36)}-${current.length + 1}`,
                  lastTopUpDate: "",
                  nextChargeDate: "",
                  purchaseDate: "",
                  plan: defaultPlanForTool(),
                  planName: "",
                  trialExpiryDate: "",
                },
              ])}
              type="button"
            >
              + Add another account
            </button>
          ) : null}
          <div className="welcome-modal-actions">
            <button
              className="btn-sm btn-sm-primary"
              disabled={
                isSaving ||
                !linkToolId ||
                blocks.some((block) => !isPlanAllowedForTool(block.plan)) ||
                blocks.some((block) => Boolean(block.accountLabel && selectedTool?.accounts.includes(block.accountLabel))) ||
                duplicateAccountLabels.length > 0
              }
              type="submit"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
