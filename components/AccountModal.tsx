"use client";

import { type FormEvent, type ReactNode, useMemo, useRef, useState } from "react";

export type AccountModalAccount = {
  id?: string;
  label: string;
  provider: string;
  login: string;
  tag: string;
  linked: number;
};

export type AccountColourOption = {
  className: string;
  label: string;
  tag: string;
};

export type AccountFormValues = {
  colourTag: string;
  login: string;
  nickname: string;
  provider: string;
};

type AccountModalProps = {
  accountDataError: string;
  accounts: AccountModalAccount[];
  colourOptions: AccountColourOption[];
  customProviderOption: string;
  customProviders: string[];
  defaultProviders: string[];
  editingAccount: AccountModalAccount | null;
  formatNickname: (value: string) => string;
  isSaving: boolean;
  nicknameMaxLength: number;
  onClose: () => void;
  onDelete: () => void;
  onSave: (values: AccountFormValues, options?: { addAnother?: boolean }) => Promise<boolean>;
  trashIcon: ReactNode;
};

function detectDefaultProviderLogin(login: string) {
  const lowerLogin = login.toLowerCase();
  const domain = lowerLogin.includes("@") ? lowerLogin.split("@").pop() ?? "" : lowerLogin;

  if (domain === "gmail.com") return "Gmail";
  if (domain === "icloud.com") return "iCloud";
  if (domain === "outlook.com" || domain === "hotmail.com") return "Outlook";
  if (domain === "yahoo.com" || domain.startsWith("yahoo.com.")) return "Yahoo";

  return "";
}

function validateLogin(provider: string, login: string) {
  const trimmedLogin = login.trim();
  const emailProviders = ["Gmail", "iCloud", "Outlook", "Yahoo"];

  if (!trimmedLogin) return null;
  if (provider === "Github") {
    if (/\s/.test(login)) {
      return {
        message: trimmedLogin.includes("@") ? "Email address cannot contain spaces" : "Username cannot contain spaces",
        type: "error" as const,
      };
    }
    if (trimmedLogin.includes("@")) {
      if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(trimmedLogin)) {
        return { message: "Please enter a complete email address", type: "error" as const };
      }
      return { message: "Email format looks good", type: "success" as const };
    }
    if (!/^[A-Za-z0-9-]+$/.test(trimmedLogin)) {
      return { message: "GitHub username: letters, numbers, hyphens (-) only", type: "error" as const };
    }
    return { message: "Username format looks good", type: "success" as const };
  }
  if (/\s/.test(login)) return { message: "Email address cannot contain spaces", type: "error" as const };
  if (!emailProviders.includes(provider)) {
    const defaultProviderMatch = detectDefaultProviderLogin(trimmedLogin);
    return defaultProviderMatch
      ? { message: `This looks like a ${defaultProviderMatch} login. Check if the provider should be ${defaultProviderMatch}.`, type: "error" as const }
      : null;
  }
  if (!trimmedLogin.includes("@")) return { message: "Please include an '@' in the email address.", type: "error" as const };
  const emailParts = trimmedLogin.split("@");
  if (emailParts.length !== 2 || !emailParts[0] || !emailParts[1]) {
    return { message: "Please enter a complete email address", type: "error" as const };
  }
  const domain = emailParts[1].toLowerCase();
  if (provider === "Gmail" && domain !== "gmail.com") return { message: "Gmail login must end with @gmail.com", type: "error" as const };
  if (provider === "iCloud" && domain !== "icloud.com") return { message: "iCloud login must end with @icloud.com", type: "error" as const };
  if (provider === "Outlook" && domain !== "outlook.com" && domain !== "hotmail.com") {
    return { message: "Outlook login must end with @outlook.com or @hotmail.com", type: "error" as const };
  }
  if (provider === "Yahoo" && domain !== "yahoo.com" && !domain.startsWith("yahoo.com.")) {
    return { message: "Yahoo login must end with @yahoo.com or a local Yahoo domain", type: "error" as const };
  }
  return { message: "Email format looks good", type: "success" as const };
}

