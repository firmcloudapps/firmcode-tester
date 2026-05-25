import React from "react";
import {
  REVIEW_FINDING_CATEGORIES,
  FINDING_INBOX_SOURCES,
  REVIEW_FINDING_SEVERITIES,
  REVIEW_FINDING_STATUSES,
  type CodebaseScanFindingInboxItem,
  type FindingInboxItem,
  type FindingsListFilters,
  type FindingsListResponse
} from "@firmcode/shared";
import type { ViewState } from "../../lib/view-state";
import { CodebaseFindingStatusActions } from "./codebase-finding-status-actions";
import { formatDateTime } from "./format";
import { FindingStatusBadge, SeverityBadge } from "./status-badge";

interface FindingsViewProps {
  state: ViewState<FindingsListResponse>;
}

export function FindingsView({ state }: FindingsViewProps) {
  const filters = getStateFilters(state);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-accent">Findings</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">Findings inbox</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
          Triage grounded Semgrep, AI, CI, and policy findings across repositories without opening raw artifacts.
        </p>
      </div>
      <FindingsFilters filters={filters} />
      {state.status === "loading" ? <FindingsLoadingState /> : null}
      {state.status === "error" ? <FindingsErrorState message={state.message} /> : null}
      {state.status === "empty" ? <FindingsEmptyState /> : null}
      {state.status === "populated" ? <FindingsList data={state.data} /> : null}
    </div>
  );
}

function getStateFilters(state: ViewState<FindingsListResponse>): FindingsListFilters {
  if (state.status === "populated") {
    return state.data.filters;
  }

  if (state.status === "empty" && state.data !== undefined) {
    return state.data.filters;
  }

  return {};
}

function FindingsFilters({ filters }: { filters: FindingsListFilters }) {
  return (
    <form className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-8" action="/findings">
      <FilterSelect label="Type" name="findingType" options={["pull_request", "codebase_scan"]} value={filters.findingType} />
      <FilterSelect label="Severity" name="severity" options={REVIEW_FINDING_SEVERITIES} value={filters.severity} />
      <FilterSelect label="Source" name="source" options={FINDING_INBOX_SOURCES} value={filters.source} />
      <FilterSelect label="Category" name="category" options={REVIEW_FINDING_CATEGORIES} value={filters.category} />
      <label className="flex flex-col gap-1 text-sm font-medium text-primary md:col-span-2">
        Repository
        <input
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary"
          defaultValue={filters.repository ?? ""}
          name="repository"
          placeholder="owner/repo"
        />
      </label>
      <FilterSelect label="Status" name="status" options={REVIEW_FINDING_STATUSES} value={filters.status} />
      <label className="flex flex-col gap-1 text-sm font-medium text-primary">
        Posted inline
        <select
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary"
          defaultValue={filters.postedInline === undefined ? "" : String(filters.postedInline)}
          name="postedInline"
        >
          <option value="">Any</option>
          <option value="true">Posted</option>
          <option value="false">Not posted</option>
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
      <div className="flex items-end md:col-span-6">
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

function FindingsLoadingState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Loading findings">
      <div className="h-5 w-44 rounded bg-subtle" />
      <div className="mt-4 grid gap-3">
        {["one", "two", "three", "four"].map((key) => (
          <div key={key} className="h-20 rounded-md bg-subtle" />
        ))}
      </div>
    </section>
  );
}

function FindingsErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-800">Findings could not be loaded</h2>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
    </section>
  );
}

function FindingsEmptyState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-primary">No findings match these filters</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">
        New findings appear here after review runs persist Semgrep, AI, CI, or policy results.
      </p>
    </section>
  );
}

