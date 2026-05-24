import React from "react";
import {
  canManageSensitiveWorkspaceSettings,
  type DashboardWorkspaceRole,
  type WorkspaceSettingsResponse
} from "@firmcode/shared";
import type { ViewState } from "../../lib/view-state";
import { formatDateTime } from "./format";

export const SETTINGS_TABS = [
  { key: "general", label: "General" },
  { key: "github-app", label: "GitHub App" },
  { key: "members", label: "Members" },
  { key: "api-keys", label: "API Keys" },
  { key: "data-retention", label: "Data Retention" },
  { key: "notifications", label: "Notifications" }
] as const;

export type SettingsTabKey = (typeof SETTINGS_TABS)[number]["key"];

interface SettingsViewProps {
  state: ViewState<WorkspaceSettingsResponse>;
  activeTab: SettingsTabKey;
}

export function SettingsView({ state, activeTab }: SettingsViewProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-accent">Settings</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">Workspace settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
          Manage the Firmcode-owned workspace surfaces while Clerk owns identity, members, and billing.
        </p>
      </div>
      <SettingsTabs activeTab={activeTab} />
      {state.status === "loading" ? <SettingsLoadingState /> : null}
      {state.status === "error" ? <SettingsErrorState message={state.message} /> : null}
      {state.status === "empty" ? <SettingsContent data={state.data} activeTab={activeTab} empty /> : null}
      {state.status === "populated" ? <SettingsContent data={state.data} activeTab={activeTab} /> : null}
    </div>
  );
}

export function parseSettingsTab(value: string | string[] | undefined): SettingsTabKey {
  const candidate = Array.isArray(value) ? value[0] : value;
  return SETTINGS_TABS.some((tab) => tab.key === candidate) ? (candidate as SettingsTabKey) : "general";
}

