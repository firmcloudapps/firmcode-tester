import React from "react";
import type { RepositoryListResponse } from "@firmcode/shared";
import type { ViewState } from "../../lib/view-state";
import { RepositoryAutomationToggle } from "./repository-automation-toggle";
import { BooleanBadge, StatusBadge } from "./status-badge";
import { formatDateTime, shortSha } from "./format";

interface RepositoriesViewProps {
  state: ViewState<RepositoryListResponse>;
}

export function RepositoriesView({ state }: RepositoriesViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Repositories</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">Repository review coverage</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
            Inspect GitHub repositories, automation status, and the most recent review activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="cursor-not-allowed rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-secondary opacity-75"
            type="button"
            disabled
            title="GitHub repository sync is not wired yet"
          >
            Sync GitHub
          </button>
          <button
            className="cursor-not-allowed rounded-md bg-accent px-3 py-2 text-sm font-medium text-white opacity-70"
            type="button"
            disabled
            title="GitHub App connection is not wired to an install flow yet"
          >
            Connect GitHub App
          </button>
        </div>
      </div>
      <RepositoryFilters />
      {state.status === "loading" ? <RepositoryLoadingState /> : null}
      {state.status === "error" ? <RepositoryErrorState message={state.message} /> : null}
      {state.status === "empty" ? <RepositoryEmptyState /> : null}
      {state.status === "populated" ? <RepositoryTable data={state.data} /> : null}
    </div>
  );
}

function RepositoryFilters() {
  return (
    <form className="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-5" action="/repositories">
      <label className="flex flex-col gap-1 text-sm font-medium text-primary">
        Automation
        <select className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary" name="enabled">
          <option value="">Any</option>
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-primary">
        Visibility
        <select className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary" name="private">
          <option value="">Any</option>
          <option value="false">Public</option>
          <option value="true">Private</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-primary md:col-span-2">
        Language
        <input
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary"
          name="language"
          placeholder="TypeScript"
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

function RepositoryLoadingState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Loading repositories">
      <div className="h-5 w-48 rounded bg-subtle" />
      <div className="mt-4 grid gap-3">
        {["one", "two", "three"].map((key) => (
          <div key={key} className="h-12 rounded-md bg-subtle" />
        ))}
      </div>
    </section>
  );
}

function RepositoryErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-800">Repositories could not be loaded</h2>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
    </section>
  );
}

function RepositoryEmptyState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-primary">No repositories yet</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">
        Connect the GitHub App or loosen the filters to see repositories available to this workspace.
      </p>
    </section>
  );
}

function RepositoryTable({ data }: { data: RepositoryListResponse }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-subtle text-left text-xs font-semibold uppercase text-secondary">
            <tr>
              <th className="px-4 py-3">Repository</th>
              <th className="px-4 py-3">Default branch</th>
              <th className="px-4 py-3">Visibility</th>
              <th className="px-4 py-3">Review automation</th>
              <th className="px-4 py-3">Last review</th>
              <th className="px-4 py-3">Open findings</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.repositories.map((repository) => (
              <tr key={repository.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-primary">{repository.fullName}</div>
                  <div className="mt-1 font-mono text-xs text-secondary">{repository.primaryLanguage ?? "language pending"}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-primary">{repository.defaultBranch}</td>
                <td className="px-4 py-3 text-primary">{repository.private ? "Private" : "Public"}</td>
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    <BooleanBadge enabled={repository.enabled} />
                    <RepositoryAutomationToggle repositoryId={repository.id} initialEnabled={repository.enabled} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  {repository.lastReview === null ? (
                    <span className="text-secondary">No review yet</span>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a className="font-medium text-accent" href={`/review-runs/${repository.lastReview.reviewRunId}`}>
                          PR #{repository.lastReview.pullRequestNumber}
                        </a>
                        <StatusBadge status={repository.lastReview.status} />
                      </div>
                      <div className="font-mono text-xs text-secondary">
                        {shortSha(repository.lastReview.headSha)} · {formatDateTime(repository.lastReview.createdAt)}
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-sm text-primary">{repository.openFindingsCount}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="cursor-not-allowed rounded-md border border-border px-2 py-1 text-xs font-medium text-secondary opacity-70"
                      type="button"
                      disabled
                      title="Repository detail configuration page is not wired yet"
                    >
                      Configure
                    </button>
                    <a
                      className="rounded-md border border-border px-2 py-1 text-xs font-medium text-primary"
                      href={`/review-runs?repositoryId=${encodeURIComponent(repository.id)}`}
                    >
                      View runs
                    </a>
                    <button
                      className="cursor-not-allowed rounded-md border border-border px-2 py-1 text-xs font-medium text-secondary opacity-70"
                      type="button"
                      disabled
                      title="Repository sync is not wired yet"
                    >
                      Sync
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
