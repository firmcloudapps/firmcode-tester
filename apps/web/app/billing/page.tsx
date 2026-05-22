import { loadWebClerkConfig } from "../../config/clerk";

export default function BillingPage() {
  const billingPortalUrl = tryReadBillingPortalUrl();

  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-5xl rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-accent">Billing</p>
          <h1 className="text-2xl font-semibold tracking-normal text-primary">Subscription</h1>
          <p className="max-w-2xl text-sm leading-6 text-secondary">
            Plan, seat, and usage management are delegated to Clerk Billing for the MVP.
          </p>
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-subtle p-3">
            <dt className="text-xs font-medium uppercase text-secondary">Plan</dt>
            <dd className="mt-1 font-mono text-sm text-primary">Clerk managed</dd>
          </div>
          <div className="rounded-md border border-border bg-subtle p-3">
            <dt className="text-xs font-medium uppercase text-secondary">Usage</dt>
            <dd className="mt-1 font-mono text-sm text-primary">Portal</dd>
          </div>
          <div className="rounded-md border border-border bg-subtle p-3">
            <dt className="text-xs font-medium uppercase text-secondary">Seats</dt>
            <dd className="mt-1 font-mono text-sm text-primary">Portal</dd>
          </div>
        </dl>
        <a
          className="mt-6 inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white"
          href={billingPortalUrl ?? "#"}
          aria-disabled={billingPortalUrl ? undefined : true}
        >
          Manage subscription
        </a>
      </section>
    </main>
  );
}

function tryReadBillingPortalUrl(): string | null {
  try {
    return loadWebClerkConfig(process.env).billingPortalUrl;
  } catch {
    return null;
  }
}
