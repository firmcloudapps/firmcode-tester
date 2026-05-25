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
import { formatDateTime, shortSha } from "./format";
import { GitHubInstallationSyncButton, GitHubRepositorySyncButton } from "./github-sync-controls";
import { RepositoryAutomationToggle } from "./repository-automation-toggle";
import { RetryReviewRunButton } from "./retry-review-run-button";
import { BooleanBadge, StatusBadge } from "./status-badge";

interface GitHubInstallationsViewProps {
  state: GitHubInstallationsState;
  installConfig: GitHubAppInstallConfig;
}

export function GitHubInstallationsView({ state, installConfig }: GitHubInstallationsViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">PR Review</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">PR Review</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
            Connect GitHub, verify the Firmcode GitHub App, and manage repository review automation from one workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {state.status === "empty" || state.status === "populated" ? (
            <GitHubInstallationSyncButton
              disabled={!canSyncGitHub(state.data)}
              disabledReason={syncDisabledReason(state.data)}
            />
          ) : (
            <button
              className="rounded-md border border-border bg-subtle px-3 py-2 text-sm font-medium text-secondary"
              type="button"
              disabled
              title="GitHub connection status must load before syncing."
            >
              Sync GitHub
            </button>
          )}
          <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href="/settings?tab=github-app">
            GitHub App settings
          </a>
        </div>
      </div>

      <ProviderTabs />

      {state.status === "loading" ? <InstallLoadingState /> : null}
      {state.status === "signed-out" ? <SignedOutState installConfig={installConfig} /> : null}
      {state.status === "error" ? <InstallErrorState message={state.message} /> : null}
      {state.status === "empty" ? <InstallContent data={state.data} installConfig={installConfig} /> : null}
      {state.status === "populated" ? <InstallContent data={state.data} installConfig={installConfig} /> : null}
    </div>
  );
}

function ProviderTabs() {
  return (
    <nav className="overflow-x-auto rounded-lg border border-border bg-surface p-1" aria-label="Review providers">
      <div className="flex min-w-max gap-1">
        <span className="rounded-md bg-blush px-3 py-2 text-sm font-medium text-accent" aria-current="page">
          GitHub
        </span>
        {["GitLab", "Bitbucket", "Azure DevOps"].map((provider) => (
          <span
            key={provider}
            className="cursor-not-allowed rounded-md px-3 py-2 text-sm font-medium text-secondary opacity-55"
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

function InstallLoadingState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Loading GitHub installation status">
      <div className="h-5 w-64 rounded bg-subtle" />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="h-44 rounded-md bg-subtle" />
        <div className="h-44 rounded-md bg-subtle" />
      </div>
      <div className="mt-4 h-56 rounded-md bg-subtle" />
    </section>
  );
}

function SignedOutState({ installConfig }: { installConfig: GitHubAppInstallConfig }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-base font-semibold text-amber-900">Sign in is required</h2>
        <p className="mt-2 text-sm leading-6 text-amber-800">
          Firmcode needs a Clerk workspace session before it can connect a GitHub account or map a GitHub App installation.
        </p>
        <button
          className="mt-4 rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-secondary"
          type="button"
          disabled
          title="Sign in before connecting GitHub."
        >
          Connect GitHub
        </button>
      </section>
      <InstallConfigPanel installConfig={installConfig} />
    </div>
  );
}

function InstallErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-5">
      <h2 className="text-base font-semibold text-red-800">GitHub status could not be loaded</h2>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
      <a className="mt-4 inline-flex rounded-md bg-white px-3 py-2 text-sm font-medium text-red-800" href="/github/installations">
        Retry status check
      </a>
    </section>
  );
}

