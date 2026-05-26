import React from "react";
import {
  canManageRepositoryConfiguration,
  canRetryReviewRuns,
  type RepositoryListItem,
  type WorkspaceSettingsInstallation
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
    <div className="min-h-screen bg-shell text-primary" data-clerk-authenticated="required" data-dashboard-role="developer">
      <div className="flex min-h-screen">
        <DeveloperSidebar oauthConnected={readOAuthConnected(state)} />
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-4">
            <DeveloperHeader state={state} />
            <ProviderTabs />
            {state.status === "loading" ? <DeveloperLoadingState /> : null}
            {state.status === "signed-out" ? <DeveloperSignedOutState /> : null}
            {state.status === "error" ? <DeveloperErrorState message={state.message} /> : null}
            {state.status === "empty" ? <DeveloperContent data={state.data} installConfig={installConfig} /> : null}
            {state.status === "populated" ? <DeveloperContent data={state.data} installConfig={installConfig} /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function DeveloperSidebar({ oauthConnected }: { oauthConnected: boolean }) {
  const plannerLinks = [
    ["Overview", "/dashboard"],
    ["Projects", "/repositories"],
    ["New Plan", "/repositories"],
    ["Enhance Repo", "/findings"]
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
      <nav className="flex-1 space-y-6 p-4" aria-label="Developer dashboard">
        <DeveloperNavGroup title="Planner" items={plannerLinks} />
        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">PR Review</p>
          <a
            className="mt-2 flex items-center justify-between rounded-md border border-border bg-blush px-3 py-2 text-sm font-semibold text-accent"
            href="/dashboard/developer"
            aria-current="page"
          >
            Code Review
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
          </a>
        </div>
        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">Connections</p>
          <a className="mt-2 flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-secondary hover:bg-subtle hover:text-primary" href="/auth/github">
            GitHub OAuth
            <span className={`h-2 w-2 rounded-full ${oauthConnected ? "bg-success" : "bg-warning"}`} aria-hidden="true" />
          </a>
        </div>
      </nav>
      <div className="border-t border-border p-4">
        <a className="block rounded-md px-3 py-2 text-sm font-medium text-secondary hover:bg-subtle hover:text-primary" href="/billing">
          Pricing
        </a>
        <a className="block rounded-md px-3 py-2 text-sm font-medium text-secondary hover:bg-subtle hover:text-primary" href="/settings">
          Settings
        </a>
        <div className="mt-3 rounded-md border border-border bg-shell p-3">
          <p className="text-sm font-semibold text-primary">Developer</p>
          <p className="mt-1 text-xs text-secondary">PR review workspace</p>
        </div>
      </div>
    </aside>
  );
}

function DeveloperNavGroup({ title, items }: { title: string; items: readonly (readonly [string, string])[] }) {
  return (
    <div>
      <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary">{title}</p>
      <div className="mt-2 grid gap-1">
        {items.map(([label, href]) => (
          <a key={label} className="rounded-md px-3 py-2 text-sm font-medium text-secondary hover:bg-subtle hover:text-primary" href={href}>
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}

function DeveloperHeader({ state }: { state: GitHubInstallationsState }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium text-accent">Developer dashboard</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">PR Review</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
          Automatically review new pull requests, run analysis on demand, and keep repository automation ready.
        </p>
      </div>
      {state.status === "empty" || state.status === "populated" ? (
        <GitHubInstallationSyncButton
          label="Refresh"
          disabled={!canSyncGitHub(state.data)}
          disabledReason={syncDisabledReason(state.data)}
        />
      ) : (
        <button className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-secondary" type="button" disabled>
          Refresh
        </button>
      )}
    </header>
  );
}

function ProviderTabs() {
  return (
    <nav className="overflow-x-auto" aria-label="Review providers">
      <div className="flex min-w-max gap-2">
        <span className="rounded-md border border-accent bg-blush px-3 py-2 text-sm font-semibold text-accent" aria-current="page">
          GitHub
        </span>
        {["GitLab - Coming soon", "Bitbucket - Coming soon", "Azure DevOps - Coming soon"].map((provider) => (
          <span
            key={provider}
            className="cursor-not-allowed rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-secondary"
            aria-disabled="true"
            title="Planned provider"
          >
            {provider}
          </span>
        ))}
      </div>
    </nav>
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

function DeveloperContent({
  data,
  installConfig
}: {
  data: GitHubSyncDashboardData;
  installConfig: GitHubAppInstallConfig;
}) {
  const hasInstallations = data.settings.githubApp.installations.length > 0;
  const canManageRepositories = canManageRepositoryConfiguration(data.settings.workspace.role);
  const canRetry = canRetryReviewRuns(data.settings.workspace.role);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 lg:grid-cols-2" aria-label="GitHub connection status">
        <OAuthSetupCard data={data} />
        <GitHubAppSetupCard data={data} installConfig={installConfig} />
      </section>
      <section className="space-y-3" aria-label="Developer repository review queue">
        {data.repositories.repositories.length === 0 ? (
          <article className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-primary">No repositories synced yet</h2>
            <p className="mt-2 text-sm leading-6 text-secondary">
              Connect GitHub OAuth, install the GitHub App, then refresh repository metadata to start review automation.
            </p>
          </article>
        ) : (
          data.repositories.repositories.map((repository) => (
            <DeveloperRepositoryRow
              key={repository.id}
              canManageRepositories={canManageRepositories}
              canRetry={canRetry}
              hasInstallations={hasInstallations}
              hasOAuth={data.oauth.connected}
              repository={repository}
            />
          ))
        )}
      </section>
      <p className="text-sm leading-6 text-secondary">
        Tip: a project is reviewed only when its repository matches owner/repo exactly.
      </p>
    </div>
  );
}

function OAuthSetupCard({ data }: { data: GitHubSyncDashboardData }) {
  const connected = data.oauth.connected;

  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-primary">GitHub OAuth</h2>
          <p className="mt-1 text-sm leading-6 text-secondary">Used for importing and analyzing repositories.</p>
        </div>
        <ConnectionPill tone={connected ? "success" : "warning"}>{connected ? "Connected" : "Required"}</ConnectionPill>
      </div>
      {connected && data.oauth.user !== null ? (
        <p className="mt-4 text-sm text-secondary">
          Connected as <span className="font-medium text-primary">@{data.oauth.user.login}</span>
        </p>
      ) : (
        <a className="mt-4 inline-flex rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" href="/auth/github">
          Connect GitHub
        </a>
      )}
    </article>
  );
}

function GitHubAppSetupCard({
  data,
  installConfig
}: {
  data: GitHubSyncDashboardData;
  installConfig: GitHubAppInstallConfig;
}) {
  const installations = data.settings.githubApp.installations;
  const installed = installations.length > 0;
  const canInstall = data.oauth.connected && installConfig.status === "configured" && isAllowedExternalDashboardUrl(installConfig.installUrl, "github");

  return (
    <article className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-primary">Firmcode GitHub App</h2>
          <p className="mt-1 text-sm leading-6 text-secondary">Required for automatic PR review.</p>
        </div>
        <ConnectionPill tone={installed ? "success" : "warning"}>{installed ? "Installed" : "Missing"}</ConnectionPill>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {canInstall ? (
          <a
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
            data-dashboard-destination="external"
            data-dashboard-provider="github"
            href={installConfig.installUrl}
            rel="noreferrer"
          >
            Add Repo
          </a>
        ) : (
          <button
            className="rounded-md bg-subtle px-3 py-2 text-sm font-medium text-secondary"
            type="button"
            disabled
            title={data.oauth.connected ? "GitHub App install URL is not configured." : "Connect GitHub OAuth before adding repositories."}
          >
            Add Repo
          </button>
        )}
        {installed ? <InstallationSummary installations={installations} /> : null}
      </div>
    </article>
  );
}

function InstallationSummary({ installations }: { installations: readonly WorkspaceSettingsInstallation[] }) {
  const repositoryCount = installations.reduce((total, installation) => total + installation.repositoryCount, 0);

  return <span className="rounded-md border border-border bg-subtle px-3 py-2 text-sm text-secondary">{repositoryCount} repositories available</span>;
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
        tone === "success" ? "bg-green-50 text-success" : "bg-amber-50 text-amber-800"
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
    return "Connect GitHub OAuth before syncing repositories.";
  }

  if (!input.canManageRepositories) {
    return "Developer or Admin required to manage repository automation.";
  }

  if (!input.hasInstallations) {
    return "Install the GitHub App before syncing repositories.";
  }

  return undefined;
}
