"use client";

import React from "react";
import { createPendingActionGuard, updateRepositoryAutomation } from "../../lib/dashboard-actions";

interface RepositoryAutomationToggleProps {
  repositoryId: string;
  initialEnabled: boolean;
}

type Feedback = { tone: "success" | "error"; message: string } | null;

export function RepositoryAutomationToggle({ repositoryId, initialEnabled }: RepositoryAutomationToggleProps) {
  const guardRef = React.useRef(createPendingActionGuard());
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback>(null);

  async function handleToggle() {
    if (guardRef.current.isPending) {
      return;
    }

    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    setPending(true);
    setFeedback(null);

    try {
      const configuration = await guardRef.current.run(() => updateRepositoryAutomation(repositoryId, nextEnabled));
      setEnabled(configuration.automationEnabled);
      setFeedback({
        tone: "success",
        message: configuration.automationEnabled ? "Automation enabled." : "Automation disabled."
      });
    } catch (error) {
      setEnabled(enabled);
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Repository automation could not be updated."
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        aria-checked={enabled}
        aria-label={`${enabled ? "Disable" : "Enable"} repository automation`}
        className={[
          "inline-flex min-w-28 items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-70",
          enabled ? "border-green-200 bg-green-50 text-green-700" : "border-border bg-subtle text-secondary"
        ].join(" ")}
        disabled={pending}
        onClick={handleToggle}
        role="switch"
        type="button"
      >
        <span>{pending ? "Saving..." : enabled ? "Enabled" : "Disabled"}</span>
        <span
          aria-hidden="true"
          className={[
            "relative h-4 w-7 rounded-full border transition",
            enabled ? "border-green-300 bg-green-200" : "border-slate-300 bg-slate-200"
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow-sm transition",
              enabled ? "left-3.5" : "left-0.5"
            ].join(" ")}
          />
        </span>
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