function InstallContent({
  data,
  installConfig
}: {
  data: GitHubSyncDashboardData;
  installConfig: GitHubAppInstallConfig;
}) {
  const { settings, oauth, repositories } = data;
  const canManageInstallations = canManageRepositoryConfiguration(settings.workspace.role);
  const hasInstallations = settings.githubApp.installations.length > 0;
  const canManageRepositories = canManageRepositoryConfiguration(settings.workspace.role);
  const canRetry = canRetryReviewRuns(settings.workspace.role);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 lg:grid-cols-2" aria-label="GitHub connection status">
        <GitHubOAuthCard connected={oauth.connected} user={oauth.user} />
        <GitHubAppCard
          canManage={canManageInstallations}
          hasOAuth={oauth.connected}
          installConfig={installConfig}
          installations={settings.githubApp.installations}
        />
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-primary">Repository automation</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
              Repositories are matched by exact owner/repo name and reviewed through the Firmcode GitHub App.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-secondary">
            {settings.workspace.role.charAt(0).toUpperCase() + settings.workspace.role.slice(1)}
          </span>
        </div>
        {repositories.repositories.length === 0 ? (
          <p className="mt-4 rounded-md border border-border bg-subtle p-3 text-sm leading-6 text-secondary">
            No repositories are synced yet. Connect GitHub OAuth, install the GitHub App, then sync GitHub to populate repository automation rows.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-border overflow-hidden rounded-md border border-border">
            {repositories.repositories.map((repository) => (
              <RepositoryAutomationRow
                key={repository.id}
                canManageRepositories={canManageRepositories}
                canRetry={canRetry}
                hasInstallations={hasInstallations}
                hasOAuth={oauth.connected}
                repository={repository}
              />
            ))}
          </div>
        )}
      </section>

      <InstallConfigPanel installConfig={installConfig} />
    </div>
  );
}

function GitHubOAuthCard({
  connected,
  user
}: {
  connected: boolean;
  user: GitHubSyncDashboardData["oauth"]["user"];
}) {
  return (
    <article className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-primary">GitHub account</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Required for every signed-in user before GitHub-backed dashboard workflows become available.
          </p>
        </div>
        <ConnectionPill tone={connected ? "success" : "warning"}>{connected ? "Connected" : "Required"}</ConnectionPill>
      </div>
      {connected && user !== null ? (
        <div className="mt-4 flex items-center gap-3 rounded-md border border-border bg-subtle p-3">
          {user.avatarUrl === null ? null : <img alt="" className="h-9 w-9 rounded-md" src={user.avatarUrl} />}
          <div>
            <p className="font-medium text-primary">@{user.login}</p>
            <p className="text-xs text-secondary">Connected {formatDateTime(user.connectedAt)}</p>
          </div>
        </div>
      ) : (
        <a className="mt-4 inline-flex rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" href="/auth/github">
          Connect GitHub
        </a>
      )}
    </article>
  );
}

function GitHubAppCard({
  canManage,
  hasOAuth,
  installConfig,
  installations
}: {
  canManage: boolean;
  hasOAuth: boolean;
  installConfig: GitHubAppInstallConfig;
  installations: readonly WorkspaceSettingsInstallation[];
}) {
  const hasInstallations = installations.length > 0;

  return (
    <article className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-primary">Firmcode GitHub App</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Developers and Admins install or manage repository access after their GitHub account is connected.
          </p>
        </div>
        <ConnectionPill tone={hasInstallations ? "success" : "warning"}>{hasInstallations ? "Installed" : "Missing"}</ConnectionPill>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <InstallAction canManage={canManage} hasOAuth={hasOAuth} installConfig={installConfig} />
        <GitHubInstallationSyncButton
          compact
          disabled={!hasOAuth || !canManage || !hasInstallations}
          disabledReason={installationSyncDisabledReason({ hasOAuth, canManage, hasInstallations })}
        />
      </div>
      <div className="mt-4 grid gap-3">
        {hasInstallations ? (
          installations.map((installation) => <InstallationCard key={installation.id} installation={installation} />)
        ) : (
          <p className="rounded-md border border-border bg-subtle p-3 text-sm leading-6 text-secondary">
            No installation is mapped to this workspace yet.
          </p>
        )}
      </div>
    </article>
  );
}

