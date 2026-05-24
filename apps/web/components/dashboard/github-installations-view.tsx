import React from "react";
import type { WorkspaceSettingsInstallation, WorkspaceSettingsResponse } from "@firmcode/shared";
import type { GitHubAppInstallConfig } from "../../config/github-app-installation";
import type { GitHubInstallationsState } from "../../lib/dashboard-data";
import { formatDateTime } from "./format";

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
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">GitHub App installation</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
            Connect the Firmcode GitHub App, confirm workspace mapping, and return here when GitHub sends the installation event.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href="/github/installations">
            Retry status check
          </a>
          <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href="/settings?tab=github-app">
            GitHub App settings
          </a>
        </div>
      </div>

      {state.status === "loading" ? <InstallLoadingState /> : null}
      {state.status === "signed-out" ? <SignedOutState installConfig={installConfig} /> : null}
      {state.status === "error" ? <InstallErrorState message={state.message} /> : null}
      {state.status === "empty" ? <InstallContent data={state.data} installConfig={installConfig} /> : null}
      {state.status === "populated" ? <InstallContent data={state.data} installConfig={installConfig} /> : null}
    </div>
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
    </section>
  );
}

function SignedOutState({ installConfig }: { installConfig: GitHubAppInstallConfig }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-base font-semibold text-amber-900">Sign in is required</h2>
        <p className="mt-2 text-sm leading-6 text-amber-800">
          Firmcode needs a Clerk workspace session before it can map a GitHub App installation to the correct workspace.
        </p>
        <button className="mt-4 rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-secondary" type="button" disabled>
          Install GitHub App
        </button>
      </section>
      <InstallConfigPanel installConfig={installConfig} />
    </div>
  );
}

function InstallErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-5">
      <h2 className="text-base font-semibold text-red-800">Installation status could not be loaded</h2>
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
  data: WorkspaceSettingsResponse;
  installConfig: GitHubAppInstallConfig;
}) {
  const canManage = data.workspace.canManageSensitiveSettings;
  const hasInstallations = data.githubApp.installations.length > 0;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-primary">Current setup status</h2>
              <p className="mt-2 text-sm leading-6 text-secondary">
                Workspace <span className="font-medium text-primary">{data.workspace.name}</span> is signed in as{" "}
                <span className="font-medium text-primary">{formatRole(data.workspace.role)}</span>.
              </p>
            </div>
            <span
              className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-medium ${
                hasInstallations ? "bg-green-50 text-success" : "bg-amber-50 text-amber-800"
              }`}
            >
              {hasInstallations ? "Installation mapped" : "No installation mapped"}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <InstallAction canManage={canManage} installConfig={installConfig} />
            <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href="/repositories">
              View repositories
            </a>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-base font-semibold text-primary">Installation instructions</h2>
          <ol className="mt-4 grid gap-3 text-sm leading-6 text-secondary">
            <li className="rounded-md border border-border bg-subtle p-3">
              <span className="font-medium text-primary">1. Open the GitHub App install URL.</span> Choose the GitHub account or organization that owns the repositories Firmcode should review.
            </li>
            <li className="rounded-md border border-border bg-subtle p-3">
              <span className="font-medium text-primary">2. Select repositories.</span> Install on selected repositories for least privilege, then expand access only when needed.
            </li>
            <li className="rounded-md border border-border bg-subtle p-3">
              <span className="font-medium text-primary">3. Return to Firmcode.</span> Retry the status check after the installation event or callback has reached the API.
            </li>
          </ol>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-base font-semibold text-primary">Mapped installations</h2>
          {hasInstallations ? (
            <div className="mt-4 grid gap-3">
              {data.githubApp.installations.map((installation) => (
                <InstallationCard key={installation.id} installation={installation} />
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-md border border-border bg-subtle p-3 text-sm leading-6 text-secondary">
              No installation is mapped to this workspace yet. Install the GitHub App, then retry the status check once the webhook has been delivered.
            </p>
          )}
        </section>
      </div>

      <InstallConfigPanel installConfig={installConfig} />
    </div>
  );
}

function InstallAction({
  canManage,
  installConfig
}: {
  canManage: boolean;
  installConfig: GitHubAppInstallConfig;
}) {
  if (!canManage) {
    return (
      <button className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-secondary" type="button" disabled>
        Owner or Admin required
      </button>
    );
  }

  if (installConfig.status !== "configured") {
    return (
      <button className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-secondary" type="button" disabled>
        Install URL not configured
      </button>
    );
  }

  return (
    <a className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" href={installConfig.installUrl} rel="noreferrer">
      Install GitHub App
    </a>
  );
}

function InstallConfigPanel({ installConfig }: { installConfig: GitHubAppInstallConfig }) {
  if (installConfig.status === "configured") {
    return (
      <aside className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-primary">Configured install URL</h2>
        <p className="mt-2 text-sm leading-6 text-secondary">
          Firmcode will send workspace admins to the GitHub-hosted App installation page.
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

function InstallationCard({ installation }: { installation: WorkspaceSettingsInstallation }) {
  return (
    <article className="rounded-md border border-border bg-subtle p-4">
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

function formatRole(role: WorkspaceSettingsResponse["workspace"]["role"]): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "developer":
      return "Developer";
    case "viewer":
      return "Viewer";
  }
}
