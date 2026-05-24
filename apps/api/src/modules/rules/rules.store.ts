import type {
  ReviewFindingCategory,
  ReviewPolicy,
  ReviewPolicyAnalysisToggles,
  ReviewPolicyCategoryEnablement,
  ReviewPolicyInfrastructureSecurity,
  ReviewPolicyReviewPreferences,
  ReviewPolicySemgrepSettings,
  ReviewPolicySummary,
  ReviewPolicyCommentPolicy,
  UpdateReviewPolicyRequest
} from "@firmcode/shared";
import type { DatabaseExecutor } from "../../infrastructure/database/migrations";

export const RULES_STORE = Symbol("RULES_STORE");

export interface RulesStore {
  getRules(input: RulesLookup): Promise<RulesStoreResult | null>;
  updatePolicy(input: RulesPolicyUpdate): Promise<ReviewPolicy | null>;
}

export interface RulesLookup {
  readonly workspaceId: string;
  readonly repositoryId?: string;
}

export interface RulesPolicyUpdate {
  readonly workspaceId: string;
  readonly repositoryId: string | null;
  readonly updates: ParsedReviewPolicyUpdate;
  readonly updatedByClerkUserId: string;
}

export type ParsedReviewPolicyUpdate = Omit<UpdateReviewPolicyRequest, "repositoryId">;

export interface RulesStoreResult {
  readonly workspacePolicy: ReviewPolicy;
  readonly repositoryPolicies: ReviewPolicySummary[];
  readonly selectedRepositoryPolicy: ReviewPolicy | null;
}

interface ReviewPolicyRow {
  readonly scope: ReviewPolicy["scope"];
  readonly workspace_id: string;
  readonly repository_id: string | null;
  readonly repository_full_name: string | null;
  readonly review_preferences_json: unknown;
  readonly max_inline_comments: number | string;
  readonly severity_threshold: ReviewPolicyCommentPolicy["severityThreshold"];
  readonly category_enablement_json: unknown;
  readonly prompt_instructions: string;
  readonly ignored_paths_json: unknown;
  readonly generated_file_patterns_json: unknown;
  readonly semgrep_policy_json: unknown;
  readonly analysis_toggles_json: unknown;
  readonly infrastructure_security_policy_json: unknown;
  readonly updated_by_clerk_user_id: string | null;
  readonly created_at: Date | string | null;
  readonly updated_at: Date | string | null;
}

interface RepositoryPolicyTargetRow {
  readonly repository_id: string;
}

export class EmptyRulesStore implements RulesStore {
  async getRules(input: RulesLookup): Promise<RulesStoreResult | null> {
    return {
      workspacePolicy: buildDefaultReviewPolicy({
        workspaceId: input.workspaceId,
        repositoryId: null,
        scope: "workspace",
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      }),
      repositoryPolicies: [],
      selectedRepositoryPolicy: null
    };
  }

  async updatePolicy(input: RulesPolicyUpdate): Promise<ReviewPolicy | null> {
    return buildDefaultReviewPolicy({
      workspaceId: input.workspaceId,
      repositoryId: input.repositoryId,
      scope: input.repositoryId === null ? "workspace" : "repository",
      updatedByClerkUserId: input.updatedByClerkUserId,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
      updates: input.updates
    });
  }
}

export class PostgresRulesStore implements RulesStore {
  constructor(private readonly database: DatabaseExecutor) {}

  async getRules(input: RulesLookup): Promise<RulesStoreResult | null> {
    const workspaceExists = await this.workspaceExists(input.workspaceId);

    if (!workspaceExists) {
      return null;
    }

    const workspacePolicy = await this.ensureWorkspacePolicy(input.workspaceId);
    const repositoryPolicies = await this.listRepositoryPolicies(input.workspaceId);
    const selectedRepositoryPolicy =
      input.repositoryId === undefined
        ? null
        : await this.ensureRepositoryPolicy({ workspaceId: input.workspaceId, repositoryId: input.repositoryId });

    if (input.repositoryId !== undefined && selectedRepositoryPolicy === null) {
      return null;
    }

    return {
      workspacePolicy,
      repositoryPolicies,
      selectedRepositoryPolicy
    };
  }

