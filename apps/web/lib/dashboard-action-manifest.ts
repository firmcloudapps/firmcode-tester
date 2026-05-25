import { DASHBOARD_NAV_ITEMS } from "./dashboard-navigation";
import type { DashboardExternalProvider } from "./dashboard-route-readiness";

export type DashboardActionStatus = "active" | "planned-disabled";
export type DashboardActionDestination = "internal" | "external" | "none";

export interface DashboardRouteAction {
  readonly surface:
    | "sidebar"
    | "topbar"
    | "overview"
    | "repositories"
    | "settings"
    | "billing"
    | "github-installations";
  readonly label: string;
  readonly status: DashboardActionStatus;
  readonly destination: DashboardActionDestination;
  readonly href?: string;
  readonly provider?: DashboardExternalProvider;
  readonly title?: string;
}

export const DASHBOARD_ROUTE_ACTIONS: readonly DashboardRouteAction[] = [
  ...DASHBOARD_NAV_ITEMS.map((item) => ({
    surface: "sidebar" as const,
    label: item.label,
    status: item.enabled ? ("active" as const) : ("planned-disabled" as const),
    destination: item.enabled ? ("internal" as const) : ("none" as const),
    href: item.enabled ? item.href : undefined,
    title: item.disabledTitle
  })),
  { surface: "topbar", label: "Connect GitHub", status: "active", destination: "internal", href: "/github/installations" },
  { surface: "overview", label: "Pull requests", status: "active", destination: "internal", href: "/pull-requests" },
  { surface: "overview", label: "View all review runs", status: "active", destination: "internal", href: "/review-runs" },
  { surface: "overview", label: "High severity findings", status: "active", destination: "internal", href: "/findings?severity=high" },
  { surface: "overview", label: "CI failures", status: "active", destination: "internal", href: "/ci-failures" },
  { surface: "overview", label: "Incomplete repository configuration", status: "active", destination: "internal", href: "/repositories" },
  { surface: "repositories", label: "Connect GitHub OAuth", status: "active", destination: "internal", href: "/auth/github" },
  { surface: "repositories", label: "Connect GitHub App", status: "active", destination: "internal", href: "/github/installations" },
  { surface: "repositories", label: "Manage GitHub App", status: "active", destination: "internal", href: "/github/installations" },
  { surface: "repositories", label: "Configure", status: "active", destination: "internal", href: "/repositories/[id]?tab=configuration" },
  { surface: "repositories", label: "View runs", status: "active", destination: "internal", href: "/review-runs?repositoryId=[id]" },
  { surface: "settings", label: "Connect GitHub App", status: "active", destination: "internal", href: "/github/installations" },
  { surface: "settings", label: "Repository configuration", status: "active", destination: "internal", href: "/repositories" },
  {
    surface: "settings",
    label: "Open Clerk profile",
    status: "active",
    destination: "external",
    provider: "clerk",
    href: "https://accounts.clerk.example/user"
  },
  {
    surface: "settings",
    label: "Open Clerk organization",
    status: "active",
    destination: "external",
    provider: "clerk",
    href: "https://accounts.clerk.example/organization"
  },
  {
    surface: "settings",
    label: "Open Clerk members",
    status: "active",
    destination: "external",
    provider: "clerk",
    href: "https://accounts.clerk.example/members"
  },
  {
    surface: "settings",
    label: "Create API key",
    status: "planned-disabled",
    destination: "none",
    title: "Workspace API keys are planned and not enabled in the MVP."
  },
  {
    surface: "settings",
    label: "Slack notifications",
    status: "planned-disabled",
    destination: "none",
    title: "Slack notifications are planned and not enabled in the MVP."
  },
  {
    surface: "billing",
    label: "Manage subscription",
    status: "active",
    destination: "external",
    provider: "clerk",
    href: "https://accounts.clerk.example/billing"
  },
  {
    surface: "github-installations",
    label: "Install GitHub App",
    status: "active",
    destination: "external",
    provider: "github",
    href: "https://github.com/apps/firmcode/installations/new"
  },
  {
    surface: "github-installations",
    label: "Configure",
    status: "active",
    destination: "internal",
    href: "/repositories/[id]?tab=configuration"
  },
  {
    surface: "github-installations",
    label: "Run",
    status: "planned-disabled",
    destination: "none",
    title: "Manual review runs are planned"
  }
] as const;
