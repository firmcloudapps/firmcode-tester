"use client";

import React from "react";
import type { DashboardWorkspaceRole, WorkspaceSettingsMember } from "@firmcode/shared";
import {
  createPendingActionGuard,
  updateWorkspaceMemberRole,
  updateWorkspaceMemberStatus
} from "../../lib/dashboard-actions";
import { formatDateTime } from "./format";

interface WorkspaceMembersManagerProps {
  members: WorkspaceSettingsMember[];
  canManage: boolean;
}

type Feedback = { tone: "success" | "error"; message: string } | null;

export function WorkspaceMembersManager({ members, canManage }: WorkspaceMembersManagerProps) {
  const guardRef = React.useRef(createPendingActionGuard());
  const [workspaceMembers, setWorkspaceMembers] = React.useState(members);
  const [pendingMemberId, setPendingMemberId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<Feedback>(null);

  async function mutateMember(clerkUserId: string, action: () => Promise<WorkspaceSettingsMember>, successMessage: string) {
    if (!canManage || guardRef.current.isPending) {
      return;
    }

    setPendingMemberId(clerkUserId);
    setFeedback(null);

    try {
      const updated = await guardRef.current.run(action);
      setWorkspaceMembers((current) =>
        current.map((member) => (member.clerkUserId === updated.clerkUserId ? updated : member))
      );
      setFeedback({ tone: "success", message: successMessage });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Workspace member could not be updated."
      });
    } finally {
      setPendingMemberId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-[760px] divide-y divide-border text-left text-sm">
          <thead className="bg-subtle text-xs uppercase text-secondary">
            <tr>
              <th className="px-3 py-2 font-semibold">User</th>
              <th className="px-3 py-2 font-semibold">Role</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Updated</th>
              <th className="px-3 py-2 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {workspaceMembers.map((member) => (
              <WorkspaceMemberRow
                key={member.clerkUserId}
                member={member}
                canManage={canManage}
                pending={pendingMemberId === member.clerkUserId}
                onRoleChange={(role) =>
                  mutateMember(
                    member.clerkUserId,
                    () => updateWorkspaceMemberRole(member.clerkUserId, role),
                    `Updated ${member.clerkUserId} to ${role}.`
                  )
                }
                onStatusChange={(active) =>
                  mutateMember(
                    member.clerkUserId,
                    () => updateWorkspaceMemberStatus(member.clerkUserId, active),
                    `${active ? "Restored" : "Suspended"} ${member.clerkUserId}.`
                  )
                }
              />
            ))}
          </tbody>
        </table>
      </div>
      {feedback === null ? null : (
        <p
          aria-live="polite"
          className={feedback.tone === "success" ? "text-sm text-green-700" : "text-sm text-red-700"}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}

function WorkspaceMemberRow({
  member,
  canManage,
  pending,
  onRoleChange,
  onStatusChange
}: {
  member: WorkspaceSettingsMember;
  canManage: boolean;
  pending: boolean;
  onRoleChange(role: "admin" | "developer"): void;
  onStatusChange(active: boolean): void;
}) {
  const [selectedRole, setSelectedRole] = React.useState(toAssignableRole(member.role));
  const blocked = !canManage || member.isCurrentUser || pending;
  const roleChanged = selectedRole !== toAssignableRole(member.role);

  React.useEffect(() => {
    setSelectedRole(toAssignableRole(member.role));
  }, [member.role]);

  return (
    <tr>
      <td className="px-3 py-3 align-top">
        <p className="font-mono text-xs text-primary">{member.clerkUserId}</p>
        {member.isCurrentUser ? <p className="mt-1 text-xs font-medium text-accent">Current user</p> : null}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-primary disabled:bg-subtle disabled:text-secondary"
            disabled={blocked}
            value={selectedRole}
            aria-label={`Role for ${member.clerkUserId}`}
            onChange={(event) => setSelectedRole(event.currentTarget.value as "admin" | "developer")}
          >
            <option value="developer">Developer</option>
            <option value="admin">Admin</option>
          </select>
          <button
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-primary disabled:cursor-not-allowed disabled:bg-subtle disabled:text-secondary"
            disabled={blocked || !roleChanged}
            type="button"
            onClick={() => onRoleChange(selectedRole)}
          >
            {pending ? "Saving..." : "Assign role"}
          </button>
        </div>
        {!canManage ? <p className="mt-1 text-xs leading-5 text-secondary">Admin required to assign roles.</p> : null}
      </td>
      <td className="px-3 py-3 align-top">
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
            member.active ? "bg-green-50 text-success" : "bg-slate-100 text-secondary"
          }`}
        >
          {member.active ? "Active" : "Suspended"}
        </span>
      </td>
      <td className="px-3 py-3 align-top text-xs text-secondary">{formatDateTime(member.updatedAt)}</td>
      <td className="px-3 py-3 align-top">
        <button
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-primary disabled:cursor-not-allowed disabled:bg-subtle disabled:text-secondary"
          disabled={blocked}
          type="button"
          onClick={() => onStatusChange(!member.active)}
          title={member.isCurrentUser ? "Admins cannot suspend their own account." : undefined}
        >
          {pending ? "Saving..." : member.active ? "Suspend account" : "Restore account"}
        </button>
      </td>
    </tr>
  );
}

function toAssignableRole(role: DashboardWorkspaceRole): "admin" | "developer" {
  return role === "admin" || role === "owner" ? "admin" : "developer";
}
