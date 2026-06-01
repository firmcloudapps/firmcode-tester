import React from "react";
import {
  canManageRepositoryConfiguration,
  canRetryReviewRuns,
  type RepositoryListItem
} from "@firmcode/shared";
import type { GitHubAppInstallConfig } from "../../config/github-app-installation";
import type { GitHubInstallationsState, GitHubSyncDashboardData } from "../../lib/dashboard-data";
import { isAllowedExternalDashboardUrl } from "../../lib/dashboard-route-readiness";
import { shortSha } from "./format";
import { GitHubInstallationSyncButton, GitHubRepositorySyncButton } from "./github-sync-controls";
import { RepositoryAutomationToggle } from "./repository-automation-toggle";
import { RetryReviewRunButton } from "./retry-review-run-button";

interface DeveloperPrReviewDashboardProps {
  state: GitHubInstallationsState;
  installConfig: GitHubAppInstallConfig;
}

export function DeveloperPrReviewDashboard({ state, installConfig }: DeveloperPrReviewDashboardProps) {
  return (
    <div className="min-h-screen bg-shell text-primary" data-clerk-authenticated="required">
      <div className="flex min-h-screen">
        <DeveloperSidebar oauthConnected={readOAuthConnected(state)} />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-4">
            <DeveloperHeader state={state} installConfig={installConfig} />
            {state.status === "loading" ? <DeveloperLoadingState /> : null}
            {state.status === "signed-out" ? <DeveloperSignedOutState /> : null}
            {state.status === "error" ? <DeveloperErrorState message={state.message} /> : null}
            {state.status === "empty" ? <DeveloperContent data={state.data} /> : null}
            {state.status === "populated" ? <DeveloperContent data={state.data} /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function DeveloperSidebar({ oauthConnected }: { oauthConnected: boolean }) {
  const links = [
    { label: "PR Review", href: "/dashboard/developer", active: true },
    { label: "Repositories", href: "/repositories", active: false },
    { label: "Pull Requests", href: "/pull-requests", active: false },
    { label: "Review Runs", href: "/review-runs", active: false }
  ] as const;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
      <div className="border-b border-border p-5">
        <a className="flex items-center gap-3" href="/dashboard/developer">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-lg font-black text-white shadow-sm">
            F
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold text-primary">firmcode.dev</span>
            <span className="block text-xs font-medium uppercase text-secondary">Review smarter</span>
          </span>
        </a>
      </div>
      <nav className="flex-1 p-4" aria-label="PR review navigation">
        <div className="grid gap-1">
          {links.map((link) => (
            <a
              key={link.label}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                link.active ? "border border-border bg-blush text-accent" : "text-secondary hover:bg-subtle hover:text-primary"
              }`}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
            >
              {link.label}
            </a>
          ))}
          <a
            className="mt-3 flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-secondary hover:bg-subtle hover:text-primary"
            href="/auth/github"
          >
            GitHub
            <span className={`h-2 w-2 rounded-full ${oauthConnected ? "bg-success" : "bg-slate-300"}`} aria-hidden="true" />
          </a>
        </div>
      </nav>
    </aside>
  );
}

function DeveloperHeader({
  state,
  installConfig
}: {
  state: GitHubInstallationsState;
  installConfig: GitHubAppInstallConfig;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-primary">PR Review</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">Review repositories and pull requests.</p>
      </div>
      <DeveloperHeaderActions state={state} installConfig={installConfig} />
    </header>
  );
}

function DeveloperLoadingState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Loading developer PR review dashboard">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-32 rounded-md bg-subtle" />
        <div className="h-32 rounded-md bg-subtle" />
      </div>
      <div className="mt-4 grid gap-3">
        <div className="h-20 rounded-md bg-subtle" />
        <div className="h-20 rounded-md bg-subtle" />
      </div>
    </section>
  );
}

function DeveloperSignedOutState() {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <h2 className="text-base font-semibold text-amber-900">Sign in is required</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-800">
        Firmcode needs a Clerk workspace session before it can connect GitHub or list repositories for review automation.
      </p>
      <a className="mt-4 inline-flex rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" href="/sign-in">
        Sign in
      </a>
    </section>
  );
}

function DeveloperErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-5">
      <h2 className="text-base font-semibold text-red-800">PR review dashboard could not be loaded</h2>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
      <a className="mt-4 inline-flex rounded-md bg-white px-3 py-2 text-sm font-medium text-red-800" href="/dashboard/developer">
        Retry
      </a>
    </section>
  );
}

function DeveloperContent({ data }: { data: GitHubSyncDashboardData }) {
  const hasInstallations = data.settings.githubApp.installations.length > 0;
  const canManageRepositories = canManageRepositoryConfiguration(data.settings.workspace.role);
  const canRetry = canRetryReviewRuns(data.settings.workspace.role);

  return (
    <div>
      <section className="rounded-lg border border-border bg-surface p-5" aria-label="Repository review queue">
        <div>
          <h2 className="text-base font-semibold text-primary">Repositories</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">Repositories available for automated PR review.</p>
        </div>
        {data.repositories.repositories.length === 0 ? (
          <div className="mt-4 rounded-md border border-border bg-surface p-6 text-center">
            <h3 className="text-sm font-semibold text-primary">No repositories yet</h3>
            <p className="mt-2 text-sm leading-6 text-secondary">{emptyRepositoryMessage(data.oauth.connected, hasInstallations)}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {data.repositories.repositories.map((repository) => (
              <DeveloperRepositoryRow
                key={repository.id}
                canManageRepositories={canManageRepositories}
                canRetry={canRetry}
                hasInstallations={hasInstallations}
                hasOAuth={data.oauth.connected}
                repository={repository}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DeveloperHeaderActions({
  state,
  installConfig
}: {
  state: GitHubInstallationsState;
  installConfig: GitHubAppInstallConfig;
}) {
  if (state.status !== "empty" && state.status !== "populated") {
    return (
      <button className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-secondary" type="button" disabled>
        Sync GitHub
      </button>
    );
  }

  const hasInstallations = state.data.settings.githubApp.installations.length > 0;
  const canManageInstallations = canManageRepositoryConfiguration(state.data.settings.workspace.role);

  return (
    <div className="flex flex-wrap items-start gap-2 sm:justify-end">
      <GitHubOAuthHeaderAction connected={state.data.oauth.connected} />
      <GitHubAppHeaderAction
        canManage={canManageInstallations}
        hasInstallations={hasInstallations}
        hasOAuth={state.data.oauth.connected}
        installConfig={installConfig}
      />
      <GitHubInstallationSyncButton
        compact
        disabled={!canSyncGitHub(state.data)}
        disabledReason={syncDisabledReason(state.data)}
      />
    </div>
  );
}

function GitHubOAuthHeaderAction({ connected }: { connected: boolean }) {
  if (!connected) {
    return (
      <a className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" href="/auth/github">
        Connect GitHub
      </a>
    );
  }

  return (
    <span className="inline-flex rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-success">
      GitHub connected
    </span>
  );
}

function GitHubAppHeaderAction({
  canManage,
  hasInstallations,
  hasOAuth,
  installConfig
}: {
  canManage: boolean;
  hasInstallations: boolean;
  hasOAuth: boolean;
  installConfig: GitHubAppInstallConfig;
}) {
  if (hasInstallations) {
    return (
      <span className="inline-flex rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-success">
        GitHub App installed
      </span>
    );
  }

  if (hasOAuth && canManage && installConfig.status === "configured" && isAllowedExternalDashboardUrl(installConfig.installUrl, "github")) {
    return (
      <a
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-primary shadow-sm hover:border-accent"
        data-dashboard-destination="external"
        data-dashboard-provider="github"
        href={installConfig.installUrl}
        rel="noreferrer"
      >
        GitHub App
      </a>
    );
  }

  return (
    <button
      className="rounded-md border border-border bg-subtle px-3 py-2 text-sm font-medium text-secondary"
      type="button"
      disabled
      title={
        !hasOAuth
          ? "Connect GitHub before installing the GitHub App."
          : !canManage
            ? "You do not have permission to install the GitHub App."
            : "Set GITHUB_APP_INSTALL_URL or GITHUB_APP_SLUG before installing the GitHub App."
      }
    >
      GitHub App
    </button>
  );
}

function emptyRepositoryMessage(hasOAuth: boolean, hasInstallations: boolean): string {
  if (!hasOAuth) {
    return "Connect GitHub to load repositories.";
  }

  if (!hasInstallations) {
    return "Install the GitHub App to add repositories.";
  }

  return "Sync GitHub to load repositories.";
}

function DeveloperRepositoryRow({
  canManageRepositories,
  canRetry,
  hasInstallations,
  hasOAuth,
  repository
}: {
  canManageRepositories: boolean;
  canRetry: boolean;
  hasInstallations: boolean;
  hasOAuth: boolean;
  repository: RepositoryListItem;
}) {
  const ready = hasOAuth && hasInstallations && repository.enabled;
  const syncDisabled = !hasOAuth || !canManageRepositories || !hasInstallations;

  return (
    <article className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm lg:grid-cols-[minmax(14rem,1.35fr)_minmax(12rem,1fr)_7rem_9rem_10rem_8rem] lg:items-center">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-primary">{repository.name}</h2>
        <p className="mt-1 truncate font-mono text-sm text-primary">{repository.fullName}</p>
        <p className="mt-1 text-xs text-secondary">{repository.private ? "Private" : "Public"} repository</p>
      </div>
      <div className="min-w-0">
        {repository.lastReview === null ? (
          <p className="text-sm text-secondary">No reviews run</p>
        ) : (
          <div>
            <p className="truncate text-sm font-medium text-primary">{repository.lastReview.pullRequestTitle}</p>
            <p className="mt-1 font-mono text-xs text-secondary">
              completed #{repository.lastReview.pullRequestNumber} · {shortSha(repository.lastReview.headSha)}
            </p>
          </div>
        )}
      </div>
      <ConnectionPill tone={ready ? "success" : "warning"}>{ready ? "Ready" : "Setup"}</ConnectionPill>
      <div>
        {canManageRepositories && hasOAuth && hasInstallations ? (
          <RepositoryAutomationToggle initialEnabled={repository.enabled} repositoryId={repository.id} />
        ) : (
          <span className="rounded-md border border-border bg-subtle px-2 py-1 text-xs font-medium text-secondary">
            {repository.enabled ? "Enabled" : "Disabled"}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-primary hover:border-accent"
          href={`/repositories/${encodeURIComponent(repository.id)}?tab=configuration`}
        >
          Edit
        </a>
        <GitHubRepositorySyncButton
          repositoryId={repository.id}
          disabled={syncDisabled}
          disabledReason={rowSyncDisabledReason({ hasOAuth, canManageRepositories, hasInstallations })}
        />
      </div>
      {repository.lastReview?.status === "failed" ? (
        <RetryReviewRunButton
          compact
          canRetry={canRetry && hasOAuth}
          reviewRunId={repository.lastReview.reviewRunId}
          status={repository.lastReview.status}
        />
      ) : (
        <a
          className="inline-flex w-fit rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-primary hover:border-accent"
          href={`/review-runs?repositoryId=${encodeURIComponent(repository.id)}`}
        >
          Run
        </a>
      )}
    </article>
  );
}

function ConnectionPill({ children, tone }: { children: React.ReactNode; tone: "success" | "warning" }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-medium ${
        tone === "success" ? "bg-green-50 text-success" : "bg-slate-100 text-secondary"
      }`}
    >
      {children}
    </span>
  );
}

function readOAuthConnected(state: GitHubInstallationsState): boolean {
  return (state.status === "empty" || state.status === "populated") && state.data.oauth.connected;
}

function canSyncGitHub(data: GitHubSyncDashboardData): boolean {
  return data.oauth.connected && canManageRepositoryConfiguration(data.settings.workspace.role) && data.settings.githubApp.installations.length > 0;
}

function syncDisabledReason(data: GitHubSyncDashboardData): string | undefined {
  return rowSyncDisabledReason({
    hasOAuth: data.oauth.connected,
    canManageRepositories: canManageRepositoryConfiguration(data.settings.workspace.role),
    hasInstallations: data.settings.githubApp.installations.length > 0
  });
}

function rowSyncDisabledReason(input: { hasOAuth: boolean; canManageRepositories: boolean; hasInstallations: boolean }): string | undefined {
  if (!input.hasOAuth) {
    return "Connect GitHub before syncing repositories.";
  }

  if (!input.canManageRepositories) {
    return "You do not have permission to manage repository automation.";
  }

  if (!input.hasInstallations) {
    return "Detect the installed GitHub App before syncing repositories.";
  }

  return undefined;
}
