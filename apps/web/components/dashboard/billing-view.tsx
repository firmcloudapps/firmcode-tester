import React from "react";
import type { WorkspaceBillingResponse } from "@firmcode/shared";
import { isAllowedExternalDashboardUrl } from "../../lib/dashboard-route-readiness";
import type { ViewState } from "../../lib/view-state";

interface BillingViewProps {
  state: ViewState<WorkspaceBillingResponse>;
  billingPortalUrl: string | null;
}

export function BillingView({ state, billingPortalUrl }: BillingViewProps) {
  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-semibold text-red-800">Billing could not be loaded</h2>
          <p className="mt-2 text-sm leading-6 text-red-700">{state.message}</p>
          <button
            className="mt-4 rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-secondary"
            type="button"
            disabled
            title="Billing management is unavailable until billing status loads."
          >
            Manage subscription
          </button>
        </section>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <BillingHeader />
        <section className="rounded-lg border border-border bg-surface p-6" aria-label="Loading billing">
          <div className="h-5 w-40 rounded bg-subtle" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {["plan", "runs", "tokens", "repositories", "seats", "status"].map((key) => (
              <div key={key} className="h-24 rounded-md bg-subtle" />
            ))}
          </div>
          <div className="mt-6 h-10 w-44 rounded-md bg-subtle" />
        </section>
      </div>
    );
  }

  const data = state.status === "populated" ? state.data : null;
  const canManage = data?.workspace.canManageBilling === true;
  const hasBillingPortal =
    billingPortalUrl !== null && isAllowedExternalDashboardUrl(billingPortalUrl, "clerk");

  return (
    <div className="space-y-4">
      <BillingHeader />
      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">Workspace plan</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
              Firmcode shows application usage for context while Clerk remains the source of truth for checkout, plans, invoices,
              and subscription changes.
            </p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-medium ${
              canManage ? "bg-green-50 text-success" : "bg-slate-100 text-secondary"
            }`}
          >
            {canManage ? "Billing management enabled" : "Billing management disabled"}
          </span>
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <BillingMetric label="Current plan" value={data?.plan.name ?? "Clerk managed"} />
          <BillingMetric label="Monthly review runs" value={formatNullableMetric(data?.usage.reviewRunsThisMonth, "runs")} />
          <BillingMetric label="AI tokens" value={formatNullableMetric(data?.usage.aiTokensThisMonth, "tokens")} />
          <BillingMetric label="Repositories" value={formatNullableMetric(data?.usage.repositoriesMonitored, "monitored")} />
          <BillingMetric label="Seats" value={formatNullableMetric(data?.usage.seats, "seats")} />
          <BillingMetric label="Billing status" value={formatBillingStatus(data?.plan.status)} />
        </dl>
        {canManage && hasBillingPortal ? (
          <a
            className="mt-6 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white"
            data-dashboard-destination="external"
            data-dashboard-provider="clerk"
            href={billingPortalUrl}
            rel="noreferrer"
          >
            Manage subscription
          </a>
        ) : (
          <button
            className="mt-6 inline-flex h-10 items-center rounded-md bg-slate-200 px-4 text-sm font-medium text-secondary"
            type="button"
            disabled
            title={canManage ? "Clerk billing portal URL is not configured." : "Admin or Clerk billing permission is required to manage subscriptions."}
          >
            Manage subscription
          </button>
        )}
      </section>
      {!canManage ? (
        <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <h2 className="text-sm font-semibold text-accent">Upgrade and plan changes</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">
            Developers can review current plan and usage context. Ask an Admin, or sign in with a Clerk-managed billing capability, to
            manage subscription changes.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function BillingHeader() {
  return (
    <div>
      <p className="text-sm font-medium text-accent">Billing</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">Subscription</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
        Plan, seat, and usage management are delegated to Clerk Billing for the MVP.
      </p>
    </div>
  );
}

function BillingMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-subtle p-3">
      <dt className="text-xs font-medium uppercase text-secondary">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-primary">{value}</dd>
    </div>
  );
}

function formatNullableMetric(value: number | null | undefined, suffix: string): string {
  return value === null || value === undefined ? "Clerk managed" : `${value.toLocaleString()} ${suffix}`;
}

function formatBillingStatus(status: WorkspaceBillingResponse["plan"]["status"] | undefined): string {
  return status === "managed_by_clerk" ? "Managed by Clerk" : "Clerk managed";
}
