import React from "react";
import type { OverviewDashboardData, OverviewMetric, OverviewQualityMetric } from "@firmcode/shared";
import type { ViewState } from "../../lib/view-state";
import {
  formatOverviewCount,
  formatOverviewSeverity,
  getRecentReviewRunHref
} from "../../lib/overview-data";
import { formatDateTime, formatDuration, shortSha } from "./format";
import { SeverityBadge, StatusBadge } from "./status-badge";

interface OverviewViewProps {
  state: ViewState<OverviewDashboardData>;
}

const metricToneClassName: Record<OverviewMetric["tone"], string> = {
  neutral: "text-secondary",
  info: "text-sky-700",
  success: "text-green-700",
  warning: "text-amber-700",
  critical: "text-red-700"
};

const attentionKindLabel: Record<OverviewDashboardData["needsAttention"][number]["kind"], string> = {
  failed_job: "Failed job",
  high_severity_finding: "High severity",
  ci_failure: "CI failure",
  incomplete_repository_configuration: "Configuration"
};

export function OverviewView({ state }: OverviewViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">Review operations</h1>
        </div>
        <p className="text-sm text-secondary">Last 7 days across monitored repositories</p>
      </div>
      {state.status === "loading" ? <OverviewLoadingState /> : null}
      {state.status === "error" ? <OverviewErrorState message={state.message} /> : null}
      {state.status === "empty" ? <OverviewEmptyState /> : null}
      {state.status === "populated" ? <OverviewDashboard data={state.data} /> : null}
    </div>
  );
}

function OverviewDashboard({ data }: { data: OverviewDashboardData }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Overview metrics">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.id} metric={metric} />
        ))}
      </section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <RecentReviewRunsTable data={data} />
        <NeedsAttentionPanel data={data} />
      </div>
      <section className="rounded-lg border border-border bg-surface p-4" aria-label="Review quality metrics">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-primary">Review Quality</h2>
          <span className="font-mono text-xs text-secondary">Updated {formatDateTime(data.generatedAt)}</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.qualityMetrics.map((metric) => (
            <QualityMetric key={metric.label} metric={metric} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ metric }: { metric: OverviewMetric }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-secondary">{metric.label}</h2>
          <p className="mt-2 font-mono text-3xl font-semibold text-primary">{formatOverviewCount(metric.value)}</p>
        </div>
        <TrendBars metric={metric} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="text-secondary">{metric.helper}</span>
        <span className={`font-medium ${metricToneClassName[metric.tone]}`}>{metric.changeLabel}</span>
      </div>
    </article>
  );
}

function TrendBars({ metric }: { metric: OverviewMetric }) {
  const max = Math.max(...metric.trend, 1);

  return (
    <div className="flex h-9 w-16 items-end justify-end gap-1" aria-hidden="true">
      {metric.trend.slice(-6).map((value, index) => (
        <span
          key={`${metric.id}-${index}`}
          className={`w-1.5 rounded-sm ${metric.tone === "critical" ? "bg-red-300" : "bg-blue-300"}`}
          style={{ height: `${Math.max(6, Math.round((value / max) * 36))}px` }}
        />
      ))}
    </div>
  );
}

function RecentReviewRunsTable({ data }: { data: OverviewDashboardData }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface" aria-label="Recent review runs">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-primary">Recent Review Runs</h2>
        <a className="text-sm font-medium text-accent" href="/review-runs">
          View all
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-subtle text-left text-xs font-semibold uppercase text-secondary">
            <tr>
              <th className="px-4 py-3">Repository</th>
              <th className="px-4 py-3">PR</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Findings</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Last updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.recentReviewRuns.map((run) => (
              <tr key={run.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-primary">{run.repositoryFullName}</div>
                  <div className="mt-1 font-mono text-xs text-secondary">{shortSha(run.headSha)}</div>
                </td>
                <td className="px-4 py-3">
                  <a className="font-medium text-accent" href={getRecentReviewRunHref(run)}>
                    #{run.pullRequestNumber}
                  </a>
                  <div className="mt-1 max-w-xs truncate text-xs text-secondary">{run.pullRequestTitle}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3">
                  <RiskBadge risk={run.riskLevel} />
                </td>
                <td className="px-4 py-3 font-mono text-sm text-primary">{formatOverviewCount(run.findingsCount)}</td>
                <td className="px-4 py-3 font-mono text-xs text-primary">{formatDuration(run.durationMs)}</td>
                <td className="px-4 py-3 font-mono text-xs text-primary">{run.triggerEvent}</td>
                <td className="px-4 py-3 text-secondary">{formatDateTime(run.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NeedsAttentionPanel({ data }: { data: OverviewDashboardData }) {
  return (
    <section className="rounded-lg border border-border bg-surface" aria-label="Needs attention">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-primary">Needs Attention</h2>
      </div>
      <div className="divide-y divide-border">
        {data.needsAttention.length === 0 ? (
          <div className="p-4 text-sm text-secondary">No urgent items.</div>
        ) : (
          data.needsAttention.map((item) => (
            <a key={item.id} className="block p-4 hover:bg-subtle" href={item.href}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-secondary">{attentionKindLabel[item.kind]}</p>
                  <h3 className="mt-1 text-sm font-semibold text-primary">{item.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-secondary">{item.detail}</p>
                </div>
                {item.severity === "none" ? (
                  <span className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {formatOverviewSeverity(item.severity)}
                  </span>
                ) : (
                  <SeverityBadge severity={item.severity} />
                )}
              </div>
              <p className="mt-2 font-mono text-xs text-secondary">{formatDateTime(item.updatedAt)}</p>
            </a>
          ))
        )}
      </div>
    </section>
  );
}

function QualityMetric({ metric }: { metric: OverviewQualityMetric }) {
  return (
    <div className="rounded-md border border-border bg-subtle p-3">
      <p className="text-xs font-medium uppercase text-secondary">{metric.label}</p>
      <p className={`mt-2 font-mono text-lg font-semibold ${metricToneClassName[metric.tone]}`}>{metric.value}</p>
      <p className="mt-1 text-xs text-secondary">{metric.helper}</p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const className =
    risk === "high"
      ? "border-red-200 bg-red-50 text-red-700"
      : risk === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>{risk}</span>;
}

function OverviewLoadingState() {
  return (
    <section className="space-y-4" aria-label="Loading overview">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["one", "two", "three", "four"].map((key) => (
          <div key={key} className="h-32 rounded-lg border border-border bg-surface p-4">
            <div className="h-4 w-32 rounded bg-subtle" />
            <div className="mt-5 h-8 w-20 rounded bg-subtle" />
            <div className="mt-5 h-3 w-full rounded bg-subtle" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-72 rounded-lg border border-border bg-surface" />
        <div className="h-72 rounded-lg border border-border bg-surface" />
      </div>
    </section>
  );
}

function OverviewErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-800">Overview could not be loaded</h2>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
    </section>
  );
}

function OverviewEmptyState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-primary">No review activity yet</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">
        No repository review activity is available for this workspace.
      </p>
    </section>
  );
}
