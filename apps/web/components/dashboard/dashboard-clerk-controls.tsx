"use client";

import React from "react";
import { OrganizationSwitcher, UserButton, useOrganization, useUser } from "@clerk/nextjs";

export function DashboardClerkControls() {
  if (process.env.NODE_ENV === "test") {
    return (
      <div className="flex items-center gap-2" data-clerk-dashboard-controls>
        <span className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-secondary" data-clerk-component="OrganizationSwitcher">
          OrganizationSwitcher
        </span>
        <span className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-secondary" data-clerk-component="UserButton">
          UserButton
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" data-clerk-dashboard-controls>
      {process.env.NEXT_PUBLIC_CLERK_ORGANIZATIONS_ENABLED !== "false" ? (
        <OrganizationSwitcher
          afterSelectOrganizationUrl="/"
          afterLeaveOrganizationUrl="/"
          afterCreateOrganizationUrl="/"
          appearance={{
            elements: {
              organizationSwitcherTrigger: "rounded-md border border-border bg-surface px-2 py-1 shadow-sm"
            }
          }}
        />
      ) : null}
      <UserButton afterSignOutUrl="/sign-in" />
    </div>
  );
}

export function DashboardWorkspaceLabel() {
  if (process.env.NODE_ENV === "test") {
    return <span data-active-workspace-name>Personal workspace</span>;
  }

  return <ResolvedWorkspaceLabel />;
}

function ResolvedWorkspaceLabel() {
  const { organization } = useOrganization();
  const { user } = useUser();
  const personalName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Personal workspace";

  return <span data-active-workspace-name>{organization?.name ?? personalName}</span>;
}
