import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import type {
  ReviewFindingCategory,
  ReviewPolicyCommentPolicy,
  RulesPolicyResponse,
  UpdateReviewPolicyRequest
} from "@firmcode/shared";
import {
  DASHBOARD_AUTH_STORE,
  roleHasDashboardCapability,
  type DashboardAuthStore,
  type DashboardMembership
} from "../review-runs/dashboard-auth.store";
import { resolveRepositoryAccessScope } from "../auth/repository-access-scope";
import { RULES_STORE, type ParsedReviewPolicyUpdate, type RulesStore } from "./rules.store";

export interface RulesRequestContext {
  readonly workspaceId: string | null;
  readonly clerkUserId: string | null;
  readonly repositoryId?: string | null;
}

export interface RulesUpdateContext extends RulesRequestContext {
  readonly body: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEVERITY_THRESHOLDS = new Set(["info", "low", "medium", "high", "critical"]);
const TOP_LEVEL_UPDATE_FIELDS = new Set([
  "repositoryId",
  "reviewPreferences",
  "commentPolicy",
  "categories",
  "promptInstructions",
  "ignoredPaths",
  "generatedFileIgnorePatterns",
  "semgrep",
  "analysis",
  "infrastructureSecurity",
  "workspaceControls"
]);
const REVIEW_PREFERENCE_FIELDS = new Set(["reviewDraftPullRequests", "requireTestsForRiskyChanges", "suggestMissingTests"]);
const COMMENT_POLICY_FIELDS = new Set(["maxInlineComments", "severityThreshold"]);
const CATEGORY_FIELDS = new Set<ReviewFindingCategory>(["bug", "security", "performance", "maintainability", "test", "infra", "ci"]);
const SEMGREP_FIELDS = new Set(["enabled", "includeInfrastructureRules", "scanGeneratedFilesForSecrets"]);
const ANALYSIS_FIELDS = new Set(["treeSitterEnabled", "llmReviewEnabled", "ciExplanationEnabled"]);
const INFRASTRUCTURE_SECURITY_FIELDS = new Set([
  "infrastructureReviewEnabled",
  "securityReviewEnabled",
  "dependencyReviewEnabled",
  "ciWorkflowReviewEnabled"
]);
const WORKSPACE_CONTROL_FIELDS = new Set([
  "globalWorkspacePolicyEnabled",
  "retentionDays",
  "apiKeyCreationEnabled",
  "billingChangesRequireAdmin",
  "supportSafetyOverridesEnabled"
]);
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

@Injectable()
export class RulesService {
  constructor(
    @Inject(RULES_STORE) private readonly rulesStore: RulesStore,
    @Inject(DASHBOARD_AUTH_STORE) private readonly dashboardAuthStore: DashboardAuthStore
  ) {}

  async getRules(input: RulesRequestContext): Promise<RulesPolicyResponse> {
    const membership = await this.authorize(input, { requireManagePolicies: false });
    const repositoryId = input.repositoryId ?? undefined;

    if (repositoryId !== undefined) {
      assertUuid("repository ID", repositoryId);
    }

    const rules = await this.rulesStore.getRules({
      workspaceId: membership.workspaceId,
      repositoryId,
      accessScope: resolveRepositoryAccessScope({
        role: membership.role,
        clerkUserId: membership.clerkUserId
      })
    });

    if (rules === null) {
      throw new NotFoundException("Rules policy not found");
    }

    return {
      ...rules,
      permissions: {
        canManagePolicies: canManagePolicyScope(membership.role, repositoryId),
        ...policyPermissions(membership.role)
      }
    };
  }