  async updatePolicy(input: RulesPolicyUpdate): Promise<ReviewPolicy | null> {
    const current =
      input.repositoryId === null
        ? await this.ensureWorkspacePolicy(input.workspaceId)
        : await this.ensureRepositoryPolicy({ workspaceId: input.workspaceId, repositoryId: input.repositoryId });

    if (current === null) {
      return null;
    }

    const merged = mergePolicy(current, input.updates);
    await this.database.query(
      `
UPDATE review_policies
SET review_preferences_json = $2::jsonb,
    max_inline_comments = $3,
    severity_threshold = $4,
    category_enablement_json = $5::jsonb,
    prompt_instructions = $6,
    ignored_paths_json = $7::jsonb,
    generated_file_patterns_json = $8::jsonb,
    semgrep_policy_json = $9::jsonb,
    analysis_toggles_json = $10::jsonb,
    infrastructure_security_policy_json = $11::jsonb,
    updated_by_clerk_user_id = $12,
    updated_at = now()
WHERE id = $1
`,
      [
        policyId(input.workspaceId, input.repositoryId),
        JSON.stringify(merged.reviewPreferences),
        merged.commentPolicy.maxInlineComments,
        merged.commentPolicy.severityThreshold,
        JSON.stringify(merged.categories),
        merged.promptInstructions,
        JSON.stringify(merged.ignoredPaths),
        JSON.stringify(merged.generatedFileIgnorePatterns),
        JSON.stringify(merged.semgrep),
        JSON.stringify(merged.analysis),
        JSON.stringify(merged.infrastructureSecurity),
        input.updatedByClerkUserId
      ]
    );
    return this.findPolicyById(policyId(input.workspaceId, input.repositoryId));
  }

  private async workspaceExists(workspaceId: string): Promise<boolean> {
    const result = await this.database.query<{ id: string }>("SELECT id FROM workspaces WHERE id = $1", [workspaceId]);
    return result.rows[0] !== undefined;
  }

  private async ensureWorkspacePolicy(workspaceId: string): Promise<ReviewPolicy> {
    const existing = await this.findPolicyById(policyId(workspaceId, null));

    if (existing !== null) {
      return existing;
    }

    const result = await this.database.query<ReviewPolicyRow>(
      `
INSERT INTO review_policies (
  id,
  scope,
  workspace_id,
  review_preferences_json,
  category_enablement_json,
  semgrep_policy_json,
  analysis_toggles_json,
  infrastructure_security_policy_json
)
SELECT
  $1,
  'workspace',
  id,
  $2::jsonb,
  $3::jsonb,
  $4::jsonb,
  $5::jsonb,
  $6::jsonb
FROM workspaces
WHERE id = $7
RETURNING
  scope,
  workspace_id,
  repository_id,
  NULL AS repository_full_name,
  review_preferences_json,
  max_inline_comments,
  severity_threshold,
  category_enablement_json,
  prompt_instructions,
  ignored_paths_json,
  generated_file_patterns_json,
  semgrep_policy_json,
  analysis_toggles_json,
  infrastructure_security_policy_json,
  updated_by_clerk_user_id,
  created_at,
  updated_at
`,
      [
        policyId(workspaceId, null),
        JSON.stringify(DEFAULT_REVIEW_PREFERENCES),
        JSON.stringify(DEFAULT_CATEGORIES),
        JSON.stringify(DEFAULT_SEMGREP),
        JSON.stringify(DEFAULT_ANALYSIS),
        JSON.stringify(DEFAULT_INFRASTRUCTURE_SECURITY),
        workspaceId
      ]
    );
    const row = result.rows[0];

    if (row === undefined) {
      throw new Error("Workspace policy could not be created");
    }

    return toReviewPolicy(row);
  }

  private async ensureRepositoryPolicy(input: { workspaceId: string; repositoryId: string }): Promise<ReviewPolicy | null> {
    const target = await this.findOwnedRepository(input);

    if (target === null) {
      return null;
    }

    const existing = await this.findPolicyById(policyId(input.workspaceId, input.repositoryId));

    if (existing !== null) {
      return existing;
    }

    const result = await this.database.query<ReviewPolicyRow>(
      `
INSERT INTO review_policies (
  id,
  scope,
  workspace_id,
  repository_id,
  review_preferences_json,
  category_enablement_json,
  semgrep_policy_json,
  analysis_toggles_json,
  infrastructure_security_policy_json
)
VALUES (
  $1,
  'repository',
  $2,
  $3,
  $4::jsonb,
  $5::jsonb,
  $6::jsonb,
  $7::jsonb,
  $8::jsonb
)
`,
      [
        policyId(input.workspaceId, input.repositoryId),
        input.workspaceId,
        target.repository_id,
        JSON.stringify(DEFAULT_REVIEW_PREFERENCES),
        JSON.stringify(DEFAULT_CATEGORIES),
        JSON.stringify(DEFAULT_SEMGREP),
        JSON.stringify(DEFAULT_ANALYSIS),
        JSON.stringify(DEFAULT_INFRASTRUCTURE_SECURITY)
      ]
    );
    return this.findPolicyById(policyId(input.workspaceId, input.repositoryId));
  }

