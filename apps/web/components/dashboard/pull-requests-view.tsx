import React from "react";
import {
  PULL_REQUEST_DASHBOARD_STATUSES,
  REVIEW_RUN_STATUSES,
  type PullRequestDetailResponse,
  type PullRequestListFilters,
  type PullRequestListItem,
  type PullRequestListResponse,
  type ReviewRunRiskLevel
} from "@firmcode/shared";
import type { ViewState } from "../../lib/view-state";
import { formatDateTime, formatDuration, shortSha } from "./format";
import { SeverityBadge, StatusBadge } from "./status-badge";

interface PullRequestsViewProps {
  state: ViewState<PullRequestListResponse>;
}

interface PullRequestDetailViewProps {
  state: ViewState<PullRequestDetailResponse>;
}

export function PullRequestsView({ state }: PullRequestsViewProps) {
  const filters = getStateFilters(state);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-accent">Pull Requests</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">Engineering review queue</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
          Scan pull requests by repository, lifecycle status, risk, review status, author, and update window.
        </p>
      </div>
      <PullRequestFilters filters={filters} />
      {state.status === "loading" ? <PullRequestsLoadingState /> : null}
      {state.status === "error" ? <PullRequestsErrorState message={state.message} /> : null}
      {state.status === "empty" ? <PullRequestsEmptyState /> : null}
      {state.status === "populated" ? <PullRequestsQueue data={state.data} /> : null}
    </div>
  );
}

export function PullRequestDetailView({ state }: PullRequestDetailViewProps) {
  if (state.status === "loading") {
    return <PullRequestDetailLoadingState />;
  }

  if (state.status === "error") {
    return <PullRequestsErrorState message={state.message} />;
  }

  if (state.status === "empty") {
    return <PullRequestsErrorState message="The pull request could not be found." />;
  }

  return <PullRequestDetailContent detail={state.data} />;
}

function getStateFilters(state: ViewState<PullRequestListResponse>): PullRequestListFilters {
  if (state.status === "populated") {
    return state.data.filters;
  }

  if (state.status === "empty" && state.data !== undefined) {
    return state.data.filters;
  }

  return {};
}

function PullRequestFilters({ filters }: { filters: PullRequestListFilters }) {
  return (
    <form className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-8" action="/pull-requests">
      <label className="flex flex-col gap-1 text-sm font-medium text-primary md:col-span-2">
        Repository
        <input
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary"
          defaultValue={filters.repository ?? ""}
          name="repository"
          placeholder="owner/repo"
        />
      </label>
      <FilterSelect label="Status" name="status" options={PULL_REQUEST_DASHBOARD_STATUSES} value={filters.status} />
      <FilterSelect label="Risk" name="riskLevel" options={["low", "medium", "high", "unknown"]} value={filters.riskLevel} />
      <FilterSelect label="Review status" name="reviewStatus" options={REVIEW_RUN_STATUSES} value={filters.reviewStatus ?? undefined} />
      <label className="flex flex-col gap-1 text-sm font-medium text-primary">
        Author
        <input
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary"
          defaultValue={filters.author ?? ""}
          name="author"
          placeholder="github-login"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-primary">
        From
        <input
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary"
          defaultValue={filters.dateFrom ?? ""}
          name="dateFrom"
          type="date"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-primary">
        To
        <input
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary"
          defaultValue={filters.dateTo ?? ""}
          name="dateTo"
          type="date"
        />
      </label>
      <div className="flex items-end md:col-span-8">
        <button className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white md:w-auto" type="submit">
          Apply filters
        </button>
      </div>
    </form>
  );
}

function FilterSelect({
  label,
  name,
  options,
  value
}: {
  label: string;
  name: string;
  options: readonly string[];
  value: string | undefined;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-primary">
      {label}
      <select className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary" defaultValue={value ?? ""} name={name}>
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function PullRequestsLoadingState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Loading pull requests">
      <div className="h-5 w-48 rounded bg-subtle" />
      <div className="mt-4 grid gap-3">
        {["one", "two", "three", "four"].map((key) => (
          <div key={key} className="h-16 rounded-md bg-subtle" />
        ))}
      </div>
    </section>
  );
}

