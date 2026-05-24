import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { RulesPoliciesView } from "../../components/dashboard/rules-policies-view";

export default function RulesLoading() {
  return (
    <DashboardShell activeItem="Rules">
      <RulesPoliciesView state={{ status: "loading" }} />
    </DashboardShell>
  );
}