function InstallAction({
  canManage,
  hasOAuth,
  installConfig
}: {
  canManage: boolean;
  hasOAuth: boolean;
  installConfig: GitHubAppInstallConfig;
}) {
  if (!hasOAuth) {
    return (
      <button
        className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-secondary"
        type="button"
        disabled
        title="Connect GitHub OAuth before installing the GitHub App."
      >
        Connect GitHub first
      </button>
    );
  }

  if (!canManage) {
    return (
      <button
        className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-secondary"
        type="button"
        disabled
        title="Developer or Admin required to install the GitHub App."
      >
        Developer or Admin required
      </button>
    );
  }

  if (installConfig.status !== "configured") {
    return (
      <button
        className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-secondary"
        type="button"
        disabled
        title="Set GITHUB_APP_INSTALL_URL or GITHUB_APP_SLUG before installing the GitHub App."
      >
        Install URL not configured
      </button>
    );
  }

  if (isAllowedExternalDashboardUrl(installConfig.installUrl, "github")) {
    return (
      <a
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
        data-dashboard-destination="external"
        data-dashboard-provider="github"
        href={installConfig.installUrl}
        rel="noreferrer"
      >
        Install GitHub App
      </a>
    );
  }

  return (
    <button
      className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-secondary"
      type="button"
      disabled
      title="GitHub App install URL must be an external GitHub URL."
    >
      Install GitHub App
    </button>
  );
}

