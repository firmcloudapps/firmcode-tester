"use client";

import React, { useState } from "react";
import { useInsForgeAuth } from "../insforge-provider-boundary";

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
  const { signIn, signUp, isLoading } = useInsForgeAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (mode === "sign-in") {
        await signIn(email, password);
      } else {
        await signUp(email, password, name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-5">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-primary">
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </h2>
        <p className="text-sm text-secondary mt-1">
          {mode === "sign-in" 
            ? "Enter your credentials to access your workspace" 
            : "Fill in your details to get started"}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

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
          ? (mode === "sign-in" ? "Signing in..." : "Creating account...") 
          : (mode === "sign-in" ? "Sign in" : "Create account")}
      </button>

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
