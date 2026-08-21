"use client";

import { Fragment, type DragEvent, type PointerEvent } from "react";

export type LoginAccount = {
  id?: string;
  label: string;
  provider: string;
  login: string;
  tag: string;
  linked: number;
};

type LoginAccountGroup = {
  provider: string;
  accounts: LoginAccount[];
};

type LoginsViewProps = {
  accountDataError: string;
  draggedAccountLogin: string | null;
  groupedAccounts: LoginAccountGroup[];
  isLoadingAccounts: boolean;
  onAddAccount: () => void;
  onCopyLogin: (login: string) => void;
  onDragAccount: (draggedLogin: string, targetLogin: string) => void;
  onDraggedAccountChange: (login: string | null) => void;
  onEditAccount: (account: LoginAccount) => void;
};

export default function LoginsView({
  accountDataError,
  draggedAccountLogin,
  groupedAccounts,
  isLoadingAccounts,
  onAddAccount,
  onCopyLogin,
  onDragAccount,
  onDraggedAccountChange,
  onEditAccount,
}: LoginsViewProps) {
  const handleDragStart = (event: DragEvent<HTMLButtonElement>, account: LoginAccount) => {
    onDraggedAccountChange(account.login);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", account.login);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>, account: LoginAccount) => {
    event.preventDefault();
    onDraggedAccountChange(account.login);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, account: LoginAccount) => {
    event.preventDefault();
    if (draggedAccountLogin) onDragAccount(draggedAccountLogin, account.login);
    onDraggedAccountChange(null);
  };

  return (
    <section className="account-page">
      {groupedAccounts.length > 0 ? (
        <div className="account-page-guidance">
          <span className="category-view-helper account-reorder-helper">
            Hold and drag
            <span aria-hidden="true" className="inline-drag-handle">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </span>
            to reorder your accounts.
          </span>
        </div>
      ) : null}
      {accountDataError ? (
        <div className="data-state-message error" role="alert">
          {accountDataError}
        </div>
      ) : null}
      <article className="form-card account-table-card">
        <div className="account-table account-database">
          {isLoadingAccounts ? (
            <div className="empty-state compact-empty">
              <strong>Loading accounts</strong>
              <span>Getting your saved accounts ready.</span>
            </div>
          ) : groupedAccounts.length > 0 ? (
            <>
              <div className="account-table-head" aria-hidden="true">
                <span />
                <span>Nickname</span>
                <span>Login</span>
                <span>Action</span>
              </div>
              {groupedAccounts.map((group) => (
                <Fragment key={group.provider}>
                  <div className="account-database-provider-row">
                    <span className="account-row-label">
                      <span>{group.provider}</span>
                      <span>{group.accounts.length}</span>
                    </span>
                  </div>
                  {group.accounts.map((account) => (
                    <div
                      className={draggedAccountLogin === account.login ? "account-table-row is-dragging" : "account-table-row"}
                      key={account.id ?? `${group.provider}-${account.label}`}
                      data-account-login={account.login}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDrop(event, account)}
                      onPointerEnter={(event) => {
                        if (event.buttons === 1 && draggedAccountLogin) {
                          onDragAccount(draggedAccountLogin, account.login);
                        }
                      }}
                      onPointerUp={() => onDraggedAccountChange(null)}
                    >
                      <span className="drag-handle-cell" data-label="Move">
                        <button
                          aria-label={`Reorder ${account.label}`}
                          className="drag-handle"
                          draggable
                          onDragEnd={() => onDraggedAccountChange(null)}
                          onDragStart={(event) => handleDragStart(event, account)}
                          onPointerDown={(event) => handlePointerDown(event, account)}
                          type="button"
                        >
                          <span />
                          <span />
                          <span />
                          <span />
                          <span />
                          <span />
                        </button>
                      </span>
                      <div data-label="Nickname">
                        <span className={`email-tag ${account.tag}`}>
                          <span className="tag-dot" />
                          {account.label}
                        </span>
                      </div>
                      <span className="account-login-cell" data-label="Login">
                        <button
                          aria-label={`Copy ${account.login}`}
                          className="copy-login-button tooltip-target"
                          data-tooltip="Copy"
                          onClick={() => onCopyLogin(account.login)}
                          type="button"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24">
                            <rect x="8" y="8" width="10" height="10" rx="2" />
                            <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        <span className="account-login-value">{account.login}</span>
                      </span>
                      <span data-label="Action">
                        <button className="action-btn" onClick={() => onEditAccount(account)} type="button">
                          Edit
                        </button>
                      </span>
                    </div>
                  ))}
                </Fragment>
              ))}
            </>
          ) : (
            <div className="empty-state">
              <strong>Your accounts list is empty</strong>
              <span>
                <button className="inline-text-link" onClick={onAddAccount} type="button">
                  + Add Logins
                </button>{" "}
                to start grouping your AI logins in one place.
              </span>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
