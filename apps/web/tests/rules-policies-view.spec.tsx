import React from "react";
import { renderToString } from "react-dom/server";
import type { ReviewPolicy, RulesPolicyResponse } from "@firmcode/shared";
import {
  createReviewPolicyDraft,
  hasReviewPolicyDraftChanges,
  RulesPoliciesView,
  toReviewPolicyUpdateRequest,
  validateReviewPolicyDraft
} from "../components/dashboard/rules-policies-view";
import { DashboardMutationError, toReviewPolicyFeedbackMessage, updateReviewPolicy } from "../lib/dashboard-actions";

describe("RulesPoliciesView", () => {
  it("renders loading, empty, and error states", () => {
    expect(renderToString(<RulesPoliciesView state={{ status: "loading" }} />)).toContain("Loading rules policies");
    expect(renderToString(<RulesPoliciesView state={{ status: "empty" }} />)).toContain("No policy data is available");
    expect(renderToString(<RulesPoliciesView state={{ status: "error", message: "Backend unavailable" }} />)).toContain(
      "Rules / Policies could not be loaded"
    );
  });

  it("renders populated policy controls and the empty repository-override state", () => {
    const html = renderToString(<RulesPoliciesView state={{ status: "empty", data: rulesResponse() }} />);

    expect(html).toContain("Review Preferences");
    expect(html).toContain("Comment Policy");
    expect(html).toContain("Prompt Instructions");
    expect(html).toContain("Ignored Paths");
    expect(html).toContain("Semgrep And Analysis");
    expect(html).toContain("Infrastructure And Security");
    expect(html).toContain("Workspace Administration");
    expect(html).toContain("Policy editing");
    expect(html).toContain("No repository overrides");
    expect(html).toContain("No unsaved changes");
  });

  it("renders repository override options when policy data is populated", () => {
    const html = renderToString(
      <RulesPoliciesView state={{ status: "populated", data: rulesResponse({ includeRepositoryPolicy: true }) }} />
    );

    expect(html).toContain("openclaw/firmcode");
    expect(html).toContain("Repository override");
  });

  it("shows validation errors for invalid persisted draft values", () => {
    const invalidPolicy = policy({
      commentPolicy: {
        maxInlineComments: 99,
        severityThreshold: "medium"
      },
      promptInstructions: "token=github_pat_1234567890123456789012345",
      ignoredPaths: ["/tmp/generated"]
    });
    const html = renderToString(
      <RulesPoliciesView
        state={{
          status: "populated",
          data: rulesResponse({ workspacePolicy: invalidPolicy })
        }}
      />
    );

    expect(html).toContain("Max inline comments must be an integer between 0 and 50.");
    expect(html).toContain("Prompt instructions cannot contain secrets or tokens.");
    expect(html).toContain("Path patterns must be repository-relative.");
  });

  it("validates prompt instruction and ignored-path boundaries before save", () => {
    const draft = createReviewPolicyDraft(policy());
    draft.promptInstructions = "password=super-secret-token";
    draft.ignoredPathsText = "../private\nsrc/generated/**";
    draft.generatedFilePatternsText = `${"a".repeat(241)}`;

    const validation = validateReviewPolicyDraft(draft);

    expect(validation.valid).toBe(false);
    expect(validation.errors.promptInstructions).toBe("Prompt instructions cannot contain secrets or tokens.");
    expect(validation.errors.ignoredPaths).toBe("Path patterns cannot contain path traversal segments.");
    expect(validation.errors.generatedFileIgnorePatterns).toBe("Path patterns must be 240 characters or fewer.");
  });

  it("tracks unsaved changes and serializes typed update payloads", () => {
    const basePolicy = policy();
    const draft = createReviewPolicyDraft(basePolicy);

    expect(hasReviewPolicyDraftChanges(basePolicy, draft)).toBe(false);

    draft.commentPolicy.maxInlineComments = "4";
    draft.categories.security = false;
    draft.ignoredPathsText = "dist/**\ncoverage/**";
    draft.workspaceControls.retentionDays = "45";

    expect(hasReviewPolicyDraftChanges(basePolicy, draft)).toBe(true);
    expect(toReviewPolicyUpdateRequest(draft)).toMatchObject({
      repositoryId: null,
      commentPolicy: { maxInlineComments: 4, severityThreshold: "medium" },
      categories: { security: false },
      ignoredPaths: ["dist/**", "coverage/**"],
      workspaceControls: { retentionDays: 45 }
    });
  });

  it("keeps Developer repository policies editable while locking global workspace controls", () => {
    const html = renderToString(
      <RulesPoliciesView
        state={{
          status: "populated",
          data: rulesResponse({
            canManagePolicies: true,
            canManageWorkspacePolicies: false,
            canManageRepositoryPolicies: true,
            canManageSensitiveWorkspacePolicies: false,
            includeRepositoryPolicy: true
          })
        }}
      />
    );

    expect(html).toContain("Repository override");
    expect(html).toContain("Repository policies inherit workspace administration controls.");
    expect(html).toContain("Save policy");
  });

  it("saves through the role-gated Rules API and reports success", async () => {
    const response = rulesResponse();
    const fetcher = vi.fn(async () => jsonResponse(response));

    await expect(updateReviewPolicy({ commentPolicy: { maxInlineComments: 4 } }, fetcher)).resolves.toEqual(response);
    expect(fetcher).toHaveBeenCalledWith("/api/rules", {
      method: "PATCH",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({ commentPolicy: { maxInlineComments: 4 } })
    });
    expect(toReviewPolicyFeedbackMessage(response)).toBe("Workspace policy saved.");
  });

  it("surfaces save failures without exposing submitted custom instructions", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ message: "Workspace role cannot manage review policies" }, 403));

    await expect(
      updateReviewPolicy({ promptInstructions: "token=github_pat_1234567890123456789012345" }, fetcher)
    ).rejects.toMatchObject({
      message: "Workspace role cannot manage review policies",
      status: 403
    } satisfies Partial<DashboardMutationError>);
  });

  it("renders read-only controls for Developer and Viewer roles", () => {
    const developerHtml = renderToString(
      <RulesPoliciesView state={{ status: "populated", data: rulesResponse({ canManagePolicies: false }) }} />
    );
    const viewerHtml = renderToString(
      <RulesPoliciesView state={{ status: "populated", data: rulesResponse({ canManagePolicies: false }) }} />
    );

    expect(developerHtml).toContain("Read-only policy");
    expect(developerHtml).toContain("Admin is required to save workspace policies.");
    expect(developerHtml).toContain("disabled=\"\"");
    expect(viewerHtml).toContain("Read-only policy");
    expect(viewerHtml).toContain("disabled=\"\"");
  });
});