function RepositoryAutomationRow({
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
    <article className="grid gap-3 bg-surface p-4 lg:grid-cols-[minmax(13rem,1.5fr)_9rem_10rem_minmax(12rem,1fr)_13rem] lg:items-center">
      <div className="min-w-0">
        <h3 className="truncate font-medium text-primary">{repository.name}</h3>
        <p className="mt-1 truncate font-mono text-xs text-secondary">{repository.fullName}</p>
        <p className="mt-1 text-xs text-secondary">{repository.private ? "Private" : "Public"} repository</p>
      </div>
      <div className="space-y-1">
        <ConnectionPill tone={ready ? "success" : "warning"}>{repositoryReadiness({ hasOAuth, hasInstallations, repository })}</ConnectionPill>
        <BooleanBadge enabled={repository.enabled} />
      </div>
      <div>
        {canManageRepositories && hasOAuth && hasInstallations ? (
          <RepositoryAutomationToggle initialEnabled={repository.enabled} repositoryId={repository.id} />
        ) : (
          <button
            className="rounded-md border border-border bg-subtle px-2 py-1 text-xs font-medium text-secondary"
            disabled
            type="button"
            title={rowSyncDisabledReason({ hasOAuth, canManageRepositories, hasInstallations }) ?? "Repository automation is unavailable."}
          >
            {repository.enabled ? "Enabled" : "Disabled"}
          </button>
        )}
      </div>
      <div>
        {repository.lastReview === null ? (
          <p className="text-sm text-secondary">No review yet</p>
        ) : (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <a className="font-medium text-accent" href={`/review-runs/${repository.lastReview.reviewRunId}`}>
                PR #{repository.lastReview.pullRequestNumber}
              </a>
              <StatusBadge status={repository.lastReview.status} />
            </div>
            <p className="font-mono text-xs text-secondary">
              {shortSha(repository.lastReview.headSha)} · {formatDateTime(repository.lastReview.createdAt)}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="cursor-not-allowed rounded-md border border-border bg-subtle px-2 py-1 text-xs font-medium text-secondary opacity-70"
          type="button"
          disabled
          title="Repository detail configuration is planned"
        >
          Configure
        </button>
        <GitHubRepositorySyncButton repositoryId={repository.id} disabled={syncDisabled} disabledReason={rowSyncDisabledReason({ hasOAuth, canManageRepositories, hasInstallations })} />
        {repository.lastReview?.status === "failed" ? (
          <RetryReviewRunButton
            compact
            canRetry={canRetry && hasOAuth}
            reviewRunId={repository.lastReview.reviewRunId}
            status={repository.lastReview.status}
          />
        ) : (
          <button
            className="cursor-not-allowed rounded-md border border-border bg-subtle px-2 py-1 text-xs font-medium text-secondary opacity-70"
            type="button"
            disabled
            title="Manual review runs are planned"
          >
            Run
          </button>
        )}
      </div>
    </article>
  );
}

function InstallationCard({ installation }: { installation: WorkspaceSettingsInstallation }) {
  return (
    <article className="rounded-md border border-border bg-subtle p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-medium text-primary">{installation.accountLogin ?? `Installation ${installation.installationId}`}</h3>
          <p className="mt-1 text-sm text-secondary">
            {installation.enabledRepositoryCount} of {installation.repositoryCount} repositories have review automation enabled.
          </p>
          <p className="mt-1 font-mono text-xs text-secondary">installation:{installation.installationId}</p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-success">
          {installation.accountType ?? "GitHub"} connected
        </span>
      </div>
      <p className="mt-3 text-xs text-secondary">Updated {formatDateTime(installation.updatedAt)}</p>
    </article>
  );
}

function InstallConfigPanel({ installConfig }: { installConfig: GitHubAppInstallConfig }) {
  if (installConfig.status === "configured") {
    return (
      <aside className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-primary">Configured install URL</h2>
        <p className="mt-2 text-sm leading-6 text-secondary">
          Firmcode sends workspace admins to the GitHub-hosted App installation page and keeps server credentials hidden.
        </p>
        <p className="mt-4 break-all rounded-md border border-border bg-subtle p-3 font-mono text-xs text-secondary">
          {installConfig.installUrl}
        </p>
        <p className="mt-3 text-xs text-secondary">Source: {installConfig.source}</p>
      </aside>
    );
  }

  if (installConfig.status === "invalid") {
    return (
      <aside className="rounded-lg border border-red-200 bg-red-50 p-5">
        <h2 className="text-base font-semibold text-red-800">Install config is invalid</h2>
        <p className="mt-2 text-sm leading-6 text-red-700">
          {installConfig.variable} {installConfig.message}.
        </p>
        <p className="mt-3 text-sm leading-6 text-red-700">
          Update the web environment with a GitHub App install URL or slug, then restart Next.js.
        </p>
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <h2 className="text-base font-semibold text-amber-900">Missing GitHub App install config</h2>
      <p className="mt-2 text-sm leading-6 text-amber-800">
        Set <span className="font-mono">GITHUB_APP_INSTALL_URL</span> or <span className="font-mono">GITHUB_APP_SLUG</span> in the web environment, then restart Next.js.
      </p>
      <p className="mt-3 text-sm leading-6 text-amber-800">
        API-side GitHub App credentials remain server-only and are not displayed in the dashboard.
      </p>
    </aside>
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

function canSyncGitHub(data: GitHubSyncDashboardData): boolean {
  return data.oauth.connected && canManageRepositoryConfiguration(data.settings.workspace.role) && data.settings.githubApp.installations.length > 0;
}

function syncDisabledReason(data: GitHubSyncDashboardData): string | undefined {
  return installationSyncDisabledReason({
    hasOAuth: data.oauth.connected,
    canManage: canManageRepositoryConfiguration(data.settings.workspace.role),
    hasInstallations: data.settings.githubApp.installations.length > 0
  });
}

function installationSyncDisabledReason(input: { hasOAuth: boolean; canManage: boolean; hasInstallations: boolean }): string | undefined {
  if (!input.hasOAuth) {
    return "Connect GitHub OAuth before syncing repositories.";
  }

  if (!input.canManage) {
    return "Developer or Admin required to sync GitHub installations.";
  }

  if (!input.hasInstallations) {
    return "Install the GitHub App before syncing repositories.";
  }

  return undefined;
}

function rowSyncDisabledReason(input: { hasOAuth: boolean; canManageRepositories: boolean; hasInstallations: boolean }): string | undefined {
  if (!input.hasOAuth) {
    return "Connect GitHub first.";
  }

  if (!input.canManageRepositories) {
    return "Developer or Admin required.";
  }

  if (!input.hasInstallations) {
    return "GitHub App required.";
  }

  return undefined;
}

function repositoryReadiness(input: {
  hasOAuth: boolean;
  hasInstallations: boolean;
  repository: RepositoryListItem;
}): string {
  if (!input.hasOAuth) {
    return "Needs account";
  }

  if (!input.hasInstallations) {
    return "Needs app";
  }

  return input.repository.enabled ? "Ready" : "Disabled";
}
