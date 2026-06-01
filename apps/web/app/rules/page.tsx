import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { RulesPoliciesView } from "../../components/dashboard/rules-policies-view";
import { loadRulesState, resolveDashboardNavRole } from "../../lib/dashboard-data";

export const dynamic = "force-dynamic";

interface RulesPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function RulesPage({ searchParams = {} }: RulesPageProps) {
  const [state, role] = await Promise.all([loadRulesState(searchParams), resolveDashboardNavRole()]);

  return (
    <DashboardShell activeItem="Rules" role={role}>
      <RulesPoliciesView state={state} />
    </DashboardShell>
  );
}
