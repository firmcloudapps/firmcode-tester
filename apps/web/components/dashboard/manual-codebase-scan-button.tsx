"use client";

import React from "react";
import {
  createPendingActionGuard,
  requestCodebaseScan,
  toCodebaseScanFeedbackMessage
} from "../../lib/dashboard-actions";

interface ManualCodebaseScanButtonProps {
  repositoryId: string;
  disabled?: boolean;
  disabledReason?: string;
}

type Feedback = { tone: "success" | "error"; message: string } | null;

export function ManualCodebaseScanButton({
  repositoryId,
  disabled = false,
  disabledReason = "Codebase scan is unavailable."
}: ManualCodebaseScanButtonProps) {
  const guardRef = React.useRef(createPendingActionGuard());
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback>(null);

  async function handleClick() {
    if (disabled || guardRef.current.isPending) {
      return;
    }

    setPending(true);
    setFeedback(null);

    try {
      const response = await guardRef.current.run(() => requestCodebaseScan(repositoryId));
      setFeedback({ tone: "success", message: toCodebaseScanFeedbackMessage(response) });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Codebase scan could not be queued."
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        className="rounded-md border border-border px-2 py-1 text-xs font-medium text-primary transition hover:bg-subtle disabled:cursor-not-allowed disabled:bg-subtle disabled:text-secondary"
        disabled={disabled || pending}
        onClick={handleClick}
        title={disabled ? disabledReason : "Queue a codebase scan"}
        type="button"
      >
        {pending ? "Scanning..." : "Scan now"}
      </button>
      {feedback === null ? null : (
        <p
          aria-live="polite"
          className={feedback.tone === "success" ? "max-w-56 text-xs leading-5 text-green-700" : "max-w-56 text-xs leading-5 text-red-700"}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
