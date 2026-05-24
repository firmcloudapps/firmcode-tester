import React from "react";
import {
  REVIEW_RUN_STATUSES,
  type CiFailureDetailResponse,
  type CiFailureFailedJob,
  type CiFailureListFilters,
  type CiFailureListItem,
  type CiFailureListResponse,
  type ReviewRunArtifact,
  type ReviewRunLogExcerpt
} from "@firmcode/shared";
import type { ViewState } from "../../lib/view-state";
import { formatDateTime } from "./format";
import { StatusBadge } from "./status-badge";

interface CiFailuresViewProps {
  state: ViewState<CiFailureListResponse>;
}

interface CiFailureDetailViewProps {
  state: ViewState<CiFailureDetailResponse>;
}

type CollapsedLogExcerpt = ReviewRunLogExcerpt & { collapsed: true };

export function CiFailuresView({ state }: CiFailuresViewProps) {
  const filters = getStateFilters(state);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-accent">CI Failures</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">Broken checks queue</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
          Review failed workflows by repository, pull request, root cause, flaky suspicion, and redacted evidence.
        </p>
      </div>
      <CiFailureFilters filters={filters} />
      {state.status === "loading" ? <CiFailuresLoadingState /> : null}
      {state.status === "error" ? <CiFailuresErrorState message={state.message} /> : null}
      {state.status === "empty" ? <CiFailuresEmptyState /> : null}
      {state.status === "populated" ? <CiFailuresQueue data={state.data} /> : null}
    </div>
  );
}

export function CiFailureDetailView({ state }: CiFailureDetailViewProps) {
  if (state.status === "loading") {
    return <CiFailureDetailLoadingState />;
  }

  if (state.status === "error") {
    return <CiFailuresErrorState message={state.message} />;
  }

  if (state.status === "empty") {
    return <CiFailuresErrorState message="The CI failure could not be found." />;
  }

  return <CiFailureDetailContent detail={state.data} />;
}

function getStateFilters(state: ViewState<CiFailureListResponse>): CiFailureListFilters {
  if (state.status === "populated") {
    return state.data.filters;
  }

  if (state.status === "empty" && state.data !== undefined) {
    return state.data.filters;
  }

  return {};
}

