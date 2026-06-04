import { DeveloperDashboardShell } from "../../../components/dashboard/developer-dashboard-shell";
import { RulesPoliciesView } from "../../../components/dashboard/rules-policies-view";

export default function RulesLoading() {
  return (
    <DeveloperDashboardShell activeItem="Rules">
      <RulesPoliciesView state={{ status: "loading" }} />
    </DeveloperDashboardShell>
  );
}
