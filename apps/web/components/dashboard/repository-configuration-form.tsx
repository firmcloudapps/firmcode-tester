"use client";

import React from "react";
import type { RepositoryReviewConfiguration, UpdateRepositoryReviewConfigurationRequest } from "@firmcode/shared";
import { createPendingActionGuard, updateRepositoryConfiguration } from "../../lib/dashboard-actions";

interface RepositoryConfigurationFormProps {
  repositoryId: string;
  initialConfiguration: RepositoryReviewConfiguration;
  readOnly: boolean;
}

type Feedback = { tone: "success" | "error"; message: string } | null;

const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;

export function RepositoryConfigurationForm({
  repositoryId,
  initialConfiguration,
  readOnly
}: RepositoryConfigurationFormProps) {
  const guardRef = React.useRef(createPendingActionGuard());
  const [configuration, setConfiguration] = React.useState(initialConfiguration);
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (readOnly || guardRef.current.isPending) {
      return;
    }

    setPending(true);
    setFeedback(null);

    try {
      const updated = await guardRef.current.run(() =>
        updateRepositoryConfiguration(repositoryId, readConfigurationForm(new FormData(event.currentTarget)))
      );
      setConfiguration(updated);
      setFeedback({ tone: "success", message: "Repository configuration saved." });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Repository configuration could not be updated."
      });
    } finally {
      setPending(false);
    }
  }

  const disabled = readOnly || pending;
  const checkboxFields = [
    ["codebaseScanEnabled", "Codebase scans", configuration.codebaseScanEnabled ?? true],
    ["draftPullRequestReviewsEnabled", "Draft PR reviews", configuration.draftPullRequestReviewsEnabled],
    ["semgrepEnabled", "Semgrep", configuration.semgrepEnabled],
    ["treeSitterEnabled", "Tree-sitter", configuration.treeSitterEnabled],
    ["ciExplanationEnabled", "CI explanations", configuration.ciExplanationEnabled],
    ["infrastructureReviewEnabled", "Infrastructure review", configuration.infrastructureReviewEnabled],
    ["dryRunEnabled", "Dry run", configuration.dryRunEnabled]
  ] as const;

  return (
    <form className="mt-4 grid gap-4 md:grid-cols-2" aria-label="Repository review configuration" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-1 text-sm font-medium text-primary">
        Severity threshold
        <select
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary disabled:bg-subtle disabled:text-secondary"
          name="severityThreshold"
          defaultValue={configuration.severityThreshold}
          disabled={disabled}
        >
          {SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>{severity}</option>
          ))}
        </select>
      </label>
      <NumberField name="maxInlineComments" label="Max inline comments" min={0} max={50} value={configuration.maxInlineComments} disabled={disabled} />
      <NumberField
        name="codebaseScanCadenceHours"
        label="Scan cadence hours"
        min={1}
        max={720}
        value={configuration.codebaseScanCadenceHours ?? 24}
        disabled={disabled}
      />
      <label className="flex flex-col gap-1 text-sm font-medium text-primary">
        Scan severity threshold
        <select
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary disabled:bg-subtle disabled:text-secondary"
          name="codebaseScanSeverityThreshold"
          defaultValue={configuration.codebaseScanSeverityThreshold ?? "medium"}
          disabled={disabled}
        >
          {SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>{severity}</option>
          ))}
        </select>
      </label>
      <NumberField
        name="codebaseScanMaxFiles"
        label="Scan max files"
        min={1}
        max={5000}
        value={configuration.codebaseScanMaxFiles ?? 500}
        disabled={disabled}
      />
      <NumberField
        name="codebaseScanMaxBytes"
        label="Scan max bytes"
        min={1}
        max={100000000}
        value={configuration.codebaseScanMaxBytes ?? 10000000}
        disabled={disabled}
      />
      <label className="flex flex-col gap-1 text-sm font-medium text-primary md:col-span-2">
        Scan ignored paths
        <textarea
          className="min-h-24 rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-primary disabled:bg-subtle disabled:text-secondary"
          name="codebaseScanIgnoredPaths"
          defaultValue={(configuration.codebaseScanIgnoredPaths ?? []).join("\n")}
          disabled={disabled}
        />
      </label>
      {checkboxFields.map(([name, label, checked]) => (
        <label key={name} className="flex items-center gap-3 rounded-md border border-border bg-shell px-3 py-2 text-sm font-medium text-primary">
          <input className="h-4 w-4 accent-accent" name={name} type="checkbox" defaultChecked={checked} disabled={disabled} />
          {label}
        </label>
      ))}
      <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row sm:items-center">
        <button
          className="w-fit rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-subtle disabled:text-secondary"
          disabled={disabled}
          type="submit"
        >
          {pending ? "Saving..." : readOnly ? "Read-only" : "Save configuration"}
        </button>
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
    </form>
  );
}

function NumberField({
  name,
  label,
  min,
  max,
  value,
  disabled
}: {
  name: string;
  label: string;
  min: number;
  max: number;
  value: number;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-primary">
      {label}
      <input
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary disabled:bg-subtle disabled:text-secondary"
        name={name}
        type="number"
        min={min}
        max={max}
        defaultValue={value}
        disabled={disabled}
      />
    </label>
  );
}

function readConfigurationForm(formData: FormData): UpdateRepositoryReviewConfigurationRequest {
  return {
    codebaseScanEnabled: formData.has("codebaseScanEnabled"),
    draftPullRequestReviewsEnabled: formData.has("draftPullRequestReviewsEnabled"),
    semgrepEnabled: formData.has("semgrepEnabled"),
    treeSitterEnabled: formData.has("treeSitterEnabled"),
    ciExplanationEnabled: formData.has("ciExplanationEnabled"),
    infrastructureReviewEnabled: formData.has("infrastructureReviewEnabled"),
    dryRunEnabled: formData.has("dryRunEnabled"),
    severityThreshold: readString(formData, "severityThreshold") as UpdateRepositoryReviewConfigurationRequest["severityThreshold"],
    maxInlineComments: readInteger(formData, "maxInlineComments"),
    codebaseScanCadenceHours: readInteger(formData, "codebaseScanCadenceHours"),
    codebaseScanSeverityThreshold: readString(formData, "codebaseScanSeverityThreshold") as UpdateRepositoryReviewConfigurationRequest["codebaseScanSeverityThreshold"],
    codebaseScanMaxFiles: readInteger(formData, "codebaseScanMaxFiles"),
    codebaseScanMaxBytes: readInteger(formData, "codebaseScanMaxBytes"),
    codebaseScanIgnoredPaths: readString(formData, "codebaseScanIgnoredPaths")
      .split(/\r?\n/)
      .map((path) => path.trim())
      .filter(Boolean)
  };
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function readInteger(formData: FormData, name: string): number {
  const value = Number.parseInt(readString(formData, name), 10);

  return Number.isFinite(value) ? value : 0;
}