  private async findPolicyById(id: string): Promise<ReviewPolicy | null> {
    const result = await this.database.query<ReviewPolicyRow>(
      `
SELECT
  rp.scope,
  rp.workspace_id,
  rp.repository_id,
  r.full_name AS repository_full_name,
  rp.review_preferences_json,
  rp.max_inline_comments,
  rp.severity_threshold,
  rp.category_enablement_json,
  rp.prompt_instructions,
  rp.ignored_paths_json,
  rp.generated_file_patterns_json,
  rp.semgrep_policy_json,
  rp.analysis_toggles_json,
  rp.infrastructure_security_policy_json,
  rp.updated_by_clerk_user_id,
  rp.created_at,
  rp.updated_at
FROM review_policies rp
LEFT JOIN repositories r ON r.id = rp.repository_id
WHERE rp.id = $1
`,
      [id]
    );
    const row = result.rows[0];

    return row === undefined ? null : toReviewPolicy(row);
  }

  private async findOwnedRepository(input: { workspaceId: string; repositoryId: string }): Promise<RepositoryPolicyTargetRow | null> {
    const result = await this.database.query<RepositoryPolicyTargetRow>(
      `
SELECT r.id AS repository_id
FROM repositories r
JOIN github_installations gi ON gi.id = r.installation_id
WHERE r.id = $1
  AND gi.workspace_id = $2
`,
      [input.repositoryId, input.workspaceId]
    );

    return result.rows[0] ?? null;
  }

  private async listRepositoryPolicies(workspaceId: string): Promise<ReviewPolicySummary[]> {
    const result = await this.database.query<ReviewPolicyRow>(
      `
SELECT
  rp.scope,
  rp.workspace_id,
  rp.repository_id,
  r.full_name AS repository_full_name,
  rp.review_preferences_json,
  rp.max_inline_comments,
  rp.severity_threshold,
  rp.category_enablement_json,
  rp.prompt_instructions,
  rp.ignored_paths_json,
  rp.generated_file_patterns_json,
  rp.semgrep_policy_json,
  rp.analysis_toggles_json,
  rp.infrastructure_security_policy_json,
  rp.updated_by_clerk_user_id,
  rp.created_at,
  rp.updated_at
FROM review_policies rp
JOIN repositories r ON r.id = rp.repository_id
WHERE rp.workspace_id = $1
  AND rp.scope = 'repository'
ORDER BY r.full_name ASC
`,
      [workspaceId]
    );

    return result.rows.map((row) => {
      const policy = toReviewPolicy(row);

      return {
        repositoryId: policy.repositoryId ?? "",
        fullName: row.repository_full_name ?? "",
        policy
      };
    });
  }
}

const REVIEW_CATEGORIES: readonly ReviewFindingCategory[] = [
  "bug",
  "security",
  "performance",
  "maintainability",
  "test",
  "infra",
  "ci"
];

export const DEFAULT_REVIEW_PREFERENCES: ReviewPolicyReviewPreferences = {
  reviewDraftPullRequests: false,
  requireTestsForRiskyChanges: true,
  suggestMissingTests: true
};

export const DEFAULT_COMMENT_POLICY: ReviewPolicyCommentPolicy = {
  maxInlineComments: 10,
  severityThreshold: "medium"
};

export const DEFAULT_CATEGORIES: ReviewPolicyCategoryEnablement = {
  bug: true,
  security: true,
  performance: true,
  maintainability: true,
  test: true,
  infra: true,
  ci: true
};

export const DEFAULT_SEMGREP: ReviewPolicySemgrepSettings = {
  enabled: true,
  includeInfrastructureRules: true,
  scanGeneratedFilesForSecrets: true
};

export const DEFAULT_ANALYSIS: ReviewPolicyAnalysisToggles = {
  treeSitterEnabled: true,
  llmReviewEnabled: true,
  ciExplanationEnabled: true
};

