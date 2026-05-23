import React from "react";
import type { ReviewRunListResponse } from "@firmcode/shared";
import type { ViewState } from "../../lib/view-state";
import { formatDateTime, formatDuration, shortSha } from "./format";
import { RetryReviewRunButton } from "./retry-review-run-button";
import { StatusBadge } from "./status-badge";

interface ReviewRunsViewProps {
  state: ViewState<ReviewRunListResponse>;
}

export function ReviewRunsView({ state }: ReviewRunsViewProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-accent">Review Runs</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">Pipeline executions</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
          Filter review jobs by repository, status, trigger, risk, and date while keeping the current pipeline stage visible.
        </p>
      </div>
      <ReviewRunFilters />
      {state.status === "loading" ? <ReviewRunLoadingState /> : null}
      {state.status === "error" ? <ReviewRunErrorState message={state.message} /> : null}
      {state.status === "empty" ? <ReviewRunEmptyState /> : null}
      {state.status === "populated" ? <ReviewRunTable data={state.data} /> : null}
    </div>
  );
}

function ReviewRunFilters() {
  return (
    <form className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-6" action="/review-runs">
      <label className="flex flex-col gap-1 text-sm font-medium text-primary">
        Status
        <select className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary" name="status">
          <option value="">Any</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
          <option value="superseded">Superseded</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-primary md:col-span-2">
        Repository
        <input
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary"
          name="repository"
          placeholder="owner/repo"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-primary">
        Risk
        <select className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary" name="risk">
          <option value="">Any</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-primary">
        From
        <input className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary" name="dateFrom" type="date" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-primary">
        To
        <input className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary" name="dateTo" type="date" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-primary md:col-span-2">
        Trigger
        <input
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary"
          name="triggerEvent"
          placeholder="pull_request.opened"
        />
      </label>
      <div className="flex items-end md:col-span-4">
        <button className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white md:w-auto" type="submit">
          Apply filters
        </button>
      </div>
    </form>
  );
}

function ReviewRunLoadingState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Loading review runs">
      <div className="h-5 w-44 rounded bg-subtle" />
      <div className="mt-4 grid gap-3">
        {["one", "two", "three", "four"].map((key) => (
          <div key={key} className="h-12 rounded-md bg-subtle" />
        ))}
      </div>
    </section>
  );
}

function ReviewRunErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-800">Review runs could not be loaded</h2>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
    </section>
  );
}

function ReviewRunEmptyState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-primary">No review runs match these filters</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">
        New pull request webhooks create queued review runs as soon as repository automation is enabled.
      </p>
    </section>
  );
}

function ReviewRunTable({ data }: { data: ReviewRunListResponse }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-subtle text-left text-xs font-semibold uppercase text-secondary">
            <tr>
              <th className="px-4 py-3">Run ID</th>
              <th className="px-4 py-3">Repository</th>
              <th className="px-4 py-3">PR</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Pipeline stage</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Findings</th>
              <th className="px-4 py-3">Comments</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.reviewRuns.map((run) => (
              <tr key={run.id}>
                <td className="px-4 py-3 font-mono text-xs">
                  <a className="text-accent" href={`/review-runs/${run.id}`}>
                    {run.id.slice(0, 8)}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-primary">{run.repositoryFullName}</div>
                  <div className="mt-1 font-mono text-xs text-secondary">{shortSha(run.headSha)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-primary">#{run.pullRequestNumber}</div>
                  <div className="mt-1 max-w-xs truncate text-xs text-secondary">{run.pullRequestTitle}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3 text-primary">{run.currentStage}</td>
                <td className="px-4 py-3 font-mono text-xs text-primary">{formatDuration(run.durationMs)}</td>
                <td className="px-4 py-3 font-mono text-sm text-primary">{run.findingsCount}</td>
                <td className="px-4 py-3 font-mono text-sm text-primary">{run.commentsPostedCount}</td>
                <td className="px-4 py-3 text-secondary">{formatDateTime(run.startedAt ?? run.createdAt)}</td>
                <td className="px-4 py-3">
                  <RetryReviewRunButton compact reviewRunId={run.id} status={run.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
