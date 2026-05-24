"use client";

import React from "react";
import type {
  ReviewFindingCategory,
  ReviewPolicy,
  ReviewPolicyCategoryEnablement,
  ReviewPolicyInfrastructureSecurity,
  ReviewPolicyReviewPreferences,
  RulesPolicyResponse,
  UpdateReviewPolicyRequest
} from "@firmcode/shared";
import type { ViewState } from "../../lib/view-state";
import {
  createPendingActionGuard,
  toReviewPolicyFeedbackMessage,
  updateReviewPolicy
} from "../../lib/dashboard-actions";
import { formatDateTime } from "./format";

interface RulesPoliciesViewProps {
  state: ViewState<RulesPolicyResponse>;
}

type Feedback = { tone: "success" | "error"; message: string } | null;

export interface ReviewPolicyDraft {
  repositoryId: string | null;
  reviewPreferences: ReviewPolicyReviewPreferences;
  commentPolicy: {
    maxInlineComments: string;
    severityThreshold: ReviewPolicy["commentPolicy"]["severityThreshold"];
  };
  categories: ReviewPolicyCategoryEnablement;
  promptInstructions: string;
  ignoredPathsText: string;
  generatedFilePatternsText: string;
  semgrep: ReviewPolicy["semgrep"];
  analysis: ReviewPolicy["analysis"];
  infrastructureSecurity: ReviewPolicyInfrastructureSecurity;
}

export interface ReviewPolicyValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const CATEGORY_OPTIONS: Array<{ key: ReviewFindingCategory; label: string }> = [
  { key: "bug", label: "Bugs" },
  { key: "security", label: "Security" },
  { key: "performance", label: "Performance" },
  { key: "maintainability", label: "Maintainability" },
  { key: "test", label: "Tests" },
  { key: "infra", label: "Infrastructure" },
  { key: "ci", label: "CI" }
];

const SEVERITY_OPTIONS: Array<ReviewPolicy["commentPolicy"]["severityThreshold"]> = [
  "info",
  "low",
  "medium",
  "high",
  "critical"
];

const MAX_PROMPT_INSTRUCTIONS_LENGTH = 4_000;
const MAX_PATH_PATTERNS = 100;
const MAX_PATH_PATTERN_LENGTH = 240;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bsk-(?:live|test|proj)-[A-Za-z0-9_-]{16,}\b/,
  /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/i
];

export function RulesPoliciesView({ state }: RulesPoliciesViewProps) {
  if (state.status === "loading") {
    return <RulesLoadingState />;
  }

  if (state.status === "error") {
    return <RulesErrorState message={state.message} />;
  }

  if (state.status === "empty" && state.data === undefined) {
    return <RulesEmptyState />;
  }

  const data = state.data;

  if (data === undefined) {
    return <RulesEmptyState />;
  }

  return (
    <div className="space-y-4">
      <RulesHeader data={data} empty={state.status === "empty"} />
      <RulesPolicyForm data={data} />
    </div>
  );
}