  async updateRules(input: RulesUpdateContext): Promise<RulesPolicyResponse> {
    const { repositoryId, updates } = parseReviewPolicyUpdate(input.body);
    const membership = await this.authorize(input, { requireManagePolicies: false });

    if (!canManagePolicyScope(membership.role, repositoryId)) {
      throw new ForbiddenException(
        repositoryId === null
          ? "Workspace role cannot manage global review policies"
          : "Workspace role cannot manage repository review policies"
      );
    }

    if (updates.workspaceControls !== undefined) {
      if (repositoryId !== null) {
        throw new ForbiddenException("Workspace policy controls cannot be changed on repository policies");
      }

      if (!roleHasDashboardCapability(membership.role, "manage_sensitive_settings")) {
        throw new ForbiddenException("Workspace role cannot manage sensitive workspace policies");
      }
    }

    const updated = await this.rulesStore.updatePolicy({
      workspaceId: membership.workspaceId,
      repositoryId,
      accessScope: resolveRepositoryAccessScope({
        role: membership.role,
        clerkUserId: membership.clerkUserId
      }),
      updates,
      updatedByClerkUserId: membership.clerkUserId
    });

    if (updated === null) {
      throw new NotFoundException("Rules policy not found");
    }

    const rules = await this.rulesStore.getRules({
      workspaceId: membership.workspaceId,
      repositoryId: repositoryId ?? undefined,
      accessScope: resolveRepositoryAccessScope({
        role: membership.role,
        clerkUserId: membership.clerkUserId
      })
    });

    if (rules === null) {
      throw new NotFoundException("Rules policy not found");
    }

    return {
      ...rules,
      selectedRepositoryPolicy: repositoryId === null ? rules.selectedRepositoryPolicy : updated,
      permissions: {
        canManagePolicies: canManagePolicyScope(membership.role, repositoryId),
        ...policyPermissions(membership.role)
      }
    };
  }

  private async authorize(
    input: RulesRequestContext,
    options: { requireManagePolicies: boolean }
  ): Promise<DashboardMembership> {
    assertAuthenticated(input);
    assertUuid("workspace ID", input.workspaceId);

    const membership = await this.dashboardAuthStore.findActiveMembership({
      workspaceId: input.workspaceId,
      clerkUserId: input.clerkUserId
    });

    if (membership === null) {
      throw new NotFoundException("Rules policy not found");
    }

    if (options.requireManagePolicies && !roleHasDashboardCapability(membership.role, "manage_review_policies")) {
      throw new ForbiddenException("Workspace role cannot manage review policies");
    }

    return membership;
  }
}

function canManagePolicyScope(role: DashboardMembership["role"], repositoryId: string | null | undefined): boolean {
  if (repositoryId === undefined || repositoryId === null) {
    return roleHasDashboardCapability(role, "manage_review_policies");
  }

  return (
    roleHasDashboardCapability(role, "manage_review_policies") ||
    roleHasDashboardCapability(role, "manage_repository_configuration")
  );
}

function policyPermissions(role: DashboardMembership["role"]): {
  canManageWorkspacePolicies: boolean;
  canManageRepositoryPolicies: boolean;
  canManageSensitiveWorkspacePolicies: boolean;
} {
  return {
    canManageWorkspacePolicies: roleHasDashboardCapability(role, "manage_review_policies"),
    canManageRepositoryPolicies:
      roleHasDashboardCapability(role, "manage_review_policies") ||
      roleHasDashboardCapability(role, "manage_repository_configuration"),
    canManageSensitiveWorkspacePolicies: roleHasDashboardCapability(role, "manage_sensitive_settings")
  };
}

function parseReviewPolicyUpdate(body: unknown): { repositoryId: string | null; updates: ParsedReviewPolicyUpdate } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestException("Rules policy payload must be an object");
  }

  const payload = body as Record<string, unknown>;

  for (const field of Object.keys(payload)) {
    if (!TOP_LEVEL_UPDATE_FIELDS.has(field)) {
      throw new BadRequestException(`Unknown rules policy field: ${field}`);
    }
  }

  const repositoryId = parseRepositoryId(payload.repositoryId);
  const updates: ParsedReviewPolicyUpdate = {};

  if (payload.reviewPreferences !== undefined) {
    updates.reviewPreferences = parseBooleanObject("reviewPreferences", payload.reviewPreferences, REVIEW_PREFERENCE_FIELDS);
  }

  if (payload.commentPolicy !== undefined) {
    updates.commentPolicy = parseCommentPolicy(payload.commentPolicy);
  }

  if (payload.categories !== undefined) {
    updates.categories = parseBooleanObject("categories", payload.categories, CATEGORY_FIELDS);
  }

  if (payload.promptInstructions !== undefined) {
    updates.promptInstructions = parsePromptInstructions(payload.promptInstructions);
  }

  if (payload.ignoredPaths !== undefined) {
    updates.ignoredPaths = parsePathPatterns("ignoredPaths", payload.ignoredPaths);
  }

  if (payload.generatedFileIgnorePatterns !== undefined) {
    updates.generatedFileIgnorePatterns = parsePathPatterns(
      "generatedFileIgnorePatterns",
      payload.generatedFileIgnorePatterns
    );
  }

  if (payload.semgrep !== undefined) {
    updates.semgrep = parseBooleanObject("semgrep", payload.semgrep, SEMGREP_FIELDS);
  }

  if (payload.analysis !== undefined) {
    updates.analysis = parseBooleanObject("analysis", payload.analysis, ANALYSIS_FIELDS);
  }

  if (payload.infrastructureSecurity !== undefined) {
    updates.infrastructureSecurity = parseBooleanObject(
      "infrastructureSecurity",
      payload.infrastructureSecurity,
      INFRASTRUCTURE_SECURITY_FIELDS
    );
  }

  if (payload.workspaceControls !== undefined) {
    updates.workspaceControls = parseWorkspaceControls(payload.workspaceControls);
  }

  return { repositoryId, updates };
}

