import React from "react";
import { DEFAULT_REVIEW_LIMITS, createHealthResponse } from "@firmcode/shared";

export function HealthSummary() {
  const health = createHealthResponse("web");

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-accent">Review operations</p>
        <h1 className="text-2xl font-semibold tracking-normal text-primary">Awaiting first review run</h1>
        <p className="max-w-2xl text-sm leading-6 text-secondary">
          Service health is available and the dashboard shell is ready to show repository activity, findings, and
          review run status as the pipeline comes online.
        </p>
      </div>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-subtle p-3">
          <dt className="text-xs font-medium uppercase text-secondary">Service</dt>
          <dd className="mt-1 font-mono text-sm text-primary">{health.service}</dd>
        </div>
        <div className="rounded-md border border-border bg-subtle p-3">
          <dt className="text-xs font-medium uppercase text-secondary">Status</dt>
          <dd className="mt-1 font-mono text-sm text-success">{health.status}</dd>
        </div>
        <div className="rounded-md border border-border bg-subtle p-3">
          <dt className="text-xs font-medium uppercase text-secondary">Inline cap</dt>
          <dd className="mt-1 font-mono text-sm text-primary">{DEFAULT_REVIEW_LIMITS.maxInlineComments}</dd>
        </div>
      </dl>
    </section>
  );
}
