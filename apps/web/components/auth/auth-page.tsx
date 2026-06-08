"use client";

import React, { useEffect, useState } from "react";
import { useInsForgeAuth } from "../insforge-provider-boundary";
import {
  DEFAULT_RESEND_COOLDOWN_SECONDS,
  normalizeVerificationCode,
  normalizeVerificationError,
  requiresEmailVerification,
  validateVerificationCode
} from "../../lib/auth-verification";

type AuthMode = "sign-in" | "sign-up";

interface AuthPageProps {
  mode: AuthMode;
}

export function AuthPage({ mode }: AuthPageProps) {
  const title = mode === "sign-in" ? "Sign in to Firmcode" : "Create your Firmcode workspace";
  const subtitle =
    mode === "sign-in"
      ? "Open your PR review workspace with verified identity and tenant-scoped data."
      : "Start with a secure workspace for repository review automation.";

  return (
    <main className="min-h-screen bg-shell text-primary" data-auth-page={mode}>
      <div className="mx-auto grid min-h-screen max-w-6xl gap-8 px-5 py-8 md:grid-cols-[minmax(0,0.9fr)_minmax(400px,460px)] md:items-center md:px-8">
        <section className="hidden border-r border-border pr-10 md:block" aria-label="Firmcode context">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-lg font-black text-white shadow-sm">
              F
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">Firmcode</p>
              <p className="text-base font-semibold text-primary">PR review workspace</p>
            </div>
          </div>
          <h1 className="max-w-md text-3xl font-semibold leading-tight text-primary">{title}</h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-secondary">{subtitle}</p>
          <div className="mt-8 grid max-w-md gap-3 text-sm text-secondary">
            <p className="rounded-md border border-border bg-surface px-3 py-2">Secure authentication protects your workspace.</p>
            <p className="rounded-md border border-border bg-surface px-3 py-2">Workspace membership scopes repositories and findings.</p>
            <p className="rounded-md border border-border bg-surface px-3 py-2">GitHub setup starts after sign-in.</p>
          </div>
        </section>
        <section className="flex min-h-[calc(100vh-4rem)] flex-col justify-center md:min-h-0" aria-label={title}>
          <div className="mb-6 flex items-center gap-3 md:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-base font-black text-white shadow-sm">
              F
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">Firmcode</p>
              <p className="text-sm font-semibold text-primary">PR review workspace</p>
            </div>
          </div>
          <div className="w-full max-w-[460px] rounded-lg border border-border bg-surface p-3 shadow-sm" data-auth-panel>
            <InsForgeAuthForm mode={mode} />
          </div>
        </section>
      </div>
    </main>
  );
}

