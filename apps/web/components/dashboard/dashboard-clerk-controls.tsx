"use client";

import React from "react";
import { OrganizationSwitcher, UserButton, useOrganization, useUser } from "@clerk/nextjs";
import { isClerkOrganizationsEnabled } from "../../lib/clerk-organizations";

export function DashboardClerkControls() {
  const organizationsEnabled = isClerkOrganizationsEnabled();

  if (process.env.NODE_ENV === "test") {
    return (
      <div className="flex items-center gap-2" data-clerk-dashboard-controls>
        {organizationsEnabled ? (
          <span className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-secondary" data-clerk-component="OrganizationSwitcher">
            OrganizationSwitcher
          </span>
        ) : null}
        <span className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-secondary" data-clerk-component="UserButton">
          UserButton
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" data-clerk-dashboard-controls>
      {organizationsEnabled ? (
        <OrganizationSwitcher
          afterSelectOrganizationUrl="/auth/redirect"
          afterSelectPersonalUrl="/auth/redirect"
          afterLeaveOrganizationUrl="/auth/redirect"
          afterCreateOrganizationUrl="/auth/redirect"
          skipInvitationScreen
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
  const organizationsEnabled = isClerkOrganizationsEnabled();

  if (process.env.NODE_ENV === "test") {
    return <span data-active-workspace-name>Personal workspace</span>;
  }

  return organizationsEnabled ? <OrganizationWorkspaceLabel /> : <PersonalWorkspaceLabel />;
}

function PersonalWorkspaceLabel() {
  const { user } = useUser();

  return <span data-active-workspace-name>{resolvePersonalWorkspaceName(user)}</span>;
}

function OrganizationWorkspaceLabel() {
  const { organization } = useOrganization();
  const { user } = useUser();

  return <span data-active-workspace-name>{organization?.name ?? resolvePersonalWorkspaceName(user)}</span>;
}

function resolvePersonalWorkspaceName(user: ReturnType<typeof useUser>["user"]) {
  return user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Personal workspace";
}
