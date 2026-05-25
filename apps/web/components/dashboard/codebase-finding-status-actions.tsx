"use client";

import React from "react";
import type { CodebaseScanFindingInboxItem } from "@firmcode/shared";
import {
  createPendingActionGuard,
  updateCodebaseFindingStatus
} from "../../lib/dashboard-actions";

interface CodebaseFindingStatusActionsProps {
  finding: CodebaseScanFindingInboxItem;
  canManage: boolean;
}

type Feedback = { tone: "success" | "error"; message: string } | null;

const OPEN_ACTIONS = [
  { status: "suppressed", label: "Suppress" },
  { status: "false_positive", label: "False positive" },
  { status: "resolved", label: "Resolve" }
] as const;

export function CodebaseFindingStatusActions({ finding, canManage }: CodebaseFindingStatusActionsProps) {
  const guardRef = React.useRef(createPendingActionGuard());
  const [status, setStatus] = React.useState(finding.status);
  const [pendingStatus, setPendingStatus] = React.useState<CodebaseScanFindingInboxItem["status"] | null>(null);
  const [feedback, setFeedback] = React.useState<Feedback>(null);

  if (!canManage) {
    return (
      <p className="mt-3 text-xs leading-5 text-secondary">
        Status changes require Developer or Admin access.
      </p>
    );
  }

  const actions = status === "open" ? OPEN_ACTIONS : [{ status: "open", label: "Reopen" } as const];

  async function applyStatus(nextStatus: CodebaseScanFindingInboxItem["status"]) {
    if (guardRef.current.isPending || nextStatus === status) {
      return;
    }

    setPendingStatus(nextStatus);
    setFeedback(null);

    try {
      const updated = await guardRef.current.run(() =>
        updateCodebaseFindingStatus(finding.id, nextStatus, "Updated from the dashboard findings inbox.")
      );
      setStatus(updated.status);
      setFeedback({ tone: "success", message: `Finding marked ${formatStatus(updated.status)}.` });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Codebase finding status could not be updated."
      });
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2" aria-label="Codebase finding status actions">
        {actions.map((action) => (
          <button
            key={action.status}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-primary transition hover:bg-subtle disabled:cursor-not-allowed disabled:bg-subtle disabled:text-secondary"
            disabled={pendingStatus !== null}
            onClick={() => {
              void applyStatus(action.status);
            }}
            type="button"
          >
            {pendingStatus === action.status ? "Saving..." : action.label}
          </button>
        ))}
      </div>
      {feedback === null ? null : (
        <p
          aria-live="polite"
          className={feedback.tone === "success" ? "text-xs leading-5 text-green-700" : "text-xs leading-5 text-red-700"}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}

function formatStatus(status: CodebaseScanFindingInboxItem["status"]): string {
  return status.replace("_", " ");
}
