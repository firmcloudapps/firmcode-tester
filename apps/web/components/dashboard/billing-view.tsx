import React from "react";
import type { WorkspaceBillingResponse } from "@firmcode/shared";
import type { ViewState } from "../../lib/view-state";

interface BillingViewProps {
  state: ViewState<WorkspaceBillingResponse>;
  billingPortalUrl: string | null;
}

export function BillingView({ state, billingPortalUrl }: BillingViewProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-accent">Billing</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">Subscription and usage</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
          Firmcode shows workspace usage while Clerk Billing owns plans, seats, invoices, and subscription changes.
        </p>
      </div>
      {state.status === "loading" ? <BillingLoadingState /> : null}
      {state.status === "error" ? <BillingErrorState message={state.message} /> : null}
      {state.status === "empty" ? <BillingEmptyState /> : null}
      {state.status === "populated" ? <BillingContent data={state.data} billingPortalUrl={billingPortalUrl} /> : null}
    </div>
  );
}

function BillingLoadingState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Loading billing">
      <div className="h-5 w-56 rounded bg-subtle" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["plan", "runs", "tokens", "seats"].map((key) => (
          <div key={key} className="h-28 rounded-md bg-subtle" />
        ))}
      </div>
      <div className="mt-4 h-24 rounded-md bg-subtle" />
    </section>
  );
}

function BillingErrorState({ message }: { message: string }) {
  const denied = message.toLowerCase().includes("billing access requires");

  return (
    <section className={`rounded-lg border p-4 ${denied ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
      <h2 className={`text-sm font-semibold ${denied ? "text-amber-900" : "text-red-800"}`}>
        {denied ? "Billing access denied" : "Billing could not be loaded"}
      </h2>
      <p className={`mt-2 text-sm leading-6 ${denied ? "text-amber-800" : "text-red-700"}`}>{message}</p>
    </section>
  );
}

function BillingEmptyState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="text-lg font-semibold text-primary">No billing data is available</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">
        Connect Clerk workspace headers to load the Clerk-managed billing entry point and usage counters.
      </p>
    </section>
  );
}

function BillingContent({ data, billingPortalUrl }: { data: WorkspaceBillingResponse; billingPortalUrl: string | null }) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">{data.workspace.name}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">{data.plan.description}</p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-accent">
            {data.billingStatus.label}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {billingPortalUrl === null ? (
            <button
              className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-secondary disabled:cursor-not-allowed"
              type="button"
              disabled
            >
              Manage subscription
            </button>
          ) : (
            <a className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" href={billingPortalUrl}>
              Manage subscription
            </a>
          )}
          <span className="rounded-md border border-border bg-subtle px-3 py-2 text-sm text-secondary">
            Access: {formatAccess(data.workspace.billingAccessSource)}
          </span>
        </div>
        {billingPortalUrl === null ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
            Clerk Billing portal URL is not configured. Set CLERK_BILLING_PORTAL_URL to enable subscription management.
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Billing usage">
        <BillingMetric label="Current plan" value={data.plan.name} />
        <BillingMetric label="Monthly review runs" value={formatNumber(data.usage.monthlyReviewRuns)} />
        <BillingMetric label="AI tokens" value={formatNumber(data.usage.aiTokens)} />
        <BillingMetric label="Repositories" value={formatNumber(data.usage.repositories)} />
        <BillingMetric label="Seats" value={formatNumber(data.usage.seats)} />
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-primary">Usage period</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <BillingMetadata label="Starts" value={formatDate(data.usage.periodStart)} />
          <BillingMetadata label="Ends" value={formatDate(data.usage.periodEnd)} />
        </dl>
      </section>
    </div>
  );
}

function BillingMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase text-secondary">{label}</p>
      <p className="mt-2 break-words font-mono text-xl font-semibold text-primary">{value}</p>
    </article>
  );
}

function BillingMetadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-subtle p-3">
      <dt className="text-xs font-medium uppercase text-secondary">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-primary">{value}</dd>
    </div>
  );
}

function formatNumber(value: number | null): string {
  return value === null ? "Pending" : value.toLocaleString();
}

function formatDate(value: string | null): string {
  if (value === null) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatAccess(value: WorkspaceBillingResponse["workspace"]["billingAccessSource"]): string {
  return value === "clerk_billing_role" ? "Clerk billing role" : "workspace Owner/Admin";
}
