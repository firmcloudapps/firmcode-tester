import { HealthSummary } from "../components/health-summary";

export default function Page() {
  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <HealthSummary />
      </div>
    </main>
  );
}