function SettingsTabs({ activeTab }: { activeTab: SettingsTabKey }) {
  return (
    <nav className="overflow-x-auto rounded-lg border border-border bg-surface p-1" aria-label="Settings">
      <div className="flex min-w-max gap-1">
        {SETTINGS_TABS.map((tab) => {
          const active = tab.key === activeTab;

          return (
            <a
              key={tab.key}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                active ? "bg-blush text-accent" : "text-secondary hover:bg-subtle hover:text-primary"
              }`}
              href={`/settings?tab=${tab.key}`}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function SettingsLoadingState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Loading settings">
      <div className="h-5 w-52 rounded bg-subtle" />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {["one", "two", "three"].map((key) => (
          <div key={key} className="h-28 rounded-md bg-subtle" />
        ))}
      </div>
      <div className="mt-4 h-44 rounded-md bg-subtle" />
    </section>
  );
}

function SettingsErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-800">Settings could not be loaded</h2>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
    </section>
  );
}

function SettingsContent({
  data,
  activeTab,
  empty = false
}: {
  data?: WorkspaceSettingsResponse;
  activeTab: SettingsTabKey;
  empty?: boolean;
}) {
  if (data === undefined) {
    return (
      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-primary">No settings data is available</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">
          Connect Clerk workspace headers to load Firmcode-owned workspace settings.
        </p>
      </section>
    );
  }

  const canManage = data.workspace.canManageSensitiveSettings;

  return (
    <div className="space-y-4">
      <RoleNotice role={data.workspace.role} canManage={canManage} />
      {empty ? <EmptyInstallNotice /> : null}
      {activeTab === "general" ? <GeneralPanel data={data} /> : null}
      {activeTab === "github-app" ? <GitHubAppPanel data={data} /> : null}
      {activeTab === "members" ? <MembersPanel data={data} /> : null}
      {activeTab === "api-keys" ? <ApiKeysPanel data={data} /> : null}
      {activeTab === "data-retention" ? <DataRetentionPanel data={data} /> : null}
      {activeTab === "notifications" ? <NotificationsPanel data={data} /> : null}
    </div>
  );
}

function RoleNotice({ role, canManage }: { role: DashboardWorkspaceRole; canManage: boolean }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-primary">Workspace role</h2>
          <p className="mt-1 text-sm leading-6 text-secondary">
            You are signed in as <span className="font-medium text-primary">{formatRole(role)}</span>.
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-medium ${
            canManage ? "bg-green-50 text-success" : "bg-slate-100 text-secondary"
          }`}
        >
          {canManage ? "Sensitive settings enabled" : "Read-only sensitive settings"}
        </span>
      </div>
    </section>
  );
}

function EmptyInstallNotice() {
  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <h2 className="text-sm font-semibold text-accent">No GitHub App installation mapped yet</h2>
      <p className="mt-2 text-sm leading-6 text-secondary">
        Firmcode can show workspace settings before a GitHub installation exists; repository controls appear after the app is connected.
      </p>
    </section>
  );
}

function GeneralPanel({ data }: { data: WorkspaceSettingsResponse }) {
  return (
    <SettingsPanel title="General" description="Workspace identity is sourced from Clerk and linked to Firmcode application state.">
      <dl className="grid gap-3 sm:grid-cols-3">
        <MetadataCard label="Workspace" value={data.workspace.name} />
        <MetadataCard label="Workspace ID" value={data.workspace.id} monospace />
        <MetadataCard label="Clerk organization" value={data.workspace.clerkOrgId ?? "Personal workspace"} monospace />
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href={data.clerk.userProfileUrl}>
          Open Clerk profile
        </a>
        <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href={data.clerk.organizationProfileUrl}>
          Open Clerk organization
        </a>
      </div>
    </SettingsPanel>
  );
}

function GitHubAppPanel({ data }: { data: WorkspaceSettingsResponse }) {
  const canManage = data.workspace.canManageSensitiveSettings;

  return (
    <SettingsPanel
      title="GitHub App"
      description="Firmcode stores the workspace mapping and sends repository review configuration to the Repositories page."
    >
      <div className="flex flex-wrap gap-2">
        {canManage ? (
          <button
            className="cursor-not-allowed rounded-md bg-accent px-3 py-2 text-sm font-medium text-white opacity-70"
            type="button"
            disabled
            title="GitHub App connection is not wired to an install flow yet"
          >
            Connect GitHub App
          </button>
        ) : (
          <button className="rounded-md bg-mist px-3 py-2 text-sm font-medium text-secondary" type="button" disabled>
            Connect GitHub App
          </button>
        )}
        <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href={data.githubApp.repositoryConfigurationUrl}>
          Repository configuration
        </a>
      </div>
      <div className="mt-4 grid gap-3">
        {data.githubApp.installations.length === 0 ? (
          <p className="rounded-md border border-border bg-subtle p-3 text-sm text-secondary">No installation is mapped to this workspace.</p>
        ) : (
          data.githubApp.installations.map((installation) => (
            <article key={installation.id} className="rounded-md border border-border bg-subtle p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-medium text-primary">{installation.accountLogin ?? `Installation ${installation.installationId}`}</h3>
                  <p className="mt-1 text-sm text-secondary">
                    {installation.enabledRepositoryCount} of {installation.repositoryCount} repositories have review automation enabled.
                  </p>
                  <p className="mt-1 font-mono text-xs text-secondary">installation:{installation.installationId}</p>
                </div>
                <button
                  className="w-fit rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-secondary disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled
                >
                  Disconnect
                </button>
              </div>
              <p className="mt-3 text-xs text-secondary">Updated {formatDateTime(installation.updatedAt)}</p>
            </article>
          ))
        )}
      </div>
    </SettingsPanel>
  );
}

function MembersPanel({ data }: { data: WorkspaceSettingsResponse }) {
  const canManage = data.workspace.canManageSensitiveSettings;

  return (
    <SettingsPanel title="Members" description="Clerk owns member invitations, removals, profile details, and organization roles.">
      <div className="flex flex-wrap gap-2">
        {canManage ? (
          <a className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" href={data.clerk.memberManagementUrl}>
            Open Clerk members
          </a>
        ) : (
          <button className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-secondary" type="button" disabled>
            Open Clerk members
          </button>
        )}
        <a className="rounded-md border border-border px-3 py-2 text-sm font-medium text-primary" href={data.clerk.organizationProfileUrl}>
          View organization
        </a>
      </div>
      <p className="mt-4 rounded-md border border-border bg-subtle p-3 text-sm leading-6 text-secondary">
        Firmcode reads the active workspace membership for authorization and leaves member lifecycle workflows in Clerk.
      </p>
    </SettingsPanel>
  );
}

function ApiKeysPanel({ data }: { data: WorkspaceSettingsResponse }) {
  const canManage = data.workspace.canManageSensitiveSettings;

  return (
    <SettingsPanel title="API Keys" description="Workspace API keys are intentionally placeholder-only until scoped token storage is implemented.">
      <p className="rounded-md border border-border bg-subtle p-3 text-sm leading-6 text-secondary">{data.apiKeys.message}</p>
      <button
        className="mt-4 rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-secondary disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        disabled={!canManage || !data.apiKeys.enabled}
      >
        Create API key
      </button>
    </SettingsPanel>
  );
}

function DataRetentionPanel({ data }: { data: WorkspaceSettingsResponse }) {
  const canManage = data.workspace.canManageSensitiveSettings;
  const retentionRows = [
    ["Default artifacts", `${data.retention.artifactRetentionDays} days`],
    ["Changed file patches", `${data.retention.changedFilePatchDays} days`],
    ["Full changed snapshots", `${data.retention.fullSnapshotDays} days`],
    ["CI logs", `${data.retention.ciLogDays} days`],
    ["LLM prompts and responses", `${data.retention.llmArtifactDays} days`],
    ["Semgrep JSON", `${data.retention.semgrepArtifactDays} days`],
    ["Tree-sitter artifacts", `${data.retention.treeSitterArtifactDays} days`],
    ["Finding metadata", `${data.retention.findingMetadataDays} days`],
    ["Aggregated metrics", `${data.retention.aggregatedMetricDays} days`]
  ];

  return (
    <SettingsPanel title="Data Retention" description="Retention defaults follow Firmcode privacy policy and avoid long-lived raw artifacts.">
      <div className="overflow-hidden rounded-md border border-border">
        <dl className="divide-y divide-border">
          {retentionRows.map(([label, value]) => (
            <div key={label} className="grid gap-1 bg-surface px-3 py-2 text-sm sm:grid-cols-[1fr_160px]">
              <dt className="text-secondary">{label}</dt>
              <dd className="font-mono text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <label className="mt-4 flex max-w-sm flex-col gap-1 text-sm font-medium text-primary">
        Default artifact retention
        <select
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary disabled:bg-subtle disabled:text-secondary"
          defaultValue={String(data.retention.artifactRetentionDays)}
          disabled={!canManage}
          aria-disabled={!canManage}
        >
          <option value={String(data.retention.artifactRetentionDays)}>{data.retention.artifactRetentionDays} days</option>
        </select>
      </label>
    </SettingsPanel>
  );
}

function NotificationsPanel({ data }: { data: WorkspaceSettingsResponse }) {
  const canManage = canManageSensitiveWorkspaceSettings(data.workspace.role);

  return (
    <SettingsPanel title="Notifications" description="Delivery hooks are reserved for focused alerts once review signal quality is stable.">
      <p className="rounded-md border border-border bg-subtle p-3 text-sm leading-6 text-secondary">{data.notifications.message}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TogglePlaceholder label="Email notifications" disabled={!canManage || !data.notifications.enabled} />
        <TogglePlaceholder label="Slack notifications" disabled={!canManage || !data.notifications.enabled} />
      </div>
    </SettingsPanel>
  );
}

function TogglePlaceholder({ label, disabled }: { label: string; disabled: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3 text-sm font-medium text-primary">
      {label}
      <input className="h-4 w-4" type="checkbox" disabled={disabled} />
    </label>
  );
}

function SettingsPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">{description}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MetadataCard({ label, value, monospace = false }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-subtle p-3">
      <dt className="text-xs font-medium uppercase text-secondary">{label}</dt>
      <dd className={`mt-1 break-words text-sm text-primary ${monospace ? "font-mono" : "font-medium"}`}>{value}</dd>
    </div>
  );
}

function formatRole(role: DashboardWorkspaceRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
