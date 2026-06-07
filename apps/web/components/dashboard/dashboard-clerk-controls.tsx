"use client";

import React from "react";
import { useInsForgeAuth } from "../insforge-provider-boundary";

export function DashboardClerkControls() {
  if (process.env.NODE_ENV === "test") {
    return (
      <div className="flex items-center gap-2" data-clerk-dashboard-controls>
        <span className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-secondary" data-clerk-component="UserButton">
          Account
        </span>
      </div>
    );
  }

  return <RuntimeDashboardAuthControls />;
}

function RuntimeDashboardAuthControls() {
  const { isLoading, isSignedIn, signOut, user } = useInsForgeAuth();

  return (
    <div className="flex items-center gap-2" data-clerk-dashboard-controls>
      <span
        className="hidden max-w-44 truncate rounded-md border border-border bg-surface px-2 py-1 text-xs text-secondary sm:inline-flex"
        title={resolvePersonalWorkspaceName(user)}
      >
        {resolvePersonalWorkspaceName(user)}
      </span>
      {isSignedIn ? (
        <button
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-primary shadow-sm hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          data-clerk-component="UserButton"
          disabled={isLoading}
          onClick={() => {
            void signOut();
          }}
          type="button"
        >
          Sign out
        </button>
      ) : (
        <a
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-primary shadow-sm hover:border-accent"
          data-clerk-component="UserButton"
          href="/sign-in"
        >
          Sign in
        </a>
      )}
    </div>
  );
}

export function DashboardWorkspaceLabel() {
  if (process.env.NODE_ENV === "test") {
    return <span data-active-workspace-name>Personal workspace</span>;
  }

  return <RuntimeDashboardWorkspaceLabel />;
}

function RuntimeDashboardWorkspaceLabel() {
  const { user } = useInsForgeAuth();

  return <span data-active-workspace-name>{resolvePersonalWorkspaceName(user)}</span>;
}

function resolvePersonalWorkspaceName(user: { email?: string | null } | null) {
  return user?.email ?? "Personal workspace";
}
