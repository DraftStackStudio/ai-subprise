import type { FormEvent, ReactNode } from "react";
import Link from "next/link";

type SettingsTab = "billing" | "profile";

type SettingsViewProps = {
  canUpdatePassword: boolean;
  confirmPassword: string;
  confirmPasswordError: string;
  currentUserEmail: string;
  fullName: string;
  isSavingPassword: boolean;
  isSavingProfile: boolean;
  newPassword: string;
  newPasswordError: string;
  onConfirmPasswordChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onRenewalAlertsEnabledChange: (value: boolean) => void;
  onRemindersEnabledChange: (value: boolean) => void;
  onReseedDemo: () => void;
  onSavePassword: (event: FormEvent<HTMLFormElement>) => void;
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => void;
  onSettingsTabChange: (tab: SettingsTab) => void;
  passwordMessage: string;
  profileError: string;
  renewalAlertDaysDropdown: ReactNode;
  renewalAlertsEnabled: boolean;
  reminderDaysDropdown: ReactNode;
  remindersEnabled: boolean;
  settingsTab: SettingsTab;
  showDeveloperTools: boolean;
};

export default function SettingsView({
  canUpdatePassword,
  confirmPassword,
  confirmPasswordError,
  currentUserEmail,
  fullName,
  isSavingPassword,
  isSavingProfile,
  newPassword,
  newPasswordError,
  onConfirmPasswordChange,
  onFullNameChange,
  onNewPasswordChange,
  onRenewalAlertsEnabledChange,
  onRemindersEnabledChange,
  onReseedDemo,
  onSavePassword,
  onSaveProfile,
  onSettingsTabChange,
  passwordMessage,
  profileError,
  renewalAlertDaysDropdown,
  renewalAlertsEnabled,
  reminderDaysDropdown,
  remindersEnabled,
  settingsTab,
  showDeveloperTools,
}: SettingsViewProps) {
  return (
    <section className="account-page settings-page">
      <div className="settings-profile">
        <div className="settings-view-guidance">
          <span>Review your plan, billing details, profile and preferences.</span>
        </div>
        <div className="category-view-tab-list settings-tabs" role="tablist" aria-label="Settings sections">
          <button aria-selected={settingsTab === "billing"} className={settingsTab === "billing" ? "category-view-tab active" : "category-view-tab"} onClick={() => onSettingsTabChange("billing")} role="tab" type="button">Plan &amp; Billing</button>
          <button aria-selected={settingsTab === "profile"} className={settingsTab === "profile" ? "category-view-tab active" : "category-view-tab"} onClick={() => onSettingsTabChange("profile")} role="tab" type="button">Profile &amp; Preferences</button>
        </div>

        {settingsTab === "billing" ? (
          <div className="settings-billing-stack" role="tabpanel">
            <section className="settings-plan-card">
              <div className="settings-card-header">
                <div><span className="settings-eyebrow">Current plan</span><h2>Starter</h2></div>
                <Link className="btn-sm btn-sm-primary settings-billing-action" href="/pricing">Manage plan</Link>
              </div>
            </section>
            <section className="settings-section settings-content-card settings-promo-card">
              <div className="settings-card-header"><header><h2>Redeem a promo code</h2></header><button className="btn-sm btn-sm-primary settings-billing-action" type="button">Redeem</button></div>
              <div className="settings-promo-form"><input aria-label="Promo code" placeholder="Enter code" type="text" /></div>
            </section>
          </div>
        ) : (
          <div className="settings-profile-stack" role="tabpanel">
            <section className="settings-section settings-content-card">
              <header><h2>Profile</h2></header>
              <form className="modal-form settings-card-form" onSubmit={onSaveProfile}>
                <label className="form-field"><span>Full name</span><input autoComplete="name" onChange={(event) => onFullNameChange(event.target.value)} placeholder="Your name" type="text" value={fullName} /></label>
                <label className="form-field"><span>Email</span><input readOnly type="email" value={currentUserEmail || "Not signed in"} /></label>
                {profileError ? <div className="data-state-message error" role="alert">{profileError}</div> : null}
                <div className="settings-card-actions settings-card-actions-end"><button className="btn-sm btn-sm-primary" disabled={isSavingProfile} type="submit">{isSavingProfile ? "Saving..." : "Save changes"}</button></div>
              </form>
            </section>

            {canUpdatePassword ? (
              <section className="settings-section settings-content-card">
                <header><h2>Password</h2></header>
                <form className="modal-form settings-card-form" onSubmit={onSavePassword}>
                  <label className="form-field"><span>New password</span><input aria-invalid={Boolean(newPasswordError)} className={newPasswordError ? "input-error" : undefined} autoComplete="new-password" onChange={(event) => onNewPasswordChange(event.target.value)} placeholder="At least 6 characters" type="password" value={newPassword} />{newPasswordError ? <small className="field-feedback error">{newPasswordError}</small> : null}</label>
                  <label className="form-field"><span>Confirm password</span><input aria-invalid={Boolean(confirmPasswordError)} className={confirmPasswordError ? "input-error" : undefined} autoComplete="new-password" onChange={(event) => onConfirmPasswordChange(event.target.value)} placeholder="Re-enter password" type="password" value={confirmPassword} />{confirmPasswordError ? <small className="field-feedback error">{confirmPasswordError}</small> : null}</label>
                  {passwordMessage ? <div className="data-state-message" role="status">{passwordMessage}</div> : null}
                  <div className="settings-card-actions settings-card-actions-end"><button className="btn-sm btn-sm-primary" disabled={isSavingPassword} type="submit">{isSavingPassword ? "Updating..." : "Update password"}</button></div>
                </form>
              </section>
            ) : null}

            <section className="settings-section settings-content-card">
              <header><h2>Dashboard alerts</h2><p>Choose which upcoming items appear on your Dashboard.</p></header>
              <div className="settings-alert-block">
                <h3>Trial alerts</h3>
                <div className="settings-toggle-row"><span>Show trial alerts</span><button aria-pressed={remindersEnabled} className={remindersEnabled ? "settings-toggle is-on" : "settings-toggle"} onClick={() => onRemindersEnabledChange(!remindersEnabled)} type="button"><span />{remindersEnabled ? "On" : "Off"}</button></div>
                <label className="form-field settings-compact-field"><span>Show trials ending within</span>{reminderDaysDropdown}</label>
              </div>
              <div className="settings-alert-block">
                <h3>Renewal alerts</h3>
                <div className="settings-toggle-row"><span>Show renewal alerts</span><button aria-pressed={renewalAlertsEnabled} className={renewalAlertsEnabled ? "settings-toggle is-on" : "settings-toggle"} onClick={() => onRenewalAlertsEnabledChange(!renewalAlertsEnabled)} type="button"><span />{renewalAlertsEnabled ? "On" : "Off"}</button></div>
                <label className="form-field settings-compact-field"><span>Show renewals within</span>{renewalAlertDaysDropdown}</label>
              </div>
            </section>

            {showDeveloperTools ? (
              <section className="settings-developer-section">
                <header className="settings-developer-header">
                  <span className="settings-eyebrow">Developer</span>
                  <p>Only visible to you while building AI Subprise.</p>
                </header>
                <div className="settings-developer-row">
                  <div>
                    <h2>Reseed demo data</h2>
                    <p>Resets sample tools, logins, and billing to defaults.</p>
                  </div>
                  <button className="btn-sm btn-sm-ghost" onClick={onReseedDemo} type="button">Reseed</button>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