function parseRepositoryId(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new BadRequestException("repositoryId must be a UUID string");
  }

  assertUuid("repository ID", value);
  return value;
}

function parseBooleanObject<TField extends string>(
  name: string,
  value: unknown,
  allowedFields: ReadonlySet<TField>
): Partial<Record<TField, boolean>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException(`${name} must be an object`);
  }

  const payload = value as Record<string, unknown>;
  const parsed: Partial<Record<TField, boolean>> = {};

  for (const field of Object.keys(payload)) {
    if (!allowedFields.has(field as TField)) {
      throw new BadRequestException(`Unknown ${name} field: ${field}`);
    }

    if (typeof payload[field] !== "boolean") {
      throw new BadRequestException(`${name}.${field} must be a boolean`);
    }

    parsed[field as TField] = payload[field] as boolean;
  }

  return parsed;
}

function parseCommentPolicy(value: unknown): ParsedReviewPolicyUpdate["commentPolicy"] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("commentPolicy must be an object");
  }

  const payload = value as Record<string, unknown>;
  const parsed: ParsedReviewPolicyUpdate["commentPolicy"] = {};

  for (const field of Object.keys(payload)) {
    if (!COMMENT_POLICY_FIELDS.has(field)) {
      throw new BadRequestException(`Unknown commentPolicy field: ${field}`);
    }
  }

  if (payload.maxInlineComments !== undefined) {
    if (!Number.isInteger(payload.maxInlineComments)) {
      throw new BadRequestException("commentPolicy.maxInlineComments must be an integer");
    }

    if (typeof payload.maxInlineComments !== "number" || payload.maxInlineComments < 0 || payload.maxInlineComments > 50) {
      throw new BadRequestException("commentPolicy.maxInlineComments must be between 0 and 50");
    }

    parsed.maxInlineComments = payload.maxInlineComments;
  }

  if (payload.severityThreshold !== undefined) {
    if (typeof payload.severityThreshold !== "string" || !SEVERITY_THRESHOLDS.has(payload.severityThreshold)) {
      throw new BadRequestException("commentPolicy.severityThreshold must be info, low, medium, high, or critical");
    }

    parsed.severityThreshold = payload.severityThreshold as ReviewPolicyCommentPolicy["severityThreshold"];
  }

  return parsed;
}

