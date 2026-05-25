import React from "react";
import type { RepositoryDetailResponse } from "@firmcode/shared";
import type { ViewState } from "../../lib/view-state";
import { BooleanBadge, SeverityBadge, StatusBadge } from "./status-badge";
import { formatDateTime, shortSha } from "./format";
import { RepositoryAutomationToggle } from "./repository-automation-toggle";
import { ManualCodebaseScanButton } from "./manual-codebase-scan-button";
import { RepositoryConfigurationForm } from "./repository-configuration-form";

interface RepositoryDetailViewProps {
  state: ViewState<RepositoryDetailResponse>;
  activeTab: RepositoryDetailTab;
}

export type RepositoryDetailTab = "overview" | "pull-requests" | "findings" | "scans" | "configuration" | "activity";

const tabs: Array<{ id: RepositoryDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "pull-requests", label: "Pull Requests" },
  { id: "findings", label: "Findings" },
  { id: "scans", label: "Scans" },
  { id: "configuration", label: "Configuration" },
  { id: "activity", label: "Activity" }
];

export function RepositoryDetailView({ state, activeTab }: RepositoryDetailViewProps) {
  if (state.status === "loading") {
    return <RepositoryDetailLoadingState />;
  }

  if (state.status === "empty") {
    return <RepositoryDetailEmptyState />;
  }

  if (state.status === "error") {
    return <RepositoryDetailErrorState message={state.message} />;
  }

  const { data } = state;

  return (
    <div className="space-y-4">
      <RepositoryDetailHeader data={data} />
      <RepositoryTabs repositoryId={data.repository.id} activeTab={activeTab} />
      {activeTab === "overview" ? <OverviewTab data={data} /> : null}
      {activeTab === "pull-requests" ? <PullRequestsTab data={data} /> : null}
      {activeTab === "findings" ? <FindingsTab data={data} /> : null}
      {activeTab === "scans" ? <ScansTab data={data} /> : null}
      {activeTab === "configuration" ? <ConfigurationTab data={data} /> : null}
      {activeTab === "activity" ? <ActivityTab data={data} /> : null}
    </div>
  );
}

export function parseRepositoryDetailTab(value: string | string[] | undefined): RepositoryDetailTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return tabs.some((tab) => tab.id === candidate) ? (candidate as RepositoryDetailTab) : "overview";
}

function RepositoryDetailHeader({ data }: { data: RepositoryDetailResponse }) {
  const { repository } = data;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium text-accent">Repository</p>
        <h1 className="mt-1 break-words text-2xl font-semibold tracking-normal text-primary">{repository.fullName}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
          Default branch {repository.defaultBranch}. {repository.private ? "Private" : "Public"} repository.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <BooleanBadge enabled={repository.enabled} />
        <span className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-secondary">
          {repository.primaryLanguage ?? "Language pending"}
        </span>
      </div>
    </div>
  );
}

