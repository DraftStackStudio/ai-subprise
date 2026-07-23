import type { FormEvent, ReactNode } from "react";

type SettingsTab = "profile" | "preferences";

type SettingsViewProps = {
  currentUserEmail: string;
  isSavingProfile: boolean;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  onRemindersEnabledChange: (value: boolean) => void;
  onSaveNewPassword: (event: FormEvent<HTMLFormElement>) => void;
  onSettingsTabChange: (tab: SettingsTab) => void;
  onSignOut: () => void;
  profileError: string;
  profileMessage: string;
  reminderDaysDropdown: ReactNode;
  remindersEnabled: boolean;
  settingsTab: SettingsTab;
};

export default function SettingsView({
  currentUserEmail,
  isSavingProfile,
  newPassword,
  onNewPasswordChange,
  onRemindersEnabledChange,
  onSaveNewPassword,
  onSettingsTabChange,
  onSignOut,
  profileError,
  profileMessage,
  reminderDaysDropdown,
  remindersEnabled,
  settingsTab,
}: SettingsViewProps) {
  return (
    <section className="account-page settings-page">
      <div className="settings-profile">
        <div className="category-view-tab-list settings-tabs" role="tablist" aria-label="Settings sections">
          <button
            aria-selected={settingsTab === "profile"}
            className={settingsTab === "profile" ? "category-view-tab active" : "category-view-tab"}
            onClick={() => onSettingsTabChange("profile")}
            role="tab"
            type="button"
          >
            Profile
          </button>
          <button
            aria-selected={settingsTab === "preferences"}
            className={settingsTab === "preferences" ? "category-view-tab active" : "category-view-tab"}
            onClick={() => onSettingsTabChange("preferences")}
            role="tab"
            type="button"
          >
            Preferences
          </button>
        </div>

        {settingsTab === "profile" ? (
          <section className="settings-section settings-content-card settings-account-card" role="tabpanel">
            <header>
              <h2>Account</h2>
              <p>Manage your AI Subprise login.</p>
            </header>
            <form className="modal-form" onSubmit={onSaveNewPassword}>
              <label className="form-field">
                <span>Email</span>
                <input readOnly type="email" value={currentUserEmail || "Not signed in"} />
              </label>
              <label className="form-field">
                <span>New password</span>
                <input
                  autoComplete="new-password"
                  onChange={(event) => onNewPasswordChange(event.target.value)}
                  placeholder="Enter a new password"
                  type="password"
                  value={newPassword}
                />
              </label>
              {profileError ? <div className="data-state-message error" role="alert">{profileError}</div> : null}
              {profileMessage ? <div className="data-state-message" role="status">{profileMessage}</div> : null}
              <div className="welcome-modal-actions settings-profile-actions">
                <button className="quiet-danger-link" onClick={onSignOut} type="button">Sign out</button>
                <button className="btn-sm btn-sm-primary" disabled={isSavingProfile} type="submit">
                  {isSavingProfile ? "Saving..." : "Change password"}
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="settings-section settings-content-card" role="tabpanel">
            <header>
              <h2>Notifications</h2>
              <p>Stay ahead of renewals and trials.</p>
            </header>
            <div className="settings-toggle-row">
              <span>Trial &amp; renewal reminders</span>
              <button
                aria-pressed={remindersEnabled}
                className={remindersEnabled ? "settings-toggle is-on" : "settings-toggle"}
                onClick={() => onRemindersEnabledChange(!remindersEnabled)}
                type="button"
              >
                <span />
                {remindersEnabled ? "On" : "Off"}
              </button>
            </div>
            <label className="form-field settings-compact-field">
              <span>Remind me</span>
              {reminderDaysDropdown}
            </label>
          </section>
        )}
      </div>
    </section>
  );
}
