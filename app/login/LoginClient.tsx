"use client";

import { type FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type AuthMode = "login" | "signup";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const capitalizeFirstLetter = (value: string) => value.replace(/^(\s*)([a-z])/, (_, spaces: string, letter: string) => `${spaces}${letter.toUpperCase()}`);

const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default function LoginClient({ initialMode }: { initialMode: AuthMode }) {
  const isSignup = initialMode === "signup";
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const callbackUrl = () => `${window.location.origin}/auth/callback`;

  const sendMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setHasSubmitted(true);

    if (!isSupabaseConfigured) {
      setAuthError("Supabase is not configured yet. Add your project URL and anon key first.");
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedUsername = username.trim();
    if ((isSignup && !trimmedUsername) || !trimmedEmail || !emailPattern.test(trimmedEmail)) return;

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: callbackUrl(),
        shouldCreateUser: isSignup,
        data: isSignup
          ? {
              name: trimmedUsername,
              full_name: trimmedUsername,
            }
          : undefined,
      },
    });
    setIsSubmitting(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setAuthMessage("Check your email for your magic link.");
  };

  const continueWithGoogle = async () => {
    setAuthError("");
    setAuthMessage("");

    if (!isSupabaseConfigured) {
      setAuthError("Supabase is not configured yet. Add your project URL and anon key first.");
      return;
    }

    setIsGoogleSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl(),
      },
    });

    if (error) {
      setIsGoogleSubmitting(false);
      setAuthError(error.message);
    }
  };

  const emailError = hasSubmitted
    ? !email.trim()
      ? "Email is required"
      : !emailPattern.test(email.trim())
        ? "Enter a valid email address"
        : ""
    : "";
  const usernameError = isSignup && hasSubmitted && !username.trim() ? "Username is required" : "";

  return (
    <main className="landing-frame" data-theme="dark" data-dark-variant="cool">
      <div className="landing-inner">
        <div className={`landing-logo${isSignup ? " is-signup" : ""}`}>
          <div className="landing-logo-icon">AI</div>
          {!isSignup ? <div className="landing-logo-name">AI Subprise</div> : null}
        </div>

        <section className={`landing-card${isSignup ? " auth-signup-card" : ""}`} aria-label={isSignup ? "Sign up for AI Subprise" : "Sign in to AI Subprise"}>
          <h1>{isSignup ? "Welcome to AI Subprise" : "Welcome back"}</h1>
          {!isSignup ? <p>No more second-guessing which one.</p> : null}

          <form noValidate onSubmit={sendMagicLink}>
            {isSignup ? (
              <label className="form-field">
                <span>Username</span>
                <input
                  autoComplete="name"
                  autoFocus
                  className={usernameError ? "input-error" : undefined}
                  onChange={(event) => setUsername(capitalizeFirstLetter(event.target.value))}
                  placeholder="Enter your username"
                  type="text"
                  value={username}
                />
                <small className={usernameError ? "field-feedback error" : "field-feedback error field-feedback-placeholder"}>
                  {usernameError || "Username validation placeholder"}
                </small>
              </label>
            ) : null}
            <label className="form-field">
              <span>Email</span>
              <input
                autoComplete="email"
                autoFocus={!isSignup}
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
            {authError ? <small className="auth-inline-error" role="alert">{authError}</small> : null}
            {authMessage ? <small className="auth-inline-message" role="status">{authMessage}</small> : null}
            <button className="btn-primary auth-primary-action" disabled={isSubmitting || isGoogleSubmitting} type="submit">
              {isSubmitting ? "Sending link..." : isSignup ? "Sign up with magic link" : "Send me the Magic Link"}
            </button>
          </form>

          <div className="auth-divider" aria-hidden="true">
            <span className="auth-divider-line" />
            <span>or</span>
            <span className="auth-divider-line" />
          </div>

          <button className="btn-outline auth-google-action" disabled={isSubmitting || isGoogleSubmitting} onClick={continueWithGoogle} type="button">
            <svg aria-hidden="true" className="auth-google-logo" viewBox="0 0 24 24">
              <path d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z" fill="#4285F4" />
              <path d="M12 22c2.7 0 4.98-.9 6.64-2.38l-3.24-2.53c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z" fill="#34A853" />
              <path d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.47H3.04A10 10 0 0 0 2 12c0 1.62.39 3.15 1.04 4.53l3.35-2.61Z" fill="#FBBC05" />
              <path d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.47l3.35 2.61C7.18 7.71 9.39 5.95 12 5.95Z" fill="#EA4335" />
            </svg>
            <span>{isGoogleSubmitting ? "Opening Google..." : "Continue with Google"}</span>
          </button>
        </section>

        <div className="auth-footer">
          <span>
            {isSignup ? "Already have an account? " : "New to AI Subprise? "}
            <a className="inline-text-link" href={isSignup ? "/login" : "/login?mode=signup"}>
              {isSignup ? "Log in" : "Create an account"}
            </a>
          </span>
          <a className="auth-guest-link" href="/dashboard?demo=1">Continue to Explore as guest</a>
        </div>
      </div>
    </main>
  );
}
