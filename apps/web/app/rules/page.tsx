import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { RulesPoliciesView } from "../../components/dashboard/rules-policies-view";
import { loadRulesState } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface RulesPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function RulesPage({ searchParams = {} }: RulesPageProps) {
  const state = await loadRulesState(searchParams);

  return (
    <DashboardShell activeItem="Rules">
      <RulesPoliciesView state={state} />
    </DashboardShell>
  );
}