function RepositoryTabs({ repositoryId, activeTab }: { repositoryId: string; activeTab: RepositoryDetailTab }) {
  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-border" aria-label="Repository detail tabs">
      {tabs.map((tab) => (
        <a
          key={tab.id}
          className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
            activeTab === tab.id
              ? "border-accent text-primary"
              : "border-transparent text-secondary hover:border-border hover:text-primary"
          }`}
          href={`/repositories/${encodeURIComponent(repositoryId)}?tab=${tab.id}`}
          aria-current={activeTab === tab.id ? "page" : undefined}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}

function OverviewTab({ data }: { data: RepositoryDetailResponse }) {
  const latestRun = data.reviewRuns[0] ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Metric label="Open findings" value={String(data.repository.openFindingsCount)} helper="Active review findings" />
      <Metric label="Codebase findings" value={String(data.repository.openCodebaseFindingsCount ?? 0)} helper="Open background scan findings" />
      <Metric
        label="Latest scan"
        value={data.repository.codebaseScan?.latestScanStatus ?? "none"}
        helper={formatDateTime(data.repository.codebaseScan?.latestScanFinishedAt ?? data.repository.codebaseScan?.latestScanCreatedAt ?? null)}
      />
      <Metric label="Pull requests" value={String(data.pullRequests.length)} helper="Tracked by webhooks" />
      <Metric label="Review runs" value={String(data.reviewRuns.length)} helper="Recent review executions" />
      <section className="rounded-lg border border-border bg-surface p-4 lg:col-span-2">
        <h2 className="text-sm font-semibold text-primary">Latest review</h2>
        {latestRun === null ? (
          <p className="mt-3 text-sm leading-6 text-secondary">No review runs have been recorded for this repository.</p>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <a className="font-medium text-accent" href={`/review-runs/${latestRun.id}`}>
                PR #{latestRun.pullRequestNumber}
              </a>
              <StatusBadge status={latestRun.status} />
            </div>
            <p className="text-primary">{latestRun.pullRequestTitle}</p>
            <p className="font-mono text-xs text-secondary">
              {shortSha(latestRun.headSha)} / {formatDateTime(latestRun.createdAt)}
            </p>
          </div>
        )}
      </section>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-primary">Configuration summary</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <KeyValue label="Severity threshold" value={data.configuration.severityThreshold} />
          <KeyValue label="Codebase scans" value={(data.configuration.codebaseScanEnabled ?? true) ? "Enabled" : "Disabled"} />
          <KeyValue label="Scan cadence" value={`${data.configuration.codebaseScanCadenceHours ?? 24}h`} />
          <KeyValue label="Max inline comments" value={String(data.configuration.maxInlineComments)} />
          <KeyValue label="Dry run" value={data.configuration.dryRunEnabled ? "Enabled" : "Disabled"} />
        </dl>
      </section>
    </div>
  );
}

function PullRequestsTab({ data }: { data: RepositoryDetailResponse }) {
  if (data.pullRequests.length === 0) {
    return <EmptyPanel title="No pull requests yet" body="Firmcode has not seen pull request webhook activity for this repository." />;
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-subtle text-left text-xs font-semibold uppercase text-secondary">
          <tr>
            <th className="px-4 py-3">Pull request</th>
            <th className="px-4 py-3">Author</th>
            <th className="px-4 py-3">Branch</th>
            <th className="px-4 py-3">Latest review</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.pullRequests.map((pullRequest) => (
            <tr key={pullRequest.id}>
              <td className="px-4 py-3">
                <div className="font-medium text-primary">{`#${pullRequest.number} ${pullRequest.title}`}</div>
                <div className="mt-1 text-xs text-secondary">{pullRequest.state}{pullRequest.draft ? " draft" : ""}</div>
              </td>
              <td className="px-4 py-3 text-primary">{pullRequest.authorLogin}</td>
              <td className="px-4 py-3 font-mono text-xs text-primary">{pullRequest.headRef} {"->"} {pullRequest.baseRef}</td>
              <td className="px-4 py-3">
                {pullRequest.latestReviewRun === null ? (
                  <span className="text-secondary">No review yet</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <a className="font-medium text-accent" href={`/review-runs/${pullRequest.latestReviewRun.reviewRunId}`}>
                      Review run
                    </a>
                    <StatusBadge status={pullRequest.latestReviewRun.status} />
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FindingsTab({ data }: { data: RepositoryDetailResponse }) {
  if (data.findings.length === 0) {
    return <EmptyPanel title="No findings yet" body="No Semgrep, policy, CI, or LLM findings have been recorded for this repository." />;
  }

  return (
    <div className="grid gap-3">
      {data.findings.map((finding) => (
        <article key={finding.id} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            <span className="rounded-md border border-border bg-subtle px-2 py-1 text-xs font-medium text-secondary">
              {finding.source}
            </span>
            <a className="ml-auto text-xs font-medium text-accent" href={`/review-runs/${finding.reviewRunId}`}>
              Review run
            </a>
          </div>
          <h2 className="mt-3 text-sm font-semibold text-primary">{finding.title}</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">{finding.body}</p>
          <p className="mt-2 font-mono text-xs text-secondary">
            {finding.startLine === null ? finding.filePath ?? "repository summary" : `${finding.filePath ?? "repository summary"}:${finding.startLine}`}
          </p>
        </article>
      ))}
    </div>
  );
}

function ScansTab({ data }: { data: RepositoryDetailResponse }) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-primary">Codebase scans</h2>
            <p className="mt-1 text-sm leading-6 text-secondary">
              Recent scheduled, install, push, and manual scans for the default branch.
            </p>
          </div>
          <ManualCodebaseScanButton
            repositoryId={data.repository.id}
            disabled={!data.permissions.canTriggerCodebaseScans || !data.configuration.automationEnabled || !(data.configuration.codebaseScanEnabled ?? true)}
            disabledReason="Developer, Admin, or Owner access and enabled scan configuration are required."
          />
        </div>
      </section>
      {(data.codebaseScans ?? []).length === 0 ? (
        <EmptyPanel title="No codebase scans yet" body="A scan will appear after repository automation schedules or queues background analysis." />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-subtle text-left text-xs font-semibold uppercase text-secondary">
              <tr>
                <th className="px-4 py-3">Scan</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Commit</th>
                <th className="px-4 py-3">Findings</th>
                <th className="px-4 py-3">Finished</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data.codebaseScans ?? []).map((scan) => (
                <tr key={scan.id}>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={scan.status} />
                      <span className="font-mono text-xs text-secondary">{scan.id.slice(0, 8)}</span>
                    </div>
                    {scan.errorMessage === null ? null : <p className="mt-1 text-xs text-red-700">{scan.errorMessage}</p>}
                  </td>
                  <td className="px-4 py-3 text-primary">{scan.trigger}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary">{scan.commitSha === null ? scan.defaultBranch : shortSha(scan.commitSha)}</td>
                  <td className="px-4 py-3 text-primary">{scan.openFindingsCount} open / {scan.findingsCount} total</td>
                  <td className="px-4 py-3 text-secondary">{formatDateTime(scan.finishedAt ?? scan.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {(data.codebaseFindings ?? []).length === 0 ? (
        <EmptyPanel title="No open scan findings" body="Open repository-level findings from background scans will appear here." />
      ) : (
        <div className="grid gap-3">
          {(data.codebaseFindings ?? []).map((finding) => (
            <article key={finding.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={finding.severity} />
                <span className="rounded-md border border-border bg-subtle px-2 py-1 text-xs font-medium text-secondary">{finding.source}</span>
                <a className="ml-auto text-xs font-medium text-accent" href={`/findings?findingType=codebase_scan&repositoryId=${encodeURIComponent(finding.repositoryId)}`}>
                  Findings inbox
                </a>
              </div>
              <h2 className="mt-3 text-sm font-semibold text-primary">{finding.title}</h2>
              <p className="mt-2 text-sm leading-6 text-secondary">{finding.body}</p>
              <p className="mt-2 font-mono text-xs text-secondary">
                {finding.startLine === null ? finding.filePath ?? "repository summary" : `${finding.filePath ?? "repository summary"}:${finding.startLine}`}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigurationTab({ data }: { data: RepositoryDetailResponse }) {
  const canManage = data.permissions.canManageConfiguration;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-primary">Review configuration</h2>
          <p className="mt-1 text-sm leading-6 text-secondary">
            {canManage ? "Owner/Admin controls are enabled for this repository." : "Read-only configuration for this workspace role."}
          </p>
        </div>
        {canManage ? (
          <RepositoryAutomationToggle repositoryId={data.repository.id} initialEnabled={data.configuration.automationEnabled} />
        ) : (
          <button
            className="rounded-md border border-border bg-subtle px-3 py-2 text-sm font-medium text-secondary"
            disabled
            type="button"
            title="Owner or Admin required."
          >
            Read-only
          </button>
        )}
      </div>
      <RepositoryConfigurationForm repositoryId={data.repository.id} initialConfiguration={data.configuration} readOnly={!canManage} />
    </section>
  );
}

function ActivityTab({ data }: { data: RepositoryDetailResponse }) {
  if (data.activity.length === 0) {
    return <EmptyPanel title="No activity yet" body="Repository activity will appear after sync, webhook, review, and configuration events." />;
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <ol className="space-y-4">
        {data.activity.map((item) => (
          <li key={item.id} className="border-l-2 border-border pl-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-primary">{item.title}</h2>
              <span className="text-xs text-secondary">{formatDateTime(item.createdAt)}</span>
            </div>
            <p className="mt-1 text-sm leading-6 text-secondary">{item.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm font-medium text-secondary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-primary">{value}</p>
      <p className="mt-1 text-xs text-secondary">{helper}</p>
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-secondary">{label}</dt>
      <dd className="font-medium text-primary">{value}</dd>
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">{body}</p>
    </section>
  );
}

function RepositoryDetailLoadingState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Loading repository detail">
      <div className="h-6 w-64 rounded bg-subtle" />
      <div className="mt-4 h-10 rounded-md bg-subtle" />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {["one", "two", "three"].map((key) => (
          <div key={key} className="h-24 rounded-md bg-subtle" />
        ))}
      </div>
    </section>
  );
}

function RepositoryDetailEmptyState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h1 className="text-lg font-semibold text-primary">Repository not found</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">
        This repository is missing, or it is not available to the current workspace.
      </p>
      <a className="mt-4 inline-flex rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href="/repositories">
        Back to repositories
      </a>
    </section>
  );
}

function RepositoryDetailErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h1 className="text-sm font-semibold text-red-800">Repository detail could not be loaded</h1>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
    </section>
  );
}
