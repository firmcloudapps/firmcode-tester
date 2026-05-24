"use client";

import React from "react";
import {
  createPendingActionGuard,
  syncGitHubInstallations,
  syncGitHubRepository,
  toGitHubInstallationSyncFeedbackMessage,
  toGitHubRepositorySyncFeedbackMessage
} from "../../lib/dashboard-actions";

type Feedback = { tone: "success" | "error"; message: string } | null;

interface GitHubInstallationSyncButtonProps {
  installationId?: number;
  disabled?: boolean;
  disabledReason?: string;
  compact?: boolean;
  label?: string;
}

interface GitHubRepositorySyncButtonProps {
  repositoryId: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function GitHubInstallationSyncButton({
  installationId,
  disabled = false,
  disabledReason,
  compact = false,
  label = "Sync GitHub"
}: GitHubInstallationSyncButtonProps) {
  const guardRef = React.useRef(createPendingActionGuard());
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback>(null);
  const blocked = disabled || pending;

  async function handleSync() {
    if (disabled || guardRef.current.isPending) {
      return;
    }

    setPending(true);
    setFeedback(null);

    try {
      const response = await guardRef.current.run(() => syncGitHubInstallations(installationId));
      setFeedback({ tone: "success", message: toGitHubInstallationSyncFeedbackMessage(response) });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "GitHub installation sync could not be completed."
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <button
        aria-disabled={blocked}
        className={[
          "rounded-md border font-medium transition disabled:cursor-not-allowed disabled:border-border disabled:bg-subtle disabled:text-secondary",
          compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
          disabled ? "border-border bg-subtle text-secondary" : "border-accent bg-accent text-white hover:bg-accentPressed"
        ].join(" ")}
        disabled={blocked}
        onClick={handleSync}
        title={disabledReason ?? "Sync GitHub installation and repository metadata"}
        type="button"
      >
        {pending ? "Syncing..." : label}
      </button>
      {disabled && disabledReason !== undefined ? <p className="max-w-64 text-xs leading-5 text-secondary">{disabledReason}</p> : null}
      <FeedbackMessage feedback={feedback} />
    </div>
  );
}

export function GitHubRepositorySyncButton({
  repositoryId,
  disabled = false,
  disabledReason
}: GitHubRepositorySyncButtonProps) {
  const guardRef = React.useRef(createPendingActionGuard());
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback>(null);
  const blocked = disabled || pending;

  async function handleSync() {
    if (disabled || guardRef.current.isPending) {
      return;
    }

    setPending(true);
    setFeedback(null);

    try {
      const response = await guardRef.current.run(() => syncGitHubRepository(repositoryId));
      setFeedback({ tone: "success", message: toGitHubRepositorySyncFeedbackMessage(response) });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Repository sync could not be completed."
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        aria-disabled={blocked}
        className={[
          "rounded-md border px-2 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:border-border disabled:bg-subtle disabled:text-secondary",
          disabled ? "border-border bg-subtle text-secondary" : "border-border bg-surface text-primary hover:border-accent"
        ].join(" ")}
        disabled={blocked}
        onClick={handleSync}
        title={disabledReason ?? "Sync this repository from GitHub"}
        type="button"
      >
        {pending ? "Syncing..." : "Sync"}
      </button>
      {disabled && disabledReason !== undefined ? <p className="max-w-44 text-xs leading-5 text-secondary">{disabledReason}</p> : null}
      <FeedbackMessage feedback={feedback} />
    </div>
  );
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  if (feedback === null) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={feedback.tone === "success" ? "max-w-64 text-xs leading-5 text-green-700" : "max-w-64 text-xs leading-5 text-red-700"}
      role={feedback.tone === "error" ? "alert" : "status"}
    >
      {feedback.message}
    </p>
  );
}