export default function AccountModal({
  accountDataError,
  accounts,
  colourOptions,
  customProviderOption,
  customProviders,
  defaultProviders,
  editingAccount,
  formatNickname,
  isSaving,
  nicknameMaxLength,
  onClose,
  onDelete,
  onSave,
  trashIcon,
}: AccountModalProps) {
  const initialColour = colourOptions.find((option) => option.tag === editingAccount?.tag) ?? colourOptions[0];
  const knownProvider = editingAccount
    ? defaultProviders.includes(editingAccount.provider) || customProviders.includes(editingAccount.provider)
    : true;
  const [nickname, setNickname] = useState(editingAccount?.label ?? "");
  const [hasAttemptedNicknameOverflow, setHasAttemptedNicknameOverflow] = useState(false);
  const [provider, setProvider] = useState(editingAccount?.provider ?? "");
  const [isCustomProviderMode, setIsCustomProviderMode] = useState(Boolean(editingAccount && !knownProvider));
  const [login, setLogin] = useState(editingAccount?.login ?? "");
  const [selectedColour, setSelectedColour] = useState(initialColour);
  const [isColourMenuOpen, setIsColourMenuOpen] = useState(false);
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const nicknameInputRef = useRef<HTMLInputElement | null>(null);
  const providerOptions = useMemo(() => [...defaultProviders, ...customProviders], [customProviders, defaultProviders]);
  const loginFeedback = useMemo(() => validateLogin(provider, login), [login, provider]);
  const trimmedNickname = nickname.trim();
  const trimmedLogin = login.trim();
  const nicknameRequiredError = hasSubmitted && !trimmedNickname ? "Nickname is required" : "";
  const nicknameDuplicateError = hasSubmitted && trimmedNickname && accounts.some((account) =>
    account.login !== editingAccount?.login && account.label.trim().toLowerCase() === trimmedNickname.toLowerCase())
    ? "This nickname already exists" : "";
  const providerRequiredError = hasSubmitted && !provider.trim() ? "Provider is required" : "";
  const loginRequiredError = hasSubmitted && !trimmedLogin ? "Login is required" : "";
  const loginDuplicateError = hasSubmitted && trimmedLogin && accounts.some((account) =>
    account.login !== editingAccount?.login && account.login.trim().toLowerCase() === trimmedLogin.toLowerCase())
    ? "This login already exists" : "";

  const submit = async (event?: FormEvent<HTMLFormElement>, options?: { addAnother?: boolean }) => {
    event?.preventDefault();
    setHasSubmitted(true);
    if (!trimmedNickname || !provider.trim() || !trimmedLogin || loginFeedback?.type === "error" ||
      nicknameDuplicateError || loginDuplicateError || trimmedNickname.length > nicknameMaxLength) return;

    const saved = await onSave({ colourTag: selectedColour.tag, login: trimmedLogin, nickname: trimmedNickname, provider: provider.trim() }, options);
    if (saved && options?.addAnother && !editingAccount) {
      setNickname("");
      setHasAttemptedNicknameOverflow(false);
      setLogin("");
      setSelectedColour(colourOptions[0]);
      setIsCustomProviderMode(false);
      setIsColourMenuOpen(false);
      setHasSubmitted(false);
      window.setTimeout(() => nicknameInputRef.current?.focus(), 0);
    }
  };

  return (
    <div className="welcome-modal-overlay" role="presentation">
      <section aria-labelledby="add-account-modal-title" aria-modal="true" className="welcome-modal" role="dialog">
        <button aria-label="Close add account modal" className="modal-close-button" onClick={onClose} type="button">×</button>
        {editingAccount ? (
          <button aria-label="Delete account" className="modal-trash-button" onClick={onDelete} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24">{trashIcon}</svg>
          </button>
        ) : null}
        <h2 id="add-account-modal-title">{editingAccount ? "Edit Account" : "New Account Entry"}</h2>
        <form className="modal-form" onSubmit={(event) => void submit(event)}>
          {accountDataError ? <div className="data-state-message error" role="alert">{accountDataError}</div> : null}
          <label className="form-field">
            <span>Nickname</span>
            <input ref={nicknameInputRef} onChange={(event) => {
              const nextNickname = event.target.value;
              const isOverflowing = nextNickname.length > nicknameMaxLength;
              setHasAttemptedNicknameOverflow(isOverflowing || (hasAttemptedNicknameOverflow && nextNickname.length === nicknameMaxLength));
              setNickname(formatNickname(nextNickname.slice(0, nicknameMaxLength)));
            }} placeholder="Personal, Work, Dev, Burner, Client..." type="text" value={nickname} />
            <span className="nickname-feedback-row">
              {nicknameRequiredError || nicknameDuplicateError || hasAttemptedNicknameOverflow ? (
                <small className="field-feedback error">{nicknameRequiredError || nicknameDuplicateError || `Max ${nicknameMaxLength} characters`}</small>
              ) : <span />}
              <small aria-live="polite" className="nickname-character-count">{nickname.length}/{nicknameMaxLength}</small>
            </span>
          </label>
          <div className="form-field">
            <span>Colour</span>
            <div className={isColourMenuOpen ? "colour-menu is-open" : "colour-menu"}>
              <button aria-expanded={isColourMenuOpen} className="colour-menu-trigger" onClick={() => setIsColourMenuOpen((open) => !open)} type="button">
                <span className={`colour-swatch ${selectedColour.className}`} />{selectedColour.label}
              </button>
              {isColourMenuOpen ? <div className="colour-options">{colourOptions.map((option) => (
                <button className={selectedColour.label === option.label ? "colour-option is-selected" : "colour-option"} key={option.label}
                  onClick={() => { setSelectedColour(option); setIsColourMenuOpen(false); }} type="button">
                  <span className={`colour-swatch ${option.className}`} />{option.label}
                </button>
              ))}</div> : null}
            </div>
          </div>
          <label className="form-field">
            <span>Provider</span>
            {isCustomProviderMode ? (
              <input onChange={(event) => setProvider(formatNickname(event.target.value))} placeholder="Enter provider name" type="text" value={provider} />
            ) : (
              <div className={isProviderMenuOpen ? "custom-select is-open" : "custom-select"} id="account-provider"
                onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsProviderMenuOpen(false); }}>
                <button aria-expanded={isProviderMenuOpen} className={provider ? "custom-select-trigger" : "custom-select-trigger placeholder"}
                  onClick={() => setIsProviderMenuOpen((open) => !open)} type="button">
                  <span className="dropdown-option-label">{provider || "Select provider"}</span>
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {isProviderMenuOpen ? <div className="custom-select-options">{[...providerOptions, customProviderOption].map((option) => (
                  <button className={provider === option ? "custom-select-option is-selected" : "custom-select-option"} key={option}
                    onClick={() => { setIsProviderMenuOpen(false); if (option === customProviderOption) { setIsCustomProviderMode(true); setProvider(""); } else setProvider(option); }} type="button">
                    <span className="dropdown-option-label">{option}</span>
                  </button>
                ))}</div> : null}
              </div>
            )}
            {providerRequiredError ? <small className="field-feedback error">{providerRequiredError}</small> : null}
          </label>
          <label className="form-field">
            <span>Login</span>
            <input
              onChange={(event) => setLogin(event.target.value)}
              placeholder={
                provider === "Discord"
                  ? "your Discord username or email"
                  : provider === "Github"
                    ? "your GitHub username or email"
                    : ["Gmail", "iCloud", "Outlook", "Yahoo"].includes(provider)
                      ? "your email address"
                      : "you@example.com or github.com/username"
              }
              type="text"
              value={login}
            />
            {loginRequiredError ? <small className="field-feedback error">{loginRequiredError}</small>
              : loginDuplicateError ? <small className="field-feedback error">{loginDuplicateError}</small>
              : hasSubmitted && loginFeedback ? <small className={loginFeedback.type === "error" ? "field-feedback error" : "field-feedback success"}>
                {loginFeedback.type === "success" ? <span aria-hidden="true" className="field-check" /> : null}{loginFeedback.message}
              </small> : null}
          </label>
          <div className="welcome-modal-actions account-modal-actions">
            {!editingAccount ? <button className="btn-sm btn-sm-charcoal" disabled={isSaving} onClick={() => void submit(undefined, { addAnother: true })} type="button">+ Add next</button> : null}
            <button className="btn-sm btn-sm-primary" disabled={isSaving} type="submit">{isSaving ? "Saving..." : editingAccount ? "Save changes" : "Save"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
