import React from "react";
import {
  canManageRepositoryConfiguration,
  canRetryReviewRuns,
  type ReviewRunListItem
} from "@firmcode/shared";
import type { GitHubAppInstallConfig } from "../../config/github-app-installation";
import type { DeveloperPrReviewData, DeveloperPrReviewState } from "../../lib/dashboard-data";
import { isAllowedExternalDashboardUrl } from "../../lib/dashboard-route-readiness";
import { formatDateTime, formatDuration, shortSha } from "./format";
import { GitHubInstallationSyncButton } from "./github-sync-controls";
import { RetryReviewRunButton } from "./retry-review-run-button";
import { StatusBadge } from "./status-badge";

interface DeveloperPrReviewDashboardProps {
  state: DeveloperPrReviewState;
  installConfig: GitHubAppInstallConfig;
}

export function DeveloperPrReviewDashboard({ state, installConfig }: DeveloperPrReviewDashboardProps) {
  return (
    <div className="space-y-4">
      <DeveloperHeader state={state} installConfig={installConfig} />
      {state.status === "loading" ? <DeveloperLoadingState /> : null}
      {state.status === "signed-out" ? <DeveloperSignedOutState /> : null}
      {state.status === "error" ? <DeveloperErrorState message={state.message} /> : null}
      {state.status === "empty" ? <DeveloperContent data={state.data} /> : null}
      {state.status === "populated" ? <DeveloperContent data={state.data} /> : null}
    </div>
  );
}

function DeveloperHeader({
  state,
  installConfig
}: {
  state: DeveloperPrReviewState;
  installConfig: GitHubAppInstallConfig;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-primary">PR Review</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
          Track actual pull request review runs, statuses, and report details for this workspace.
        </p>
      </div>
      <DeveloperHeaderActions state={state} installConfig={installConfig} />
    </header>
  );
}

function DeveloperLoadingState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Loading developer PR review dashboard">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="h-24 rounded-md bg-subtle" />
        <div className="h-24 rounded-md bg-subtle" />
        <div className="h-24 rounded-md bg-subtle" />
        <div className="h-24 rounded-md bg-subtle" />
      </div>
      <div className="mt-4 h-24 rounded-md bg-subtle" />
      <div className="mt-4 grid gap-3">
        <div className="h-16 rounded-md bg-subtle" />
        <div className="h-16 rounded-md bg-subtle" />
        <div className="h-16 rounded-md bg-subtle" />
      </div>
    </section>
  );
}

function DeveloperSignedOutState() {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <h2 className="text-base font-semibold text-amber-900">Sign in is required</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-800">
        Firmcode needs an InsForge session before it can connect GitHub or load PR review history.
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

function DeveloperContent({ data }: { data: DeveloperPrReviewData }) {
  const hasInstallations = data.settings.githubApp.installations.length > 0;
  const canManageInstallations = canManageRepositoryConfiguration(data.settings.workspace.role);
  const canRetry = canRetryReviewRuns(data.settings.workspace.role);
  const reviewRuns = data.reviewRuns.reviewRuns;

  return (
    <div className="space-y-4">
      {!data.oauth.connected || !hasInstallations ? (
        <ReviewSetupCard
          canManageInstallations={canManageInstallations}
          hasInstallations={hasInstallations}
          hasOAuth={data.oauth.connected}
        />
      ) : null}
      <ReviewMetrics reviewRuns={reviewRuns} />
      <ReviewHistorySection
        canRetry={canRetry}
        hasInstallations={hasInstallations}
        hasOAuth={data.oauth.connected}
        reviewRuns={reviewRuns}
      />
    </div>
  );
}

function DeveloperHeaderActions({
  state,
  installConfig
}: {
  state: DeveloperPrReviewState;
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

function ReviewSetupCard({
  canManageInstallations,
  hasInstallations,
  hasOAuth
}: {
  canManageInstallations: boolean;
  hasInstallations: boolean;
  hasOAuth: boolean;
}) {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <h2 className="text-base font-semibold text-amber-900">PR review setup is incomplete</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-800">{setupMessage(hasOAuth, hasInstallations)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {!hasOAuth ? (
          <a className="inline-flex rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" href="/auth/github">
            Connect GitHub
          </a>
        ) : null}
        {hasOAuth && !hasInstallations && canManageInstallations ? (
          <a className="inline-flex rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900" href="/github/installations">
            Install GitHub App
          </a>
        ) : null}
        <a className="inline-flex rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900" href="/repositories">
          Open Repositories
        </a>
      </div>
    </section>
  );
}

function ReviewMetrics({ reviewRuns }: { reviewRuns: readonly ReviewRunListItem[] }) {
  const totalReviews = reviewRuns.length;
  const succeededReviews = reviewRuns.filter((run) => run.status === "succeeded").length;
  const failedReviews = reviewRuns.filter((run) => run.status === "failed").length;
  const manualRuns = reviewRuns.filter((run) => run.triggerEvent.includes("manual")).length;
  const successRate = totalReviews === 0 ? "0%" : `${Math.round((succeededReviews / totalReviews) * 100)}%`;

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="PR review metrics">
      <MetricCard label="Total PR reviews" value={String(totalReviews)} />
      <MetricCard label="Successful runs" value={String(succeededReviews)} />
      <MetricCard label="Failed runs" value={String(failedReviews)} />
      <MetricCard label="Success rate" value={successRate} />
      <MetricCard label="Manual runs" value={String(manualRuns)} />
      <MetricCard label="Latest activity" value={formatLatestActivity(reviewRuns)} />
      <MetricCard label="Latest findings" value={String(reviewRuns[0]?.findingsCount ?? 0)} />
      <MetricCard label="Latest comments" value={String(reviewRuns[0]?.commentsPostedCount ?? 0)} />
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-secondary">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold text-primary">{value}</p>
    </article>
  );
}

