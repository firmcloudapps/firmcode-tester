import { normalizeDashboardAppRole, type DashboardRole } from "./dashboard-authorization.policy";

/**
 * Repository visibility scope for dashboard data queries.
 *
 * `restrictToClerkUserId === null` means full workspace visibility.
 * A non-null value restricts repository visibility to explicit grants or repos
 * where the user's connected GitHub login authored PR activity.
 *
 * `restrictToOwnPullRequestActivity` additionally limits PR-backed resources to
 * the user's connected GitHub login. If the user has not connected GitHub, this
 * fails closed and returns no PR-backed records.
 */
export interface RepositoryAccessScope {
  readonly restrictToClerkUserId: string | null;
  readonly restrictToOwnPullRequestActivity: boolean;
}

export const FULL_REPOSITORY_ACCESS_SCOPE: RepositoryAccessScope = {
  restrictToClerkUserId: null,
  restrictToOwnPullRequestActivity: false
};

/**
 * Zero-access scope used for the platform admin role.
 * Admin is the platform operator and must not read any customer code data.
 * The empty-string clerk_user_id matches no rows in any access table.
 */
export const NO_REPOSITORY_ACCESS_SCOPE: RepositoryAccessScope = {
  restrictToClerkUserId: "",
  restrictToOwnPullRequestActivity: true
};

export function resolveRepositoryAccessScope(input: {
  readonly role: DashboardRole | string | null | undefined;
  readonly userId?: string | null;
  /** @deprecated Use userId instead */
  readonly clerkUserId?: string | null;
}): RepositoryAccessScope {
  const appRole = normalizeDashboardAppRole(input.role ?? undefined);

  if (appRole === "admin") {
    // Platform admin: no access to customer code data.
    return NO_REPOSITORY_ACCESS_SCOPE;
  }

  const userId = input.userId ?? input.clerkUserId ?? null;
  if (userId === null) {
    // Unknown user — fail closed.
    return NO_REPOSITORY_ACCESS_SCOPE;
  }

  return {
    restrictToClerkUserId: userId,
    restrictToOwnPullRequestActivity: true
  };
}

/**
 * Builds an optional SQL predicate that restricts a query to repositories the
 * scoped user can access. Returns an empty fragment for full-visibility scopes.
 *
 * @param repositoryAlias SQL alias of the `repositories` row in the query (e.g. "r").
 * @param nextParamIndex 1-based positional placeholder index for the next value.
 */
export function buildRepositoryAccessClause(
  scope: RepositoryAccessScope,
  repositoryAlias: string,
  nextParamIndex: number
): { sql: string; values: unknown[] } {
  if (scope.restrictToClerkUserId === null) {
    return { sql: "", values: [] };
  }

  return {
    sql: `(${repositoryAlias}.id IN (SELECT ra.repository_id FROM repository_access ra WHERE ra.clerk_user_id = $${nextParamIndex}) OR ${repositoryAlias}.id IN (
      SELECT pr_scope.repository_id
      FROM pull_requests pr_scope
      JOIN github_oauth_connections goc_scope ON lower(goc_scope.github_login) = lower(pr_scope.author_login)
      WHERE goc_scope.clerk_user_id = $${nextParamIndex}
    ))`,
    values: [scope.restrictToClerkUserId]
  };
}

/**
 * Builds an optional SQL predicate for PR-backed resources. Non-admin dashboard
 * users only see PRs authored by their connected GitHub account.
 */
export function buildOwnPullRequestActivityClause(
  scope: RepositoryAccessScope,
  pullRequestAlias: string,
  nextParamIndex: number
): { sql: string; values: unknown[] } {
  if (!scope.restrictToOwnPullRequestActivity) {
    return { sql: "", values: [] };
  }

  return {
    sql: `lower(${pullRequestAlias}.author_login) IN (
      SELECT lower(goc_scope.github_login)
      FROM github_oauth_connections goc_scope
      WHERE goc_scope.clerk_user_id = $${nextParamIndex}
    )`,
    values: [scope.restrictToClerkUserId ?? ""]
  };
}

/**
 * Appends a repository-access predicate to mutable `conditions`/`values` arrays.
 * No-op for full-visibility scopes. The placeholder index is derived from the
 * current length of `values`, so callers may push other filters before/after.
 */
export function appendRepositoryAccessCondition(
  conditions: string[],
  values: unknown[],
  scope: RepositoryAccessScope,
  repositoryAlias = "r"
): void {
  const clause = buildRepositoryAccessClause(scope, repositoryAlias, values.length + 1);

  if (clause.sql !== "") {
    values.push(...clause.values);
    conditions.push(clause.sql);
  }
}

export function appendOwnPullRequestActivityCondition(
  conditions: string[],
  values: unknown[],
  scope: RepositoryAccessScope,
  pullRequestAlias = "pr"
): void {
  const clause = buildOwnPullRequestActivityClause(scope, pullRequestAlias, values.length + 1);

  if (clause.sql !== "") {
    values.push(...clause.values);
    conditions.push(clause.sql);
  }
}