function parseWorkspaceControls(value: unknown): ParsedReviewPolicyUpdate["workspaceControls"] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("workspaceControls must be an object");
  }

  const payload = value as Record<string, unknown>;
  const parsed: ParsedReviewPolicyUpdate["workspaceControls"] = {};

  for (const field of Object.keys(payload)) {
    if (!WORKSPACE_CONTROL_FIELDS.has(field)) {
      throw new BadRequestException(`Unknown workspaceControls field: ${field}`);
    }
  }

  for (const field of [
    "globalWorkspacePolicyEnabled",
    "apiKeyCreationEnabled",
    "billingChangesRequireAdmin",
    "supportSafetyOverridesEnabled"
  ] as const) {
    if (payload[field] === undefined) {
      continue;
    }

    if (typeof payload[field] !== "boolean") {
      throw new BadRequestException(`workspaceControls.${field} must be a boolean`);
    }

    parsed[field] = payload[field];
  }

  if (payload.retentionDays !== undefined) {
    if (!Number.isInteger(payload.retentionDays)) {
      throw new BadRequestException("workspaceControls.retentionDays must be an integer");
    }

    if (typeof payload.retentionDays !== "number" || payload.retentionDays < 1 || payload.retentionDays > 365) {
      throw new BadRequestException("workspaceControls.retentionDays must be between 1 and 365");
    }

    parsed.retentionDays = payload.retentionDays;
  }

  return parsed;
}

function parsePromptInstructions(value: unknown): string {
  if (typeof value !== "string") {
    throw new BadRequestException("promptInstructions must be a string");
  }

  if (value.length > MAX_PROMPT_INSTRUCTIONS_LENGTH) {
    throw new BadRequestException(`promptInstructions must be ${MAX_PROMPT_INSTRUCTIONS_LENGTH} characters or fewer`);
  }

  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new BadRequestException("promptInstructions cannot contain control characters");
  }

  if (containsSensitiveValue(value)) {
    throw new BadRequestException("promptInstructions cannot contain secrets or tokens");
  }

  return value;
}

function parsePathPatterns(name: string, value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException(`${name} must be an array`);
  }

  if (value.length > MAX_PATH_PATTERNS) {
    throw new BadRequestException(`${name} cannot contain more than ${MAX_PATH_PATTERNS} entries`);
  }

  return value.map((entry, index) => parsePathPattern(`${name}[${index}]`, entry));
}

function parsePathPattern(name: string, value: unknown): string {
  if (typeof value !== "string") {
    throw new BadRequestException(`${name} must be a string`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new BadRequestException(`${name} cannot be empty`);
  }

  if (trimmed.length > MAX_PATH_PATTERN_LENGTH) {
    throw new BadRequestException(`${name} must be ${MAX_PATH_PATTERN_LENGTH} characters or fewer`);
  }

  if (CONTROL_CHARACTER_PATTERN.test(trimmed)) {
    throw new BadRequestException(`${name} cannot contain control characters`);
  }

  if (trimmed.startsWith("/") || trimmed.startsWith("\\") || /^[A-Za-z]:[\\/]/.test(trimmed)) {
    throw new BadRequestException(`${name} must be repository-relative`);
  }

  if (trimmed.split(/[\\/]+/).includes("..")) {
    throw new BadRequestException(`${name} cannot contain path traversal segments`);
  }

  return trimmed;
}

function containsSensitiveValue(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function assertAuthenticated(input: RulesRequestContext): asserts input is RulesRequestContext & {
  workspaceId: string;
  clerkUserId: string;
} {
  if (input.workspaceId === null || input.clerkUserId === null) {
    throw new UnauthorizedException("Dashboard authentication is required");
  }
}

function assertUuid(label: string, value: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
}
