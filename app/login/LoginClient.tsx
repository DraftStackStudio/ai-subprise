"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AuthMode = "login" | "signup";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default function LoginClient({ initialMode }: { initialMode: AuthMode }) {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setHasSubmitted(true);

    if (!isSupabaseConfigured) {
      setAuthError("Supabase is not configured yet. Add your project URL and anon key first.");
      return;
    }

    if (
      (authMode === "signup" && !name.trim()) ||
      !email.trim() ||
      !emailPattern.test(email.trim()) ||
      !password.trim() ||
      (authMode === "signup" && (!confirmPassword.trim() || confirmPassword !== password))
    ) {
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } =
      authMode === "login"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                name: name.trim(),
                full_name: name.trim(),
              },
              emailRedirectTo: `${window.location.origin}/dashboard?welcome=1`,
            },
          });

    setIsSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    if (authMode === "signup") {
      setAuthMessage("Account created. Check your email if confirmation is required.");
    }

    router.push("/dashboard?welcome=1");
    router.refresh();
  };

  const emailError = hasSubmitted
    ? !email.trim()
      ? "Email is required"
      : !emailPattern.test(email.trim())
        ? "Enter a valid email address"
        : ""
    : "";
  const nameError = authMode === "signup" && hasSubmitted && !name.trim() ? "Your name is required" : "";
  const passwordRequiredError = hasSubmitted && !password.trim() ? "Password is required" : "";
  const confirmPasswordError =
    authMode === "signup" && hasSubmitted
      ? !confirmPassword.trim()
        ? "Confirm password is required"
        : confirmPassword !== password
          ? "Passwords do not match"
          : ""
      : "";
  const passwordStrength = (() => {
    if (!password) return null;
    const normalizedPassword = password.toLowerCase().replace(/\s+/g, "");
    const commonPasswordPatterns = [
      "password",
      "password123",
      "12345678",
      "123456789",
      "qwerty123",
      "letmein",
      "admin123",
    ];
    const characterTypeCount = [
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /\d/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;

    const isCommonPassword = commonPasswordPatterns.some(
      (pattern) => normalizedPassword === pattern || normalizedPassword.startsWith(`${pattern}123`),
    );
    const isLowercaseOnly = /^[a-z]+$/.test(password);

    if (password.length < 8 || isLowercaseOnly || isCommonPassword) {
      return { label: "Weak", tone: "weak" };
    }
    if (password.length >= 12 && characterTypeCount >= 3) {
      return { label: "Strong", tone: "strong" };
    }
    if (password.length >= 8 && characterTypeCount >= 2) {
      return { label: "Good", tone: "good" };
    }
    return { label: "Weak", tone: "weak" };
  })();

  const sendPasswordReset = async () => {
    setAuthError("");
    setAuthMessage("");

    if (!isSupabaseConfigured) {
      setAuthError("Supabase is not configured yet. Add your project URL and anon key first.");
      return;
    }

    if (!email.trim()) {
      setAuthError("Enter your email address first.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    setIsSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setAuthMessage("Password reset email sent.");
  };

  return (
    <main className="landing-frame" data-theme="dark" data-dark-variant="cool">
      <div className="landing-inner">
        <div className="landing-logo">
          <div className="landing-logo-icon">AI</div>
          <div className="landing-logo-name">AI Subprise</div>
        </div>

        <section className="landing-card" aria-label="Sign in to AI Subprise">
          <h1>{authMode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p>{authMode === "login" ? "No more second-guessing which one." : "Start your AI account directory"}</p>

          <form noValidate onSubmit={submitAuth}>
            {authMode === "signup" ? (
              <label className="form-field">
                <span>Your Name</span>
                <input
                  autoComplete="name"
                  className={nameError ? "input-error" : undefined}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  type="text"
                  value={name}
                />
                <small className={nameError ? "field-feedback error" : "field-feedback error field-feedback-placeholder"}>
                  {nameError || "Name validation placeholder"}
                </small>
              </label>
            ) : null}
            <label className="form-field">
              <span>Email</span>
              <input
                autoComplete="email"
                autoFocus
                className={emailError ? "input-error" : undefined}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
              <small className={emailError ? "field-feedback error" : "field-feedback error field-feedback-placeholder"}>
                {emailError || "Email validation placeholder"}
              </small>
            </label>
            <label className="form-field">
              <span>Password</span>
              <span className="password-input-wrap">
                <input
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  className={passwordRequiredError ? "input-error" : undefined}
                  data-1p-ignore={authMode === "signup" ? "true" : undefined}
                  data-lpignore={authMode === "signup" ? "true" : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="password-visibility-toggle"
                  onClick={() => setShowPassword((isVisible) => !isVisible)}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    {showPassword ? (
                      <>
                        <path d="M4 12s2.8-5 8-5 8 5 8 5-2.8 5-8 5-8-5-8-5Z" />
                        <circle cx="12" cy="12" r="2.2" />
                      </>
                    ) : (
                      <>
                        <path d="M4 9.5c2.1 2.5 4.8 3.8 8 3.8s5.9-1.3 8-3.8" />
                        <path d="m6.3 12-1.5 1.8M9.8 13.1l-.6 2.2M14.2 13.1l.6 2.2M17.7 12l1.5 1.8" />
                      </>
                    )}
                  </svg>
                </button>
              </span>
              <small
                className={
                  passwordRequiredError
                    ? "field-feedback error"
                    : authMode === "signup" && passwordStrength
                      ? `field-feedback password-strength ${passwordStrength.tone}`
                      : "field-feedback error field-feedback-placeholder"
                }
              >
                {passwordRequiredError ||
                  (authMode === "signup" && passwordStrength?.label) ||
                  "Password validation placeholder"}
              </small>
            </label>
            {authMode === "signup" ? (
              <label className="form-field">
                <span>Confirm password</span>
                <input
                  autoComplete="new-password"
                  className={confirmPasswordError ? "input-error" : undefined}
                  data-1p-ignore="true"
                  data-lpignore="true"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your password"
                  type="password"
                  value={confirmPassword}
                />
                <small
                  className={
                    confirmPasswordError
                      ? "field-feedback error"
                      : "field-feedback error field-feedback-placeholder"
                  }
                >
                  {confirmPasswordError || "Confirm password validation placeholder"}
                </small>
              </label>
            ) : (
              <div className="forgot-password-row">
                <button className="inline-text-link" onClick={sendPasswordReset} type="button">
                  Forgot password?
                </button>
              </div>
            )}
            {authError ? (
              <small className="auth-inline-error" role="alert">
                {authError}
              </small>
            ) : null}
            {authMessage ? (
              <small className="auth-inline-message" role="status">
                {authMessage}
              </small>
            ) : null}
            <button className="btn-primary auth-primary-action" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Please wait..." : authMode === "login" ? "Log in" : "Create Account"}
            </button>
          </form>
        </section>

        <div className="auth-footer">
          <span>
            {authMode === "login" ? (
              <>
                New to AI Subprise?{" "}
                <button
                  className="inline-text-link auth-create-account-link"
                  onClick={() => setAuthMode("signup")}
                  type="button"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button className="inline-text-link auth-login-link" onClick={() => setAuthMode("login")} type="button">
                  Log in
                </button>
              </>
            )}
          </span>
          {authMode === "login" ? (
            <a className="auth-guest-link" href="/dashboard?demo=1">Continue to Explore as guest</a>
          ) : null}
        </div>
      </div>
    </main>
  );
}