export const DEFAULT_INFRASTRUCTURE_SECURITY: ReviewPolicyInfrastructureSecurity = {
  infrastructureReviewEnabled: true,
  securityReviewEnabled: true,
  dependencyReviewEnabled: true,
  ciWorkflowReviewEnabled: true
};

function policyId(workspaceId: string, repositoryId: string | null): string {
  return repositoryId === null ? `workspace:${workspaceId}` : `repository:${repositoryId}`;
}

function mergePolicy(current: ReviewPolicy, updates: ParsedReviewPolicyUpdate): ReviewPolicy {
  return {
    ...current,
    reviewPreferences: {
      ...current.reviewPreferences,
      ...updates.reviewPreferences
    },
    commentPolicy: {
      ...current.commentPolicy,
      ...updates.commentPolicy
    },
    categories: {
      ...current.categories,
      ...updates.categories
    },
    promptInstructions: updates.promptInstructions ?? current.promptInstructions,
    ignoredPaths: updates.ignoredPaths ?? current.ignoredPaths,
    generatedFileIgnorePatterns: updates.generatedFileIgnorePatterns ?? current.generatedFileIgnorePatterns,
    semgrep: {
      ...current.semgrep,
      ...updates.semgrep
    },
    analysis: {
      ...current.analysis,
      ...updates.analysis
    },
    infrastructureSecurity: {
      ...current.infrastructureSecurity,
      ...updates.infrastructureSecurity
    }
  };
}

function toReviewPolicy(row: ReviewPolicyRow): ReviewPolicy {
  return {
    workspaceId: row.workspace_id,
    repositoryId: row.repository_id,
    scope: row.scope,
    reviewPreferences: mergeDefaults(DEFAULT_REVIEW_PREFERENCES, row.review_preferences_json),
    commentPolicy: {
      maxInlineComments: Number(row.max_inline_comments),
      severityThreshold: row.severity_threshold
    },
    categories: normalizeCategoryEnablement(row.category_enablement_json),
    promptInstructions: row.prompt_instructions,
    ignoredPaths: normalizeStringArray(row.ignored_paths_json),
    generatedFileIgnorePatterns: normalizeStringArray(row.generated_file_patterns_json),
    semgrep: mergeDefaults(DEFAULT_SEMGREP, row.semgrep_policy_json),
    analysis: mergeDefaults(DEFAULT_ANALYSIS, row.analysis_toggles_json),
    infrastructureSecurity: mergeDefaults(DEFAULT_INFRASTRUCTURE_SECURITY, row.infrastructure_security_policy_json),
    updatedByClerkUserId: row.updated_by_clerk_user_id,
    createdAt: toRequiredIsoString(row.created_at),
    updatedAt: toRequiredIsoString(row.updated_at)
  };
}

function buildDefaultReviewPolicy(input: {
  workspaceId: string;
  repositoryId: string | null;
  scope: ReviewPolicy["scope"];
  updatedByClerkUserId?: string | null;
  createdAt: string;
  updatedAt: string;
  updates?: ParsedReviewPolicyUpdate;
}): ReviewPolicy {
  return mergePolicy(
    {
      workspaceId: input.workspaceId,
      repositoryId: input.repositoryId,
      scope: input.scope,
      reviewPreferences: DEFAULT_REVIEW_PREFERENCES,
      commentPolicy: DEFAULT_COMMENT_POLICY,
      categories: DEFAULT_CATEGORIES,
      promptInstructions: "",
      ignoredPaths: [],
      generatedFileIgnorePatterns: [],
      semgrep: DEFAULT_SEMGREP,
      analysis: DEFAULT_ANALYSIS,
      infrastructureSecurity: DEFAULT_INFRASTRUCTURE_SECURITY,
      updatedByClerkUserId: input.updatedByClerkUserId ?? null,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt
    },
    input.updates ?? {}
  );
}

function mergeDefaults<T extends object>(defaults: T, value: unknown): T {
  const object = normalizeJsonObject(value);
  return {
    ...defaults,
    ...object
  } as T;
}

function normalizeCategoryEnablement(value: unknown): ReviewPolicyCategoryEnablement {
  const object = normalizeJsonObject(value);
  const categories = { ...DEFAULT_CATEGORIES };

  for (const category of REVIEW_CATEGORIES) {
    if (typeof object[category] === "boolean") {
      categories[category] = object[category];
    }
  }

  return categories;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function toRequiredIsoString(value: Date | string | null): string {
  if (value === null) {
    return new Date(0).toISOString();
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