function PullRequestDetailLoadingState() {
  return (
    <div className="space-y-4" aria-label="Loading pull request detail">
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="h-6 w-64 rounded bg-subtle" />
        <div className="mt-4 h-4 w-96 max-w-full rounded bg-subtle" />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {["one", "two", "three", "four"].map((key) => (
          <div key={key} className="h-24 rounded-lg border border-border bg-surface p-4">
            <div className="h-4 w-24 rounded bg-subtle" />
            <div className="mt-3 h-6 w-16 rounded bg-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PullRequestsErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-800">Pull requests could not be loaded</h2>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
    </section>
  );
}

function PullRequestsEmptyState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-primary">No pull requests match these filters</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">
        Pull requests appear here after GitHub webhooks persist repository PR metadata and review runs.
      </p>
    </section>
  );
}

function PullRequestsQueue({ data }: { data: PullRequestListResponse }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-primary">Review queue</h2>
        <p className="font-mono text-xs text-secondary">
          Showing {data.pagination.returned} of {data.pagination.limit}
        </p>
      </div>
      <div className="grid divide-y divide-border md:hidden">
        {data.pullRequests.map((pullRequest) => (
          <PullRequestCard key={pullRequest.id} pullRequest={pullRequest} />
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-subtle text-left text-xs font-semibold uppercase text-secondary">
            <tr>
              <th className="px-4 py-3">Pull request</th>
              <th className="px-4 py-3">Repository</th>
              <th className="px-4 py-3">Author</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Review status</th>
              <th className="px-4 py-3">Findings</th>
              <th className="px-4 py-3">CI / PR status</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.pullRequests.map((pullRequest) => (
              <PullRequestRow key={pullRequest.id} pullRequest={pullRequest} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PullRequestRow({ pullRequest }: { pullRequest: PullRequestListItem }) {
  return (
    <tr>
      <td className="px-4 py-3">
        <a className="font-medium text-accent" href={`/pull-requests/${encodeURIComponent(pullRequest.id)}`}>
          #{pullRequest.number} {pullRequest.title}
        </a>
        <div className="mt-1 font-mono text-xs text-secondary">{shortSha(pullRequest.headSha)}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-primary">{pullRequest.repositoryFullName}</div>
        <div className="mt-1 text-xs text-secondary">{pullRequest.repositoryPrivate ? "Private" : "Public"}</div>
      </td>
      <td className="px-4 py-3 text-primary">{pullRequest.authorLogin}</td>
      <td className="px-4 py-3">
        <RiskBadge risk={pullRequest.riskLevel} />
      </td>
      <td className="px-4 py-3">{pullRequest.reviewStatus === null ? <MutedBadge label="Not reviewed" /> : <StatusBadge status={pullRequest.reviewStatus} />}</td>
      <td className="px-4 py-3 font-mono text-sm text-primary">{pullRequest.latestReview?.findingsCount ?? 0}</td>
      <td className="px-4 py-3">
        <PullRequestStatusBadge status={pullRequest.status} />
      </td>
      <td className="px-4 py-3 text-secondary">{formatDateTime(pullRequest.updatedAt)}</td>
    </tr>
  );
}

function PullRequestCard({ pullRequest }: { pullRequest: PullRequestListItem }) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a className="font-medium text-accent" href={`/pull-requests/${encodeURIComponent(pullRequest.id)}`}>
            #{pullRequest.number} {pullRequest.title}
          </a>
          <p className="mt-1 truncate text-sm text-secondary">{pullRequest.repositoryFullName}</p>
        </div>
        <RiskBadge risk={pullRequest.riskLevel} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Metadata label="Author" value={pullRequest.authorLogin} />
        <Metadata label="Review" value={pullRequest.reviewStatus === null ? "Not reviewed" : formatLabel(pullRequest.reviewStatus)} />
        <Metadata label="Findings" value={String(pullRequest.latestReview?.findingsCount ?? 0)} monospace />
        <Metadata label="Updated" value={formatDateTime(pullRequest.updatedAt)} />
      </dl>
    </article>
  );
}

function PullRequestDetailContent({ detail }: { detail: PullRequestDetailResponse }) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-accent">Pull Request</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">
              #{detail.number} {detail.title}
            </h1>
            <p className="mt-2 text-sm text-secondary">
              {detail.repositoryFullName} by {detail.authorLogin}
            </p>
            <p className="mt-1 font-mono text-xs text-secondary">{shortSha(detail.commitSha)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <PullRequestStatusBadge status={detail.status} />
            <RiskBadge risk={detail.riskLevel} />
            {detail.reviewStatus === null ? <MutedBadge label="Not reviewed" /> : <StatusBadge status={detail.reviewStatus} />}
            <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href={detail.githubUrl}>
              GitHub
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4" aria-label="Pull request metrics">
        <Metric label="Files changed" value={String(detail.changedFiles.length)} />
        <Metric label="Findings" value={String(detail.findings.length)} />
        <Metric label="Review duration" value={formatDuration(detail.durationMs)} />
        <Metric label="Review runs" value={String(detail.metadata.reviewRunsCount)} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <SummarySection detail={detail} />
          <ChangedComponentsSection detail={detail} />
          <RiskAnalysisSection detail={detail} />
          <TimelineSection detail={detail} />
          <FindingsSection detail={detail} />
          <FilesSection detail={detail} />
        </div>
        <MetadataPanel detail={detail} />
      </div>
    </div>
  );
}

function SummarySection({ detail }: { detail: PullRequestDetailResponse }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <SectionHeader title="Summary" subtitle="Latest published review summary or stored LLM summary" />
      <p className="mt-3 text-sm leading-6 text-primary">{detail.summary ?? "No pull request summary has been stored yet."}</p>
    </section>
  );
}

function ChangedComponentsSection({ detail }: { detail: PullRequestDetailResponse }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <SectionHeader title="Changed Components" subtitle={`${detail.changedComponents.length} areas inferred from latest changed files`} />
      <div className="mt-3 flex flex-wrap gap-2">
        {detail.changedComponents.length === 0 ? <p className="text-sm text-secondary">No changed components recorded.</p> : null}
        {detail.changedComponents.map((component) => (
          <span key={component} className="rounded-md border border-border bg-subtle px-2 py-1 font-mono text-xs text-primary">
            {component}
          </span>
        ))}
      </div>
    </section>
  );
}

function RiskAnalysisSection({ detail }: { detail: PullRequestDetailResponse }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <SectionHeader title="Risk Analysis" subtitle="Derived from stored metrics and changed-file risk flags" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <RiskBadge risk={detail.riskAnalysis.riskLevel} />
        {detail.riskAnalysis.riskFlags.length === 0 ? <MutedBadge label="No risk flags" /> : null}
        {detail.riskAnalysis.riskFlags.map((flag) => (
          <span key={flag} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
            {formatLabel(flag)}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm leading-6 text-primary">{detail.riskAnalysis.summary ?? "No narrative risk analysis is available yet."}</p>
    </section>
  );
}

function TimelineSection({ detail }: { detail: PullRequestDetailResponse }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <SectionHeader title="Review Timeline" subtitle={`${detail.reviewTimeline.length} review runs for this pull request`} />
      <div className="mt-3 grid gap-3">
        {detail.reviewTimeline.length === 0 ? <p className="text-sm text-secondary">No review runs have been recorded.</p> : null}
        {detail.reviewTimeline.map((run) => (
          <article key={run.id} className="rounded-md border border-border bg-subtle p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <a className="font-mono text-sm font-medium text-accent" href={`/review-runs/${encodeURIComponent(run.id)}`}>
                {run.id.slice(0, 8)}
              </a>
              <StatusBadge status={run.status} />
            </div>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
              <Metadata label="Stage" value={run.currentStage} />
              <Metadata label="Duration" value={formatDuration(run.durationMs)} monospace />
              <Metadata label="Findings" value={String(run.findingsCount)} monospace />
              <Metadata label="Updated" value={formatDateTime(run.updatedAt)} />
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function FindingsSection({ detail }: { detail: PullRequestDetailResponse }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <SectionHeader title="Findings" subtitle={`${detail.findings.length} grounded findings attached to this pull request`} padded />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-subtle text-left text-xs font-semibold uppercase text-secondary">
            <tr>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Finding</th>
              <th className="px-4 py-3">File</th>
              <th className="px-4 py-3">Line</th>
              <th className="px-4 py-3">Posted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {detail.findings.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-sm text-secondary" colSpan={6}>
                  No findings were stored for this pull request.
                </td>
              </tr>
            ) : null}
            {detail.findings.map((finding) => (
              <tr key={finding.id}>
                <td className="px-4 py-3">
                  <SeverityBadge severity={finding.severity} />
                </td>
                <td className="px-4 py-3 text-primary">{formatLabel(finding.source)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-primary">{finding.title}</div>
                  <div className="mt-1 max-w-lg text-xs leading-5 text-secondary">{finding.body}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-primary">{finding.filePath ?? "summary"}</td>
                <td className="px-4 py-3 font-mono text-xs text-primary">{formatLine(finding.startLine, finding.endLine)}</td>
                <td className="px-4 py-3 text-primary">{finding.postedInline ? "Posted inline" : "Not posted"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilesSection({ detail }: { detail: PullRequestDetailResponse }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <SectionHeader title="Files Changed" subtitle={`${detail.changedFiles.length} files from the latest review run`} padded />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-subtle text-left text-xs font-semibold uppercase text-secondary">
            <tr>
              <th className="px-4 py-3">Path</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Language</th>
              <th className="px-4 py-3">Lines</th>
              <th className="px-4 py-3">Risk flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {detail.changedFiles.map((file) => (
              <tr key={file.id}>
                <td className="px-4 py-3 font-mono text-xs text-primary">{file.path}</td>
                <td className="px-4 py-3 text-primary">{file.status}</td>
                <td className="px-4 py-3 text-primary">{file.language ?? "unknown"}</td>
                <td className="px-4 py-3 font-mono text-xs text-primary">
                  +{file.additions} / -{file.deletions}
                </td>
                <td className="px-4 py-3 text-secondary">{file.riskFlags.length === 0 ? "None" : file.riskFlags.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MetadataPanel({ detail }: { detail: PullRequestDetailResponse }) {
  return (
    <aside className="rounded-lg border border-border bg-surface p-4 xl:sticky xl:top-24 xl:self-start">
      <h2 className="text-base font-semibold text-primary">Metadata</h2>
      <dl className="mt-4 grid gap-3 text-sm">
        <Metadata label="Repository" value={detail.metadata.repositoryFullName} />
        <Metadata label="Visibility" value={detail.metadata.repositoryPrivate ? "Private" : "Public"} />
        <Metadata label="Branches" value={`${detail.branches.baseRef} <- ${detail.branches.headRef}`} monospace />
        <Metadata label="Base SHA" value={shortSha(detail.branches.baseSha)} monospace />
        <Metadata label="Commit SHA" value={shortSha(detail.commitSha)} monospace />
        <Metadata label="Files changed" value={String(detail.metadata.changedFilesCount)} monospace />
        <Metadata label="Review duration" value={formatDuration(detail.durationMs)} monospace />
        <Metadata label="Created" value={formatDateTime(detail.createdAt)} />
        <Metadata label="Updated" value={formatDateTime(detail.updatedAt)} />
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href={detail.githubUrl}>
          Open on GitHub
        </a>
        <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href="/pull-requests">
          Back to queue
        </a>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase text-secondary">{label}</p>
      <p className="mt-2 break-words font-mono text-base font-semibold leading-6 text-primary">{value}</p>
    </div>
  );
}

function Metadata({ label, value, monospace = false }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-secondary">{label}</dt>
      <dd className={`mt-1 break-words text-primary ${monospace ? "font-mono text-xs" : "text-sm"}`}>{value}</dd>
    </div>
  );
}

function SectionHeader({ title, subtitle, padded = false }: { title: string; subtitle: string; padded?: boolean }) {
  return (
    <div className={padded ? "border-b border-border px-4 py-3" : ""}>
      <h2 className="text-base font-semibold text-primary">{title}</h2>
      <p className="mt-1 text-sm text-secondary">{subtitle}</p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: ReviewRunRiskLevel }) {
  return <SeverityBadge severity={risk === "unknown" ? "info" : risk} />;
}

function PullRequestStatusBadge({ status }: { status: PullRequestListItem["status"] }) {
  const className =
    status === "open"
      ? "border-green-200 bg-green-50 text-success"
      : status === "draft"
        ? "border-orange-200 bg-blush text-ember"
        : "border-mist bg-shell text-secondary";

  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>{formatLabel(status)}</span>;
}

function MutedBadge({ label }: { label: string }) {
  return <span className="inline-flex rounded-md border border-mist bg-shell px-2 py-1 text-xs font-medium text-secondary">{label}</span>;
}

function formatLine(start: number | null, end: number | null): string {
  if (start === null) {
    return "-";
  }

  return end === null || end === start ? String(start) : `${start}-${end}`;
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
