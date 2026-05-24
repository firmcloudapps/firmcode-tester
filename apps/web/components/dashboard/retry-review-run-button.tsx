"use client";

import React from "react";
import type { ReviewRunStatus } from "@firmcode/shared";
import {
  createPendingActionGuard,
  isReviewRunRetryable,
  requestReviewRunRetry,
  toRetryFeedbackMessage
} from "../../lib/dashboard-actions";

interface RetryReviewRunButtonProps {
  reviewRunId: string;
  status: ReviewRunStatus;
  errorCode?: string | null;
  canRetry?: boolean;
  compact?: boolean;
}

type Feedback = { tone: "success" | "error"; message: string } | null;

export function RetryReviewRunButton({ reviewRunId, status, errorCode = null, canRetry = true, compact = false }: RetryReviewRunButtonProps) {
  const retryable = canRetry && isReviewRunRetryable(status, errorCode);
  const guardRef = React.useRef(createPendingActionGuard());
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback>(null);
  const disabledReason = retryable ? null : getDisabledReason(status, canRetry ? errorCode : "role_forbidden");

  async function handleRetry() {
    if (!retryable || guardRef.current.isPending) {
      return;
    }

    setPending(true);
    setFeedback(null);

    try {
      const response = await guardRef.current.run(() => requestReviewRunRetry(reviewRunId));
      setFeedback({ tone: "success", message: toRetryFeedbackMessage(response) });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Review retry could not be queued." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <button
        aria-disabled={!retryable || pending}
        className={[
          "rounded-md border px-3 py-2 text-sm font-medium transition",
          compact ? "px-2 py-1 text-xs" : "",
          retryable
            ? "border-accent bg-accent text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-border disabled:bg-subtle disabled:text-secondary"
            : "cursor-not-allowed border-border bg-subtle text-secondary"
        ].join(" ")}
        disabled={!retryable || pending}
        onClick={handleRetry}
        title={disabledReason ?? "Queue a new review run for this failed run"}
        type="button"
      >
        {pending ? "Retrying..." : "Retry"}
      </button>
      {disabledReason === null ? null : <p className="max-w-52 text-xs leading-5 text-secondary">{disabledReason}</p>}
      {feedback === null ? null : (
        <p
          aria-live="polite"
          className={feedback.tone === "success" ? "max-w-64 text-xs leading-5 text-green-700" : "max-w-64 text-xs leading-5 text-red-700"}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}

function getDisabledReason(status: ReviewRunStatus, errorCode: string | null): string {
  if (errorCode === "role_forbidden") {
    return "Your workspace role cannot retry review runs.";
  }

  if (status !== "failed") {
    return "Only failed review runs can be retried.";
  }

  if (errorCode === "invalid_job_payload") {
    return "This run failed validation and needs configuration changes before retrying.";
  }

  return "This run cannot be retried.";
}