function CiFailureFilters({ filters }: { filters: CiFailureListFilters }) {
  return (
    <form className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-7" action="/ci-failures">
      <label className="flex flex-col gap-1 text-sm font-medium text-primary md:col-span-2">
        Repository
        <input
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary"
          defaultValue={filters.repository ?? ""}
          name="repository"
          placeholder="owner/repo"
        />
      </label>
      <FilterSelect label="Run status" name="status" options={REVIEW_RUN_STATUSES} value={filters.status} />
      <label className="flex flex-col gap-1 text-sm font-medium text-primary">
        Flaky suspected
        <select
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary"
          defaultValue={filters.flaky === undefined ? "" : String(filters.flaky)}
          name="flaky"
        >
          <option value="">Any</option>
          <option value="true">Suspected</option>
          <option value="false">Not suspected</option>
        </select>
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
      <div className="flex items-end">
        <button className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" type="submit">
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

function CiFailuresQueue({ data }: { data: CiFailureListResponse }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-primary">Failed workflows and jobs</h2>
        <p className="font-mono text-xs text-secondary">
          Showing {data.pagination.returned} of {data.pagination.limit}
        </p>
      </div>
      <div className="grid divide-y divide-border md:hidden">
        {data.ciFailures.map((failure) => (
          <CiFailureCard key={failure.id} failure={failure} />
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-subtle text-left text-xs font-semibold uppercase text-secondary">
            <tr>
              <th className="px-4 py-3">Repository</th>
              <th className="px-4 py-3">PR</th>
              <th className="px-4 py-3">Failed workflow/job</th>
              <th className="px-4 py-3">Root cause summary</th>
              <th className="px-4 py-3">Flaky suspected</th>
              <th className="px-4 py-3">Suggested fix</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.ciFailures.map((failure) => (
              <CiFailureRow key={failure.id} failure={failure} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CiFailureRow({ failure }: { failure: CiFailureListItem }) {
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="font-medium text-primary">{failure.repositoryFullName}</div>
        <a className="mt-1 block font-mono text-xs text-accent" href={`/review-runs/${encodeURIComponent(failure.reviewRunId)}`}>
          {failure.reviewRunId.slice(0, 8)}
        </a>
      </td>
      <td className="px-4 py-3">
        <a className="font-medium text-accent" href={`/pull-requests/${encodeURIComponent(failure.pullRequestId)}`}>
          #{failure.pullRequestNumber}
        </a>
        <div className="mt-1 max-w-xs truncate text-xs text-secondary">{failure.pullRequestTitle}</div>
      </td>
      <td className="px-4 py-3">
        <FailedJobSummary job={failure.failedJob} />
      </td>
      <td className="px-4 py-3 max-w-sm text-sm leading-5 text-primary">
        <a className="text-accent" href={`/ci-failures/${encodeURIComponent(failure.id)}`}>
          {failure.rootCauseSummary}
        </a>
      </td>
      <td className="px-4 py-3">
        <FlakyBadge suspected={failure.flakySuspected} />
      </td>
      <td className="px-4 py-3 max-w-xs text-sm leading-5 text-secondary">{failure.suggestedFix ?? "No suggested fix stored."}</td>
      <td className="px-4 py-3 text-xs text-secondary">{formatDateTime(failure.createdAt)}</td>
    </tr>
  );
}

function CiFailureCard({ failure }: { failure: CiFailureListItem }) {
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a className="font-medium text-accent" href={`/ci-failures/${encodeURIComponent(failure.id)}`}>
            {failure.failedJob.jobName}
          </a>
          <p className="mt-1 truncate text-sm text-secondary">
            {failure.repositoryFullName} / PR #{failure.pullRequestNumber}
          </p>
        </div>
        <FlakyBadge suspected={failure.flakySuspected} />
      </div>
      <p className="mt-3 text-sm leading-6 text-primary">{failure.rootCauseSummary}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Metadata label="Workflow" value={failure.failedJob.workflowName ?? "Unknown"} />
        <Metadata label="Created" value={formatDateTime(failure.createdAt)} />
        <Metadata label="Suggested fix" value={failure.suggestedFix ?? "No suggested fix stored."} />
        <Metadata label="Status" value={formatLabel(failure.status)} />
      </dl>
    </article>
  );
}

function CiFailureDetailContent({ detail }: { detail: CiFailureDetailResponse }) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-accent">CI Failure</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">{detail.failedJob.jobName}</h1>
            <p className="mt-2 text-sm text-secondary">
              {detail.repositoryFullName} / PR #{detail.pullRequestNumber}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <StatusBadge status={detail.status} />
            <FlakyBadge suspected={detail.flakySuspected} />
            <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href="/ci-failures">
              Back to queue
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4" aria-label="CI failure metrics">
        <Metric label="Failed jobs" value={String(detail.failedJobs.length)} />
        <Metric label="Redacted excerpts" value={String(detail.logExcerpts.length)} />
        <Metric label="Suggested fixes" value={String(detail.suggestedFixes.length)} />
        <Metric label="Created" value={formatDateTime(detail.createdAt)} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <SummarySection detail={detail} />
          <SuggestedFixesSection fixes={detail.suggestedFixes} fallback={detail.suggestedFix} />
          <FailedJobsSection jobs={detail.failedJobs} />
          <LogExcerptsSection excerpts={detail.logExcerpts} />
          <UnavailableLogsSection notes={detail.unavailableLogNotes} />
        </div>
        <RelatedLinksPanel detail={detail} />
      </div>
    </div>
  );
}

function SummarySection({ detail }: { detail: CiFailureDetailResponse }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <SectionHeader title="Failure Summary" subtitle="Stored CI explanation summary" />
      <p className="mt-3 text-sm leading-6 text-primary">{detail.rootCauseSummary}</p>
      <h3 className="mt-4 text-sm font-semibold text-primary">Likely root cause</h3>
      <p className="mt-2 text-sm leading-6 text-primary">{detail.rootCause}</p>
    </section>
  );
}

function SuggestedFixesSection({
  fallback,
  fixes
}: {
  fallback: string | null;
  fixes: CiFailureDetailResponse["suggestedFixes"];
}) {
  const visibleFixes = fixes.length > 0 ? fixes : fallback === null ? [] : [{ id: "fallback-fix", text: fallback }];

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <SectionHeader title="Suggested Fixes" subtitle={`${visibleFixes.length} stored recommendations`} />
      {visibleFixes.length === 0 ? <p className="mt-3 text-sm text-secondary">No suggested fixes were stored for this failure.</p> : null}
      <ol className="mt-3 grid gap-2">
        {visibleFixes.map((fix) => (
          <li key={fix.id} className="rounded-md border border-border bg-subtle p-3 text-sm leading-6 text-primary">
            {fix.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

function FailedJobsSection({ jobs }: { jobs: CiFailureFailedJob[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <SectionHeader title="Failed Jobs" subtitle={`${jobs.length} failed workflow jobs`} padded />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-subtle text-left text-xs font-semibold uppercase text-secondary">
            <tr>
              <th className="px-4 py-3">Workflow/job</th>
              <th className="px-4 py-3">Step</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Conclusion</th>
              <th className="px-4 py-3">Provider link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="px-4 py-3">
                  <FailedJobSummary job={job} />
                </td>
                <td className="px-4 py-3 text-primary">{job.stepName ?? "Unknown step"}</td>
                <td className="px-4 py-3 text-primary">{formatLabel(job.category)}</td>
                <td className="px-4 py-3 text-primary">{formatLabel(job.conclusion)}</td>
                <td className="px-4 py-3">
                  {job.detailsUrl === null ? (
                    <span className="text-secondary">Not available</span>
                  ) : (
                    <a className="text-accent" href={job.detailsUrl}>
                      Check run
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LogExcerptsSection({ excerpts }: { excerpts: CollapsedLogExcerpt[] }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <SectionHeader title="Redacted Log Excerpts" subtitle={`${excerpts.length} collapsed excerpts available by default`} />
      <div className="mt-3 grid gap-3">
        {excerpts.length === 0 ? <p className="text-sm text-secondary">No redacted log excerpts were stored for this failure.</p> : null}
        {excerpts.map((excerpt) => (
          <details key={excerpt.id} className="rounded-md border border-border bg-subtle p-3">
            <summary className="cursor-pointer text-sm font-medium text-accent">
              {excerpt.title} ({excerpt.redacted ? "redacted" : "metadata only"})
              {excerpt.truncated ? " / truncated" : ""}
            </summary>
            <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-border bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              {excerpt.excerpt}
            </pre>
          </details>
        ))}
      </div>
    </section>
  );
}

function UnavailableLogsSection({ notes }: { notes: unknown[] }) {
  if (notes.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-base font-semibold text-amber-800">Unavailable Logs</h2>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-amber-800">
        {notes.map((note, index) => (
          <li key={index}>{typeof note === "string" ? note : JSON.stringify(note)}</li>
        ))}
      </ul>
    </section>
  );
}

function RelatedLinksPanel({ detail }: { detail: CiFailureDetailResponse }) {
  return (
    <aside className="rounded-lg border border-border bg-surface p-4 xl:sticky xl:top-24 xl:self-start">
      <h2 className="text-base font-semibold text-primary">Related Links</h2>
      <dl className="mt-4 grid gap-3 text-sm">
        <Metadata label="Repository" value={detail.repositoryFullName} />
        <Metadata label="Pull request" value={`#${detail.pullRequestNumber} ${detail.pullRequestTitle}`} />
        <Metadata label="Review run" value={detail.relatedReviewRun.id.slice(0, 8)} monospace />
        <Metadata label="Run created" value={formatDateTime(detail.relatedReviewRun.createdAt)} />
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href={`/review-runs/${detail.relatedReviewRun.id}`}>
          Review run
        </a>
        <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href={`/pull-requests/${detail.pullRequestId}`}>
          Pull request
        </a>
      </div>
      <section className="mt-5 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-primary">Artifacts</h3>
        <div className="mt-3 grid gap-3">
          {detail.relatedArtifacts.map((artifact) => (
            <ArtifactLink key={artifact.id} artifact={artifact} />
          ))}
        </div>
      </section>
    </aside>
  );
}

function ArtifactLink({ artifact }: { artifact: ReviewRunArtifact }) {
  return (
    <div className="rounded-md border border-border bg-subtle p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs font-semibold text-primary">{artifact.artifactType}</span>
        <span className="font-mono text-xs text-secondary">{formatDateTime(artifact.createdAt)}</span>
      </div>
      {artifact.rawAccessAllowed && artifact.rawAccessUrl !== null ? (
        <a className="mt-2 inline-flex rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-accent" href={artifact.rawAccessUrl}>
          Raw artifact
        </a>
      ) : (
        <button
          className="mt-2 cursor-not-allowed rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-secondary"
          type="button"
          disabled
        >
          Raw artifact restricted
        </button>
      )}
    </div>
  );
}

function FailedJobSummary({ job }: { job: CiFailureFailedJob }) {
  return (
    <div className="min-w-0">
      <div className="font-medium text-primary">{job.workflowName ?? "Unknown workflow"}</div>
      <div className="mt-1 truncate font-mono text-xs text-secondary">{job.jobName}</div>
    </div>
  );
}

function FlakyBadge({ suspected }: { suspected: boolean }) {
  const className = suspected
    ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {suspected ? "Suspected" : "Not suspected"}
    </span>
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

function SectionHeader({ padded = false, subtitle, title }: { padded?: boolean; subtitle: string; title: string }) {
  return (
    <div className={padded ? "border-b border-border px-4 py-3" : ""}>
      <h2 className="text-base font-semibold text-primary">{title}</h2>
      <p className="mt-1 text-sm text-secondary">{subtitle}</p>
    </div>
  );
}

function CiFailuresLoadingState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Loading CI failures">
      <div className="h-5 w-48 rounded bg-subtle" />
      <div className="mt-4 grid gap-3">
        {["one", "two", "three", "four"].map((key) => (
          <div key={key} className="h-16 rounded-md bg-subtle" />
        ))}
      </div>
    </section>
  );
}

function CiFailureDetailLoadingState() {
  return (
    <div className="space-y-4" aria-label="Loading CI failure detail">
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

function CiFailuresErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-800">CI failures could not be loaded</h2>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
    </section>
  );
}

function CiFailuresEmptyState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-primary">No CI failures match these filters</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">
        CI failures appear here after Firmcode stores redacted CI explanations for failed workflow jobs.
      </p>
    </section>
  );
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
