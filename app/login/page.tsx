"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (!isSupabaseConfigured) {
      setAuthError("Supabase is not configured yet. Add your project URL and anon key first.");
      return;
    }

    if (!email.trim() || !password.trim()) {
      setAuthError("Email and password are required.");
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

          <form onSubmit={submitAuth}>
            <label className="form-field">
              <span>Email address</span>
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </label>
            <label className="form-field">
              <span>Password</span>
              <input
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                type="password"
                value={password}
              />
            </label>
            <div className="forgot-password-row">
              <button className="inline-text-link" onClick={sendPasswordReset} type="button">
                Forgot password?
              </button>
            </div>
            {authError ? (
              <div className="data-state-message error" role="alert">
                {authError}
              </div>
            ) : null}
            {authMessage ? (
              <div className="data-state-message" role="status">
                {authMessage}
              </div>
            ) : null}
            <button className="btn-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Please wait..." : authMode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="auth-divider">
            <span className="auth-divider-line" />
            <span>or</span>
            <span className="auth-divider-line" />
          </div>

          <a className="btn-outline" href="/demo">
            Explore as guest
          </a>
        </section>

        <div className="auth-footer">
          {authMode === "login" ? (
            <>
              New to AI Subprise?{" "}
              <button className="inline-text-link" onClick={() => setAuthMode("signup")} type="button">
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="inline-text-link" onClick={() => setAuthMode("login")} type="button">
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