function ReviewHistorySection({
  canRetry,
  hasInstallations,
  hasOAuth,
  reviewRuns
}: {
  canRetry: boolean;
  hasInstallations: boolean;
  hasOAuth: boolean;
  reviewRuns: readonly ReviewRunListItem[];
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface" aria-label="Review run history">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-primary">Review Run History</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
          Actual PR reviews completed or queued for this workspace. Repository inventory remains on the Repositories page.
        </p>
      </div>
      {reviewRuns.length === 0 ? (
        <div className="p-6 text-center">
          <h3 className="text-sm font-semibold text-primary">No PR reviews yet</h3>
          <p className="mt-2 text-sm leading-6 text-secondary">{emptyReviewRunMessage(hasOAuth, hasInstallations)}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <a className="inline-flex rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-primary" href="/repositories">
              Open Repositories
            </a>
            <a className="inline-flex rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-primary" href="/review-runs">
              Open Review Runs
            </a>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-subtle text-left text-xs font-semibold uppercase text-secondary">
              <tr>
                <th className="px-4 py-3">Pull request</th>
                <th className="px-4 py-3">Repository</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date &amp; time</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reviewRuns.map((run) => (
                <ReviewRunRow key={run.id} canRetry={canRetry} run={run} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ReviewRunRow({ canRetry, run }: { canRetry: boolean; run: ReviewRunListItem }) {
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="min-w-0">
          <a className="font-medium text-accent" href={`/review-runs/${run.id}`}>
            PR #{run.pullRequestNumber}
          </a>
          <div className="mt-1 max-w-sm truncate text-sm text-primary">{run.pullRequestTitle}</div>
          <div className="mt-1 font-mono text-xs text-secondary">{shortSha(run.headSha)}</div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-primary">{run.repositoryFullName}</div>
        <div className="mt-1 text-xs text-secondary">@{run.pullRequestAuthor}</div>
      </td>
      <td className="px-4 py-3 text-primary">{formatTriggerLabel(run.triggerEvent)}</td>
      <td className="px-4 py-3">
        <StatusBadge status={run.status} />
      </td>
      <td className="px-4 py-3 text-secondary">{formatDateTime(run.startedAt ?? run.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="text-primary">{run.currentStage}</div>
        <div className="mt-1 text-xs text-secondary">
          {run.findingsCount} findings / {run.commentsPostedCount} comments / {formatDuration(run.durationMs)}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <a
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-primary hover:border-accent"
            href={`/review-runs/${run.id}`}
          >
            View report
          </a>
          <RetryReviewRunButton compact canRetry={canRetry} reviewRunId={run.id} status={run.status} />
        </div>
      </td>
    </tr>
  );
}

function canSyncGitHub(data: DeveloperPrReviewData): boolean {
  return data.oauth.connected && canManageRepositoryConfiguration(data.settings.workspace.role) && data.settings.githubApp.installations.length > 0;
}

function syncDisabledReason(data: DeveloperPrReviewData): string | undefined {
  return syncBlockedReason({
    hasOAuth: data.oauth.connected,
    canManageInstallations: canManageRepositoryConfiguration(data.settings.workspace.role),
    hasInstallations: data.settings.githubApp.installations.length > 0
  });
}

function syncBlockedReason(input: { hasOAuth: boolean; canManageInstallations: boolean; hasInstallations: boolean }): string | undefined {
  if (!input.hasOAuth) {
    return "Connect GitHub before syncing repositories.";
  }

  if (!input.canManageInstallations) {
    return "You do not have permission to manage repository automation.";
  }

  if (!input.hasInstallations) {
    return "Detect the installed GitHub App before syncing repositories.";
  }

  return undefined;
}

function setupMessage(hasOAuth: boolean, hasInstallations: boolean): string {
  if (!hasOAuth) {
    return "Connect your GitHub account before Firmcode can attribute or discover PR review activity for you.";
  }

  if (!hasInstallations) {
    return "Install the GitHub App and enable repository automation before PR reviews can start flowing into this workspace.";
  }

  return "Repository automation must be enabled before PR reviews can start flowing into this workspace.";
}

function emptyReviewRunMessage(hasOAuth: boolean, hasInstallations: boolean): string {
  if (!hasOAuth) {
    return "Connect GitHub first so Firmcode can start linking your PR review activity.";
  }

  if (!hasInstallations) {
    return "Install the GitHub App before expecting PR review runs here.";
  }

  return "Enable repository automation on the Repositories page, then new pull request events will create review runs here.";
}

function formatTriggerLabel(triggerEvent: string): string {
  return triggerEvent
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLatestActivity(reviewRuns: readonly ReviewRunListItem[]): string {
  if (reviewRuns.length === 0) {
    return "None yet";
  }

  return formatDateTime(reviewRuns[0]!.startedAt ?? reviewRuns[0]!.createdAt);
}
