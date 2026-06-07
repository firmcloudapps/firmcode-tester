import React from "react";
import type { WorkspaceBillingResponse, WorkspaceSettingsResponse } from "@firmcode/shared";
import type { AdminOverviewData } from "../../lib/dashboard-data";
import type { ViewState } from "../../lib/view-state";
import { formatDateTime } from "./format";

interface AdminOverviewViewProps {
  state: ViewState<AdminOverviewData>;
}

export function AdminOverviewView({ state }: AdminOverviewViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Platform</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">Admin Overview</h1>
        </div>
        <p className="text-sm text-secondary">Platform configuration and subscription status</p>
      </div>
      {state.status === "error" ? <AdminOverviewError message={state.message} /> : null}
      {state.status === "populated" ? <AdminOverviewDashboard data={state.data} /> : null}
      {state.status === "loading" ? <AdminOverviewSkeleton /> : null}
    </div>
  );
}

function AdminOverviewDashboard({ data }: { data: AdminOverviewData }) {
  return (
    <div className="space-y-4">
      <GitHubAppCard settings={data.settings} />
      <div className="grid gap-4 xl:grid-cols-2">
        <WorkspaceCard settings={data.settings} />
        <BillingCard billing={data.billing} />
      </div>
    </div>
  );
}

function GitHubAppCard({ settings }: { settings: WorkspaceSettingsResponse }) {
  const { installations } = settings.githubApp;

  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="GitHub App installations">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="text-sm font-semibold text-primary">GitHub App Installations</h2>
        {settings.githubApp.installUrl ? (
          <a
            href={settings.githubApp.installUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-accent"
          >
            Manage
          </a>
        ) : null}
      </div>
      {installations.length === 0 ? (
        <p className="mt-3 text-sm text-secondary">No GitHub App installations found.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="text-left text-xs font-semibold uppercase text-secondary">
              <tr>
                <th className="pb-2 pr-4">Account</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Repositories</th>
                <th className="pb-2 pr-4">Enabled</th>
                <th className="pb-2">Last updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {installations.map((inst) => (
                <tr key={inst.id}>
                  <td className="py-2 pr-4 font-medium text-primary">{inst.accountLogin ?? "—"}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-secondary">{inst.accountType ?? "—"}</td>
                  <td className="py-2 pr-4 font-mono text-sm text-primary">{inst.repositoryCount}</td>
                  <td className="py-2 pr-4 font-mono text-sm text-primary">{inst.enabledRepositoryCount}</td>
                  <td className="py-2 text-xs text-secondary">{formatDateTime(inst.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function WorkspaceCard({ settings }: { settings: WorkspaceSettingsResponse }) {
  const rows: { label: string; value: string }[] = [
    { label: "Workspace", value: settings.workspace.name },
    { label: "Role", value: settings.workspace.role },
    { label: "Clerk org", value: settings.workspace.clerkOrgId ?? "—" },
    { label: "API keys", value: settings.apiKeys.enabled ? "Enabled" : settings.apiKeys.message },
    { label: "Notifications", value: settings.notifications.enabled ? "Enabled" : settings.notifications.message }
  ];

  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Workspace details">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="text-sm font-semibold text-primary">Workspace</h2>
        {settings.clerk.organizationProfileUrl ? (
          <a
            href={settings.clerk.organizationProfileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-accent"
          >
            Manage members
          </a>
        ) : null}
      </div>
      <dl className="mt-3 space-y-2">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-secondary">{label}</dt>
            <dd className="font-medium text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function BillingCard({ billing }: { billing: WorkspaceBillingResponse | null }) {
  if (billing === null) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4" aria-label="Billing">
        <h2 className="border-b border-border pb-3 text-sm font-semibold text-primary">Billing</h2>
        <p className="mt-3 text-sm text-secondary">Billing information could not be loaded.</p>
      </section>
    );
  }

  const usage: { label: string; value: string }[] = [
    { label: "Review runs this month", value: billing.usage.reviewRunsThisMonth?.toLocaleString() ?? "—" },
    { label: "AI tokens this month", value: billing.usage.aiTokensThisMonth?.toLocaleString() ?? "—" },
    { label: "Repositories monitored", value: billing.usage.repositoriesMonitored?.toLocaleString() ?? "—" },
    { label: "Seats", value: billing.usage.seats?.toLocaleString() ?? "—" }
  ];

  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Billing">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="text-sm font-semibold text-primary">Billing</h2>
        <span className="inline-flex rounded-md border border-border bg-subtle px-2 py-1 text-xs font-medium text-secondary">
          {billing.plan.name}
        </span>
      </div>
      <dl className="mt-3 space-y-2">
        {usage.map(({ label, value }) => (
          <div key={label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-secondary">{label}</dt>
            <dd className="font-mono font-medium text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AdminOverviewError({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-800">Overview could not be loaded</h2>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
    </section>
  );
}

function AdminOverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-40 rounded-lg border border-border bg-surface" />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-48 rounded-lg border border-border bg-surface" />
        <div className="h-48 rounded-lg border border-border bg-surface" />
      </div>
    </div>
  );
}
