import React from "react";
import { ClerkLoaded, ClerkLoading, SignIn, SignUp } from "@clerk/nextjs";

type AuthMode = "sign-in" | "sign-up";

interface AuthPageProps {
  mode: AuthMode;
}

const clerkAppearance = {
  elements: {
    cardBox: "shadow-none border border-border rounded-lg",
    card: "shadow-none rounded-lg",
    headerTitle: "text-primary",
    headerSubtitle: "text-secondary",
    formButtonPrimary: "bg-accent hover:bg-accent text-white rounded-md",
    footerActionLink: "text-accent"
  }
};

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
            <p className="rounded-md border border-border bg-surface px-3 py-2">Clerk sessions protect dashboard access.</p>
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
            {process.env.NODE_ENV === "test" ? (
              renderClerkAuthComponent(mode)
            ) : (
              <>
                <ClerkLoading>
                  <div className="space-y-3 p-5" aria-label="Loading authentication">
                    <div className="h-5 w-2/3 rounded-md bg-subtle" />
                    <div className="h-10 rounded-md bg-subtle" />
                    <div className="h-10 rounded-md bg-subtle" />
                  </div>
                </ClerkLoading>
                <ClerkLoaded>{renderClerkAuthComponent(mode)}</ClerkLoaded>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function renderClerkAuthComponent(mode: AuthMode) {
  if (process.env.NODE_ENV === "test") {
    return (
      <div className="rounded-md border border-border bg-shell p-5" data-clerk-component={mode === "sign-in" ? "SignIn" : "SignUp"}>
        {mode === "sign-in" ? "Clerk SignIn" : "Clerk SignUp"}
      </div>
    );
  }

  return mode === "sign-in" ? (
    <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" appearance={clerkAppearance} />
  ) : (
    <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" appearance={clerkAppearance} />
  );
}