function rulesResponse(
  options: {
    workspacePolicy?: ReviewPolicy;
    canManagePolicies?: boolean;
    canManageWorkspacePolicies?: boolean;
    canManageRepositoryPolicies?: boolean;
    canManageSensitiveWorkspacePolicies?: boolean;
    includeRepositoryPolicy?: boolean;
  } = {}
): RulesPolicyResponse {
  const workspacePolicy = options.workspacePolicy ?? policy();
  const repositoryPolicy = policy({
    repositoryId: "repo-1",
    scope: "repository",
    promptInstructions: "Prioritize generated client safety."
  });

  return {
    workspacePolicy,
    repositoryPolicies: options.includeRepositoryPolicy
      ? [
          {
            repositoryId: "repo-1",
            fullName: "openclaw/firmcode",
            policy: repositoryPolicy
          }
        ]
      : [],
    selectedRepositoryPolicy: options.includeRepositoryPolicy ? repositoryPolicy : null,
    permissions: {
      canManagePolicies: options.canManagePolicies ?? true,
      canManageWorkspacePolicies: options.canManageWorkspacePolicies ?? options.canManagePolicies ?? true,
      canManageRepositoryPolicies: options.canManageRepositoryPolicies ?? options.canManagePolicies ?? true,
      canManageSensitiveWorkspacePolicies: options.canManageSensitiveWorkspacePolicies ?? options.canManagePolicies ?? true
    }
  };
}

function policy(overrides: Partial<ReviewPolicy> = {}): ReviewPolicy {
  return {
    workspaceId: "workspace-1",
    repositoryId: null,
    scope: "workspace",
    reviewPreferences: {
      reviewDraftPullRequests: false,
      requireTestsForRiskyChanges: true,
      suggestMissingTests: true
    },
    commentPolicy: {
      maxInlineComments: 8,
      severityThreshold: "medium"
    },
    categories: {
      bug: true,
      security: true,
      performance: true,
      maintainability: true,
      test: true,
      infra: true,
      ci: true
    },
    promptInstructions: "Prefer concise, grounded review comments.",
    ignoredPaths: ["dist/**"],
    generatedFileIgnorePatterns: ["**/*.generated.ts"],
    semgrep: {
      enabled: true,
      includeInfrastructureRules: true,
      scanGeneratedFilesForSecrets: true
    },
    analysis: {
      treeSitterEnabled: true,
      llmReviewEnabled: true,
      ciExplanationEnabled: true
    },
    infrastructureSecurity: {
      infrastructureReviewEnabled: true,
      securityReviewEnabled: true,
      dependencyReviewEnabled: true,
      ciWorkflowReviewEnabled: true
    },
    workspaceControls: {
      globalWorkspacePolicyEnabled: true,
      retentionDays: 30,
      apiKeyCreationEnabled: false,
      billingChangesRequireAdmin: true,
      supportSafetyOverridesEnabled: false
    },
    updatedByClerkUserId: "user_admin",
    createdAt: "2026-05-23T10:00:00.000Z",
    updatedAt: "2026-05-23T10:10:00.000Z",
    ...overrides
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}
