import React from "react";
import type { WorkspaceBillingResponse } from "@firmcode/shared";
import type { ViewState } from "../../lib/view-state";

interface BillingViewProps {
  state: ViewState<WorkspaceBillingResponse>;
  billingPortalUrl: string | null;
}

export function BillingView({ state, billingPortalUrl }: BillingViewProps) {
  if (state.status === "error") {
    return (
      <BillingShell>
        <section className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-semibold text-red-800">Billing could not be loaded</h2>
          <p className="mt-2 text-sm leading-6 text-red-700">{state.message}</p>
          <button className="mt-4 rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-secondary" type="button" disabled>
            Manage subscription
          </button>
        </section>
      </BillingShell>
    );
  }

  const data = state.status === "populated" ? state.data : null;

  return (
    <BillingShell>
      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-accent">Billing</p>
          <h1 className="text-2xl font-semibold tracking-normal text-primary">Subscription</h1>
          <p className="max-w-2xl text-sm leading-6 text-secondary">
            Plan, seat, and usage management are delegated to Clerk Billing for the MVP.
          </p>
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <BillingMetric label="Plan" value={data?.plan.name ?? "Clerk managed"} />
          <BillingMetric label="Usage" value={formatNullableMetric(data?.usage.reviewRunsThisMonth, "runs")} />
          <BillingMetric label="Seats" value={formatNullableMetric(data?.usage.seats, "seats")} />
        </dl>
        {data?.workspace.canManageBilling === true && billingPortalUrl !== null ? (
          <a className="mt-6 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white" href={billingPortalUrl}>
            Manage subscription
          </a>
        ) : (
          <button className="mt-6 inline-flex h-10 items-center rounded-md bg-slate-200 px-4 text-sm font-medium text-secondary" type="button" disabled>
            Manage subscription
          </button>
        )}
      </section>
    </BillingShell>
  );
}

function BillingShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen px-6 py-8">{children}</main>;
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
  return value === null || value === undefined ? "Portal" : `${value.toLocaleString()} ${suffix}`;
}