function RulesHeader({ data, empty }: { data: RulesPolicyResponse; empty: boolean }) {
  const activePolicy = getActivePolicy(data);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium text-accent">Rules / Policies</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-primary">Review policies</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
          Tune review behavior, comment volume, prompt guidance, path exclusions, and deterministic analysis controls.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            data.permissions.canManagePolicies ? "bg-green-50 text-success" : "bg-slate-100 text-secondary"
          }`}
        >
          {data.permissions.canManagePolicies ? "Owner/Admin editing" : "Read-only policy"}
        </span>
        <span className="rounded-full bg-subtle px-2 py-1 text-xs font-medium text-secondary">
          {activePolicy.scope === "workspace" ? "Workspace default" : "Repository override"}
        </span>
        {empty ? (
          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-accent">No repository overrides</span>
        ) : null}
      </div>
    </div>
  );
}

export function RulesPolicyForm({ data }: { data: RulesPolicyResponse }) {
  const activePolicy = getActivePolicy(data);
  const readOnly = !data.permissions.canManagePolicies;
  const guardRef = React.useRef(createPendingActionGuard());
  const [basePolicy, setBasePolicy] = React.useState(activePolicy);
  const [draft, setDraft] = React.useState(() => createReviewPolicyDraft(activePolicy));
  const [pending, setPending] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback>(null);
  const validation = validateReviewPolicyDraft(draft);
  const hasChanges = hasReviewPolicyDraftChanges(basePolicy, draft);
  const blocked = readOnly || pending || !hasChanges || !validation.valid;

  React.useEffect(() => {
    setBasePolicy(activePolicy);
    setDraft(createReviewPolicyDraft(activePolicy));
    setFeedback(null);
  }, [activePolicy]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (readOnly || guardRef.current.isPending) {
      return;
    }

    const currentValidation = validateReviewPolicyDraft(draft);

    if (!currentValidation.valid) {
      setFeedback({ tone: "error", message: "Fix validation errors before saving." });
      return;
    }

    setPending(true);
    setFeedback(null);

    try {
      const response = await guardRef.current.run(() => updateReviewPolicy(toReviewPolicyUpdateRequest(draft)));
      const savedPolicy = draft.repositoryId === null ? response.workspacePolicy : response.selectedRepositoryPolicy ?? basePolicy;
      setBasePolicy(savedPolicy);
      setDraft(createReviewPolicyDraft(savedPolicy));
      setFeedback({ tone: "success", message: toReviewPolicyFeedbackMessage(response) });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Rules policy could not be updated."
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} aria-label="Rules and policies form">
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-primary">Policy target</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">
              Workspace defaults apply everywhere unless a repository override is selected.
            </p>
            <p className="mt-2 text-xs text-secondary">Updated {formatDateTime(basePolicy.updatedAt)}</p>
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-96">
            <label className="text-sm font-medium text-primary" htmlFor="policy-target">
              Scope
            </label>
            <select
              id="policy-target"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary disabled:bg-subtle disabled:text-secondary"
              value={draft.repositoryId ?? "workspace"}
              disabled={readOnly}
              onChange={(event) => {
                const nextRepositoryId = event.target.value === "workspace" ? null : event.target.value;
                const nextPolicy =
                  nextRepositoryId === null
                    ? data.workspacePolicy
                    : data.repositoryPolicies.find((entry) => entry.repositoryId === nextRepositoryId)?.policy ?? basePolicy;
                setBasePolicy(nextPolicy);
                setDraft(createReviewPolicyDraft(nextPolicy));
                setFeedback(null);
              }}
            >
              <option value="workspace">Workspace default</option>
              {data.repositoryPolicies.map((entry) => (
                <option key={entry.repositoryId} value={entry.repositoryId}>
                  {entry.fullName}
                </option>
              ))}
            </select>
            {data.repositoryPolicies.length === 0 ? (
              <p className="rounded-md border border-blue-100 bg-blue-50 p-2 text-xs leading-5 text-secondary">
                Repository overrides appear after a repository-specific policy is saved through the API.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <PolicySection title="Review Preferences" description="Control when Firmcode reviews and how strongly it nudges tests.">
        <ToggleGrid
          readOnly={readOnly}
          fields={[
            ["reviewDraftPullRequests", "Review draft pull requests", draft.reviewPreferences.reviewDraftPullRequests],
            ["requireTestsForRiskyChanges", "Require tests for risky changes", draft.reviewPreferences.requireTestsForRiskyChanges],
            ["suggestMissingTests", "Suggest missing tests", draft.reviewPreferences.suggestMissingTests]
          ]}
          onChange={(field, checked) =>
            setDraft({
              ...draft,
              reviewPreferences: {
                ...draft.reviewPreferences,
                [field]: checked
              }
            })
          }
        />
      </PolicySection>

      <PolicySection title="Comment Policy" description="Keep inline review volume bounded and severity-aware.">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-primary">
            Severity threshold
            <select
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-primary disabled:bg-subtle disabled:text-secondary"
              value={draft.commentPolicy.severityThreshold}
              disabled={readOnly}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  commentPolicy: {
                    ...draft.commentPolicy,
                    severityThreshold: event.target.value as ReviewPolicy["commentPolicy"]["severityThreshold"]
                  }
                })
              }
            >
              {SEVERITY_OPTIONS.map((severity) => (
                <option key={severity} value={severity}>
                  {formatLabel(severity)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-primary">
            Max inline comments
            <input
              className={inputClassName(validation.errors.maxInlineComments)}
              type="number"
              min="0"
              max="50"
              value={draft.commentPolicy.maxInlineComments}
              disabled={readOnly}
              aria-invalid={validation.errors.maxInlineComments === undefined ? undefined : true}
              aria-describedby={validation.errors.maxInlineComments === undefined ? undefined : "max-inline-comments-error"}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  commentPolicy: {
                    ...draft.commentPolicy,
                    maxInlineComments: event.target.value
                  }
                })
              }
            />
            <FieldError id="max-inline-comments-error" message={validation.errors.maxInlineComments} />
          </label>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {CATEGORY_OPTIONS.map((category) => (
            <label
              key={category.key}
              className="flex items-center gap-3 rounded-md border border-border bg-shell px-3 py-2 text-sm font-medium text-primary"
            >
              <input
                className="h-4 w-4 accent-accent"
                type="checkbox"
                checked={draft.categories[category.key]}
                disabled={readOnly}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    categories: {
                      ...draft.categories,
                      [category.key]: event.target.checked
                    }
                  })
                }
              />
              {category.label}
            </label>
          ))}
        </div>
      </PolicySection>

      <PolicySection title="Prompt Instructions" description="Add bounded reviewer guidance without storing credentials or tokens.">
        <label className="flex flex-col gap-1 text-sm font-medium text-primary">
          Custom review instructions
          <textarea
            className={`${inputClassName(validation.errors.promptInstructions)} min-h-32`}
            value={draft.promptInstructions}
            maxLength={MAX_PROMPT_INSTRUCTIONS_LENGTH}
            disabled={readOnly}
            aria-invalid={validation.errors.promptInstructions === undefined ? undefined : true}
            aria-describedby="prompt-instructions-help prompt-instructions-error"
            onChange={(event) => setDraft({ ...draft, promptInstructions: event.target.value })}
          />
        </label>
        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p id="prompt-instructions-help" className="text-xs leading-5 text-secondary">
            {draft.promptInstructions.length} / {MAX_PROMPT_INSTRUCTIONS_LENGTH} characters.
          </p>
          <FieldError id="prompt-instructions-error" message={validation.errors.promptInstructions} />
        </div>
      </PolicySection>

      <PolicySection title="Ignored Paths" description="Repository-relative path globs excluded from review context where policy allows.">
        <PathTextarea
          label="Ignored paths"
          value={draft.ignoredPathsText}
          error={validation.errors.ignoredPaths}
          readOnly={readOnly}
          onChange={(value) => setDraft({ ...draft, ignoredPathsText: value })}
        />
        <PathTextarea
          label="Generated-file patterns"
          value={draft.generatedFilePatternsText}
          error={validation.errors.generatedFileIgnorePatterns}
          readOnly={readOnly}
          onChange={(value) => setDraft({ ...draft, generatedFilePatternsText: value })}
        />
      </PolicySection>

      <PolicySection title="Semgrep And Analysis" description="Enable deterministic scanners and AI explanation stages.">
        <ToggleGrid
          readOnly={readOnly}
          fields={[
            ["enabled", "Semgrep", draft.semgrep.enabled],
            ["includeInfrastructureRules", "Semgrep infrastructure rules", draft.semgrep.includeInfrastructureRules],
            ["scanGeneratedFilesForSecrets", "Scan generated files for secrets", draft.semgrep.scanGeneratedFilesForSecrets]
          ]}
          onChange={(field, checked) =>
            setDraft({
              ...draft,
              semgrep: {
                ...draft.semgrep,
                [field]: checked
              }
            })
          }
        />
        <div className="mt-3">
          <ToggleGrid
            readOnly={readOnly}
            fields={[
              ["treeSitterEnabled", "Tree-sitter", draft.analysis.treeSitterEnabled],
              ["llmReviewEnabled", "LLM review", draft.analysis.llmReviewEnabled],
              ["ciExplanationEnabled", "CI explanations", draft.analysis.ciExplanationEnabled]
            ]}
            onChange={(field, checked) =>
              setDraft({
                ...draft,
                analysis: {
                  ...draft.analysis,
                  [field]: checked
                }
              })
            }
          />
        </div>
      </PolicySection>

      <PolicySection title="Infrastructure And Security" description="Focus policy review on sensitive operational and security-heavy changes.">
        <ToggleGrid
          readOnly={readOnly}
          fields={[
            ["infrastructureReviewEnabled", "Infrastructure review", draft.infrastructureSecurity.infrastructureReviewEnabled],
            ["securityReviewEnabled", "Security review", draft.infrastructureSecurity.securityReviewEnabled],
            ["dependencyReviewEnabled", "Dependency review", draft.infrastructureSecurity.dependencyReviewEnabled],
            ["ciWorkflowReviewEnabled", "CI workflow review", draft.infrastructureSecurity.ciWorkflowReviewEnabled]
          ]}
          onChange={(field, checked) =>
            setDraft({
              ...draft,
              infrastructureSecurity: {
                ...draft.infrastructureSecurity,
                [field]: checked
              }
            })
          }
        />
      </PolicySection>

      <section className="sticky bottom-0 rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-primary">Policy changes</h2>
            <p className="mt-1 text-sm leading-6 text-secondary" aria-live="polite">
              {readOnly
                ? "This workspace role can view policies but cannot save changes."
                : hasChanges
                  ? "Unsaved changes"
                  : "No unsaved changes"}
            </p>
            {feedback === null ? null : (
              <p
                className={feedback.tone === "success" ? "mt-1 text-sm text-green-700" : "mt-1 text-sm text-red-700"}
                role={feedback.tone === "error" ? "alert" : "status"}
              >
                {feedback.message}
              </p>
            )}
          </div>
          <button
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accentPressed disabled:cursor-not-allowed disabled:bg-mist disabled:text-secondary sm:w-auto"
            type="submit"
            disabled={blocked}
            title={readOnly ? "Owner or Admin required." : "Save review policy"}
          >
            {pending ? "Saving..." : "Save policy"}
          </button>
        </div>
      </section>
    </form>
  );
}

function PolicySection({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-primary">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ToggleGrid<TField extends string>({
  fields,
  readOnly,
  onChange
}: {
  fields: Array<readonly [TField, string, boolean]>;
  readOnly: boolean;
  onChange: (field: TField, checked: boolean) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {fields.map(([field, label, checked]) => (
        <label key={field} className="flex items-center gap-3 rounded-md border border-border bg-shell px-3 py-2 text-sm font-medium text-primary">
          <input
            className="h-4 w-4 accent-accent"
            type="checkbox"
            checked={checked}
            disabled={readOnly}
            onChange={(event) => onChange(field, event.target.checked)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function PathTextarea({
  label,
  value,
  error,
  readOnly,
  onChange
}: {
  label: string;
  value: string;
  error?: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <label className="mt-4 flex flex-col gap-1 text-sm font-medium text-primary">
      {label}
      <textarea
        className={`${inputClassName(error)} min-h-28 font-mono text-xs`}
        value={value}
        disabled={readOnly}
        placeholder="src/generated/**"
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : `${id}-error`}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError id={`${id}-error`} message={error} />
    </label>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (message === undefined) {
    return null;
  }

  return (
    <p id={id} className="text-xs leading-5 text-red-700">
      {message}
    </p>
  );
}

function RulesLoadingState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label="Loading rules policies">
      <div className="h-6 w-64 rounded bg-subtle" />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {["one", "two", "three"].map((key) => (
          <div key={key} className="h-24 rounded-md bg-subtle" />
        ))}
      </div>
      <div className="mt-4 h-56 rounded-md bg-subtle" />
    </section>
  );
}

function RulesEmptyState() {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h1 className="text-lg font-semibold text-primary">No policy data is available</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">
        Connect workspace headers and GitHub repository metadata to load Rules / Policies.
      </p>
    </section>
  );
}

function RulesErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4">
      <h1 className="text-sm font-semibold text-red-800">Rules / Policies could not be loaded</h1>
      <p className="mt-2 text-sm leading-6 text-red-700">{message}</p>
    </section>
  );
}

function getActivePolicy(data: RulesPolicyResponse): ReviewPolicy {
  return data.selectedRepositoryPolicy ?? data.workspacePolicy;
}

export function createReviewPolicyDraft(policy: ReviewPolicy): ReviewPolicyDraft {
  return {
    repositoryId: policy.repositoryId,
    reviewPreferences: { ...policy.reviewPreferences },
    commentPolicy: {
      maxInlineComments: String(policy.commentPolicy.maxInlineComments),
      severityThreshold: policy.commentPolicy.severityThreshold
    },
    categories: { ...policy.categories },
    promptInstructions: policy.promptInstructions,
    ignoredPathsText: policy.ignoredPaths.join("\n"),
    generatedFilePatternsText: policy.generatedFileIgnorePatterns.join("\n"),
    semgrep: { ...policy.semgrep },
    analysis: { ...policy.analysis },
    infrastructureSecurity: { ...policy.infrastructureSecurity }
  };
}

export function validateReviewPolicyDraft(draft: ReviewPolicyDraft): ReviewPolicyValidationResult {
  const errors: Record<string, string> = {};
  const maxInlineComments = Number(draft.commentPolicy.maxInlineComments);

  if (!Number.isInteger(maxInlineComments) || maxInlineComments < 0 || maxInlineComments > 50) {
    errors.maxInlineComments = "Max inline comments must be an integer between 0 and 50.";
  }

  if (draft.promptInstructions.length > MAX_PROMPT_INSTRUCTIONS_LENGTH) {
    errors.promptInstructions = `Prompt instructions must be ${MAX_PROMPT_INSTRUCTIONS_LENGTH} characters or fewer.`;
  } else if (CONTROL_CHARACTER_PATTERN.test(draft.promptInstructions)) {
    errors.promptInstructions = "Prompt instructions cannot contain control characters.";
  } else if (SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(draft.promptInstructions))) {
    errors.promptInstructions = "Prompt instructions cannot contain secrets or tokens.";
  }

  const ignoredPaths = parsePatternLines(draft.ignoredPathsText);
  const generatedPatterns = parsePatternLines(draft.generatedFilePatternsText);
  const ignoredPathError = validatePathPatterns(ignoredPaths);
  const generatedPatternError = validatePathPatterns(generatedPatterns);

  if (ignoredPathError !== null) {
    errors.ignoredPaths = ignoredPathError;
  }

  if (generatedPatternError !== null) {
    errors.generatedFileIgnorePatterns = generatedPatternError;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

export function hasReviewPolicyDraftChanges(policy: ReviewPolicy, draft: ReviewPolicyDraft): boolean {
  return JSON.stringify(toReviewPolicyUpdateRequest(createReviewPolicyDraft(policy))) !== JSON.stringify(toReviewPolicyUpdateRequest(draft));
}

export function toReviewPolicyUpdateRequest(draft: ReviewPolicyDraft): UpdateReviewPolicyRequest {
  return {
    repositoryId: draft.repositoryId,
    reviewPreferences: draft.reviewPreferences,
    commentPolicy: {
      maxInlineComments: Number(draft.commentPolicy.maxInlineComments),
      severityThreshold: draft.commentPolicy.severityThreshold
    },
    categories: draft.categories,
    promptInstructions: draft.promptInstructions,
    ignoredPaths: parsePatternLines(draft.ignoredPathsText),
    generatedFileIgnorePatterns: parsePatternLines(draft.generatedFilePatternsText),
    semgrep: draft.semgrep,
    analysis: draft.analysis,
    infrastructureSecurity: draft.infrastructureSecurity
  };
}

function parsePatternLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function validatePathPatterns(patterns: readonly string[]): string | null {
  if (patterns.length > MAX_PATH_PATTERNS) {
    return `No more than ${MAX_PATH_PATTERNS} path patterns are allowed.`;
  }

  for (const pattern of patterns) {
    if (pattern.length > MAX_PATH_PATTERN_LENGTH) {
      return `Path patterns must be ${MAX_PATH_PATTERN_LENGTH} characters or fewer.`;
    }

    if (CONTROL_CHARACTER_PATTERN.test(pattern)) {
      return "Path patterns cannot contain control characters.";
    }

    if (pattern.startsWith("/") || pattern.startsWith("\\") || /^[A-Za-z]:[\\/]/.test(pattern)) {
      return "Path patterns must be repository-relative.";
    }

    if (pattern.split(/[\\/]+/).includes("..")) {
      return "Path patterns cannot contain path traversal segments.";
    }
  }

  return null;
}

function inputClassName(error?: string): string {
  return [
    "rounded-md border bg-surface px-3 py-2 text-sm text-primary disabled:bg-subtle disabled:text-secondary",
    error === undefined ? "border-border" : "border-red-300"
  ].join(" ");
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
