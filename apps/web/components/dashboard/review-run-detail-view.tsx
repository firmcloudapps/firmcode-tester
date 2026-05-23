import React from "react";
import type { ReviewRunDetail } from "@firmcode/shared";
import type { ViewState } from "../../lib/view-state";
import { formatDateTime, formatDuration, shortSha } from "./format";
import { PipelineStatusBadge, SeverityBadge, StatusBadge } from "./status-badge";

interface ReviewRunDetailViewProps {
  state: ViewState<ReviewRunDetail>;
}

export function ReviewRunDetailView({ state }: ReviewRunDetailViewProps) {
  if (state.status === "loading") {
    return <ReviewRunDetailLoadingState />;
  }

  if (state.status === "error") {
    return <ReviewRunDetailErrorState message={state.message} />;
  }

  if (state.status === "empty") {
    return <ReviewRunDetailErrorState message="The review run could not be found." />;
  }

  return <ReviewRunDetailContent detail={state.data} />;
}

function ReviewRunDetailLoadingState() {
  return (
    <div className="space-y-4" aria-label="Loading review run detail">
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="h-6 w-56 rounded bg-subtle" />
        <div className="mt-4 h-4 w-80 rounded bg-subtle" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {["one", "two", "three", "four", "five", "six"].map((key) => (
          <div key={key} className="h-24 rounded-lg border border-border bg-surface p-4">
            <div className="h-4 w-24 rounded bg-subtle" />
            <div className="mt-3 h-6 w-16 rounded bg-subtle" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewRunDetailErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-5">
      <h1 className="text-lg font-semibold text-red-800">Review run detail could not be loaded</h1>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
    </section>
  );
}

function ReviewRunDetailContent({ detail }: { detail: ReviewRunDetail }) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Review Run</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">Review Run #{detail.id.slice(0, 8)}</h1>
            <p className="mt-2 text-sm text-secondary">
              {detail.repositoryFullName} / PR #{detail.pullRequestNumber} /{" "}
              <span className="font-mono">{shortSha(detail.headSha)}</span>
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">{detail.pullRequestTitle}</p>
          </div>
          <StatusBadge status={detail.status} />
        </div>
        {detail.errorMessage === null ? null : (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{detail.errorMessage}</div>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Review run metrics">
        <Metric label="Duration" value={formatDuration(detail.durationMs)} />
        <Metric label="Files analyzed" value={String(detail.filesAnalyzedCount)} />
        <Metric label="Semgrep findings" value={String(detail.semgrepFindingsCount)} />
        <Metric label="AI findings" value={String(detail.aiFindingsCount)} />
        <Metric label="Inline comments" value={String(detail.inlineCommentsPostedCount)} />
        <Metric label="Tokens / cost" value={formatTokenCost(detail.tokenUsage, detail.estimatedCostUsd)} />
      </section>

      <PipelineSection detail={detail} />
      <FilesSection detail={detail} />
      <FindingsSection detail={detail} />
      <ArtifactsSection detail={detail} />
      <LogsSection detail={detail} />
      <PublishedCommentsSection detail={detail} />
    </div>
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

function PipelineSection({ detail }: { detail: ReviewRunDetail }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-primary">Pipeline</h2>
        <p className="text-sm text-secondary">Webhook Received, Diff Fetched, Tree-sitter Parsed, Semgrep Scanned, LLM Reviewed, and Comments Published.</p>
      </div>
      <ol className="mt-4 grid gap-3 lg:grid-cols-6">
        {detail.pipelineStages.map((stage) => (
          <li key={stage.key} className="rounded-md border border-border bg-subtle p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-primary">{stage.label}</h3>
              <PipelineStatusBadge status={stage.status} />
            </div>
            <p className="mt-2 font-mono text-xs text-secondary">{formatDuration(stage.durationMs)}</p>
            {stage.artifactId === null ? null : <p className="mt-2 font-mono text-xs text-accent">artifact {stage.artifactId.slice(0, 8)}</p>}
            {stage.errorMessage === null ? null : <p className="mt-2 text-xs leading-5 text-red-700">{stage.errorMessage}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function FilesSection({ detail }: { detail: ReviewRunDetail }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <SectionHeader title="Files" subtitle={`${detail.changedFiles.length} changed files recorded for this run`} />
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

function FindingsSection({ detail }: { detail: ReviewRunDetail }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <SectionHeader title="Findings" subtitle={`${detail.findings.length} grounded findings from Semgrep, AI, CI, or policy`} />
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
            {detail.findings.map((finding) => (
              <tr key={finding.id}>
                <td className="px-4 py-3">
                  <SeverityBadge severity={finding.severity} />
                </td>
                <td className="px-4 py-3 text-primary">{finding.source}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-primary">{finding.title}</div>
                  <div className="mt-1 max-w-lg text-xs leading-5 text-secondary">{finding.body}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-primary">{finding.filePath ?? "summary"}</td>
                <td className="px-4 py-3 font-mono text-xs text-primary">{finding.startLine ?? "-"}</td>
                <td className="px-4 py-3 text-primary">{finding.postedInline ? "Posted inline" : "Not posted"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ArtifactsSection({ detail }: { detail: ReviewRunDetail }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <SectionHeader title="Artifacts" subtitle={`${detail.artifacts.length} stored analysis artifacts`} />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {detail.artifacts.map((artifact) => (
          <div key={artifact.id} className="rounded-md border border-border bg-subtle p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-mono text-sm font-semibold text-primary">{artifact.artifactType}</h3>
              <span className="font-mono text-xs text-secondary">{formatDateTime(artifact.createdAt)}</span>
            </div>
            <p className="mt-2 break-all font-mono text-xs text-secondary">{artifact.storageKey}</p>
            <pre className="mt-3 max-h-32 overflow-auto rounded-md border border-border bg-surface p-3 text-xs text-primary">
              {JSON.stringify(artifact.metadata, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </section>
  );
}

function LogsSection({ detail }: { detail: ReviewRunDetail }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <SectionHeader title="Logs" subtitle={`${detail.logExcerpts.length} redacted log excerpts available`} />
      <div className="mt-3 grid gap-3">
        {detail.logExcerpts.length === 0 ? <p className="text-sm text-secondary">No log excerpts were stored for this run.</p> : null}
        {detail.logExcerpts.map((log) => (
          <div key={log.id}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <h3 className="font-semibold text-primary">{log.title}</h3>
              <span className="rounded-md border border-border bg-subtle px-2 py-1 text-xs text-secondary">
                {log.redacted ? "Redacted" : "Unredacted metadata"}
              </span>
              {log.truncated ? <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">Truncated</span> : null}
            </div>
            <pre className="mt-2 max-h-60 overflow-auto rounded-md border border-border bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              {log.excerpt}
            </pre>
          </div>
        ))}
      </div>
    </section>
  );
}

function PublishedCommentsSection({ detail }: { detail: ReviewRunDetail }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <SectionHeader title="Published comments" subtitle={`${detail.publishedComments.length} summary, review, or inline comments`} />
      <div className="mt-3 grid gap-3">
        {detail.publishedComments.map((comment) => (
          <article key={comment.id} className="rounded-md border border-border bg-subtle p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
              <span className="font-semibold text-primary">{comment.commentType}</span>
              <span>{comment.dryRun ? "Dry run" : "Published"}</span>
              <span>{comment.filePath === null ? "summary" : `${comment.filePath}:${comment.line ?? ""}`}</span>
              <span>{formatDateTime(comment.createdAt)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-primary">{comment.body ?? comment.bodyHash}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-b border-border bg-surface px-0 pb-3">
      <h2 className="text-base font-semibold text-primary">{title}</h2>
      <p className="mt-1 text-sm text-secondary">{subtitle}</p>
    </div>
  );
}

function formatTokenCost(tokenUsage: number | null, estimatedCostUsd: number | null): string {
  if (tokenUsage === null && estimatedCostUsd === null) {
    return "Pending";
  }

  const tokens = tokenUsage === null ? "tokens pending" : `${tokenUsage.toLocaleString()} tok`;
  const cost = estimatedCostUsd === null ? "cost pending" : `$${estimatedCostUsd.toFixed(2)}`;

  return `${tokens} / ${cost}`;
}