function InsForgeAuthForm({ mode }: { mode: AuthMode }) {
  const { signIn, signUp, signInWithGoogle, verifyEmail, resendVerificationEmail, authConfig, isLoading } = useInsForgeAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState<{
    email: string;
    method: "code" | "link";
    intent: AuthMode;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    try {
      if (mode === "sign-in") {
        const result = await signIn(email, password);
        if (result.status === "needs_email_verification") {
          setPendingVerification({
            email: result.email,
            method: result.method,
            intent: mode
          });
          setVerificationCode("");
          setNotice(
            result.method === "code"
              ? "Enter the 6-digit verification code sent to your email to continue."
              : "Check your email for the verification link to continue."
          );
        }
      } else {
        const result = await signUp(email, password, name);
        if (result.status === "needs_email_verification") {
          setPendingVerification({
            email: result.email,
            method: result.method,
            intent: mode
          });
          setVerificationCode("");
          setNotice(
            result.method === "code"
              ? "Enter the 6-digit verification code we sent to your email."
              : "Check your email for the verification link to finish creating your account."
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      if (requiresEmailVerification(message)) {
        const method = authConfig?.verifyEmailMethod ?? "code";
        setPendingVerification({
          email,
          method,
          intent: mode
        });
        setNotice(
          method === "code"
            ? "Enter the 6-digit verification code sent to your email to continue."
            : "Check your email for the verification link to continue."
        );
      } else {
        setError(message);
      }
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (pendingVerification === null) {
      return;
    }

    const sanitizedCode = normalizeVerificationCode(verificationCode);
    const validationError = validateVerificationCode(sanitizedCode);
    if (validationError !== null) {
      setError(validationError);
      return;
    }

    try {
      await verifyEmail(pendingVerification.email, sanitizedCode, pendingVerification.intent);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setError(normalizeVerificationError(message, "verify"));
    }
  };

  const handleResend = async () => {
    if (pendingVerification === null || resendCooldown > 0) {
      return;
    }

    setError(null);
    setNotice(null);

    try {
      await resendVerificationEmail(pendingVerification.email);
      setResendCooldown(DEFAULT_RESEND_COOLDOWN_SECONDS);
      setNotice(
        pendingVerification.method === "code"
          ? "A new 6-digit verification code has been sent."
          : "A fresh verification email has been sent."
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not resend verification email";
      setError(normalizeVerificationError(message, "resend"));
    }
  };

  const isVerificationStep = pendingVerification !== null;

  return (
    <form onSubmit={isVerificationStep ? handleVerificationSubmit : handleSubmit} className="space-y-4 p-5">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-primary">
          {isVerificationStep ? "Verify your email" : mode === "sign-in" ? "Sign in" : "Create account"}
        </h2>
        <p className="text-sm text-secondary mt-1">
          {isVerificationStep
            ? `Finish ${pendingVerification.intent === "sign-in" ? "signing in" : "creating your account"} for ${pendingVerification.email}`
            : mode === "sign-in"
              ? "Enter your credentials to access your workspace"
              : "Fill in your details to get started"}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {isVerificationStep ? (
        <>
          {pendingVerification.method === "code" ? (
            <div className="space-y-2">
              <label htmlFor="verification-code" className="block text-sm font-medium text-primary">
                Verification code
              </label>
              <input
                id="verification-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(normalizeVerificationCode(e.target.value))}
                className="w-full rounded-md border border-border px-3 py-2 text-primary tracking-[0.35em] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="123456"
                maxLength={6}
                required
              />
              <p className="text-xs leading-5 text-secondary">
                Enter the 6-digit code we emailed to verify this address before granting access.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-border bg-shell px-3 py-3 text-sm leading-6 text-secondary">
              Verification is link-based for this environment. Open the latest email we sent and follow the verification
              link to continue.
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={isLoading || pendingVerification.method !== "code"}
              className="flex-1 rounded-md bg-accent px-4 py-2 text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Verifying..." : "Verify code"}
            </button>
            <button
              type="button"
              disabled={isLoading || resendCooldown > 0}
              onClick={handleResend}
              className="flex-1 rounded-md border border-border bg-shell px-4 py-2 text-primary hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setPendingVerification(null);
              setVerificationCode("");
              setResendCooldown(0);
              setError(null);
              setNotice(null);
            }}
            className="w-full rounded-md border border-transparent px-4 py-2 text-sm text-secondary hover:text-primary"
          >
            Back to {mode === "sign-in" ? "sign in" : "account details"}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={isLoading}
            onClick={async () => {
              setError(null);
              setNotice(null);

              try {
                await signInWithGoogle();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Google sign-in failed");
              }
            }}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-shell px-4 py-2 text-primary hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              aria-hidden="true"
              className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-white text-xs font-semibold text-primary"
            >
              G
            </span>
            <span>{mode === "sign-in" ? "Continue with Google" : "Sign up with Google"}</span>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-[0.16em] text-secondary">
              <span className="bg-surface px-2">Or use email</span>
            </div>
          </div>

          {mode === "sign-up" && (
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-primary">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Your name"
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-primary">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-primary">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-accent px-4 py-2 text-white hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? mode === "sign-in"
                ? "Signing in..."
                : "Creating account..."
              : mode === "sign-in"
                ? "Sign in"
                : "Create account"}
          </button>
        </>
      )}

      <div className="text-center text-sm">
        {mode === "sign-in" ? (
          <p className="text-secondary">
            Don&apos;t have an account?{" "}
            <a href="/sign-up" className="text-accent hover:underline">
              Sign up
            </a>
          </p>
        ) : (
          <p className="text-secondary">
            Already have an account?{" "}
            <a href="/sign-in" className="text-accent hover:underline">
              Sign in
            </a>
          </p>
        )}
      </div>
    </form>
  );
}