function FindingsList({ data }: { data: FindingsListResponse }) {
  const canManageCodebaseFindings = data.permissions?.canManageCodebaseFindings ?? false;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <div className="min-w-[900px] divide-y divide-border">
          <div className="grid grid-cols-[120px_110px_130px_1fr_90px_120px_170px] gap-3 bg-subtle px-4 py-3 text-left text-xs font-semibold uppercase text-secondary">
            <span>Severity</span>
            <span>Source</span>
            <span>Category</span>
            <span>File</span>
            <span>Line</span>
            <span>Status</span>
            <span>Created</span>
          </div>
          {data.findings.map((finding) => (
            <FindingRow key={finding.id} finding={finding} canManageCodebaseFindings={canManageCodebaseFindings} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FindingRow({
  finding,
  canManageCodebaseFindings
}: {
  finding: FindingInboxItem;
  canManageCodebaseFindings: boolean;
}) {
  return (
    <article className="px-4 py-4">
      <div className="grid grid-cols-[120px_110px_130px_1fr_90px_120px_170px] gap-3 text-sm">
        <div>
          <SeverityBadge severity={finding.severity} />
        </div>
        <div className="text-primary">{formatLabel(finding.source)}</div>
        <div className="text-primary">{formatLabel(finding.category)}</div>
        <div className="min-w-0">
          <div className="font-medium text-primary">{finding.title}</div>
          <div className="mt-1 truncate font-mono text-xs text-secondary">{finding.filePath ?? "summary"}</div>
          <div className="mt-1 truncate text-xs text-secondary">{formatFindingContext(finding)}</div>
        </div>
        <div className="font-mono text-xs text-primary">{formatLine(finding)}</div>
        <div>
          <FindingStatusBadge status={finding.status} />
          <p className="mt-1 text-xs text-secondary">{finding.postedInline ? "Posted inline" : "Not posted"}</p>
        </div>
        <div className="text-xs text-secondary">{formatDateTime(finding.createdAt)}</div>
      </div>
      <details className="mt-3 rounded-md border border-border bg-subtle p-3">
        <summary className="cursor-pointer text-sm font-medium text-accent">View finding detail</summary>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            <DetailBlock title="Explanation">
              <p className="text-sm leading-6 text-primary">{finding.body}</p>
            </DetailBlock>
            <DetailBlock title="Evidence">
              {finding.evidence.length === 0 ? (
                <p className="text-sm text-secondary">No structured evidence was stored.</p>
              ) : (
                <div className="grid gap-2">
                  {finding.evidence.map((entry, index) => (
                    <pre key={index} className="max-h-40 overflow-auto rounded-md border border-border bg-surface p-3 text-xs leading-5 text-primary">
                      {JSON.stringify(entry, null, 2)}
                    </pre>
                  ))}
                </div>
              )}
            </DetailBlock>
            <DetailBlock title="Suggested fix">
              <p className="text-sm leading-6 text-primary">{finding.suggestion ?? "No suggested fix was stored for this finding."}</p>
            </DetailBlock>
          </div>
          <aside className="rounded-md border border-border bg-surface p-3">
            <h3 className="text-sm font-semibold text-primary">Related links</h3>
            <dl className="mt-3 grid gap-3 text-sm">
              <Metadata label="File" value={finding.filePath ?? "summary"} monospace />
              <Metadata label="Line" value={formatLine(finding)} monospace />
              <Metadata label="Confidence" value={formatLabel(finding.confidence)} />
              <Metadata label="Semgrep rule" value={finding.semgrepRuleId ?? "Not available"} monospace />
              <Metadata label="Posted" value={finding.postedAt === null ? "Not posted" : formatDateTime(finding.postedAt)} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {finding.reviewRunId === null ? null : (
                <a className="rounded-md border border-border px-2 py-1 text-xs font-medium text-primary" href={`/review-runs/${finding.reviewRunId}`}>
                  Review run
                </a>
              )}
              {finding.scanRunId === null ? null : (
                <a className="rounded-md border border-border px-2 py-1 text-xs font-medium text-primary" href={`/repositories/${encodeURIComponent(finding.repositoryId)}?tab=scans`}>
                  Scan run
                </a>
              )}
              {finding.githubCommentUrl === null ? null : (
                <a className="rounded-md border border-border px-2 py-1 text-xs font-medium text-primary" href={finding.githubCommentUrl}>
                  GitHub comment
                </a>
              )}
            </div>
            {isCodebaseScanFinding(finding) ? (
              <CodebaseFindingStatusActions finding={finding} canManage={canManageCodebaseFindings} />
            ) : null}
          </aside>
        </div>
      </details>
    </article>
  );
}

function formatFindingContext(finding: FindingInboxItem): string {
  return finding.pullRequestNumber === null
    ? `${finding.repositoryFullName} / codebase scan`
    : `${finding.repositoryFullName} / PR #${finding.pullRequestNumber}`;
}

function isCodebaseScanFinding(finding: FindingInboxItem): finding is CodebaseScanFindingInboxItem {
  return finding.findingType === "codebase_scan" && finding.scanRunId !== null && finding.scanRunId !== undefined;
}

function DetailBlock({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Metadata({ label, monospace = false, value }: { label: string; monospace?: boolean; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-secondary">{label}</dt>
      <dd className={`mt-1 break-words text-primary ${monospace ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function formatLine(finding: FindingInboxItem): string {
  if (finding.startLine === null) {
    return "-";
  }

  return finding.endLine === null || finding.endLine === finding.startLine
    ? String(finding.startLine)
    : `${finding.startLine}-${finding.endLine}`;
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
