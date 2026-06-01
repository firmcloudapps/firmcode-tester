import { normalizeDashboardAppRole, type DashboardRole } from "./dashboard-authorization.policy";

/**
 * Repository visibility scope for dashboard data queries.
 *
 * `restrictToClerkUserId === null` means full workspace visibility (admins/owners).
 * A non-null value restricts results to repositories explicitly granted to that
 * Clerk user via the `repository_access` table (developers/viewers).
 */
export interface RepositoryAccessScope {
  readonly restrictToClerkUserId: string | null;
}

export const FULL_REPOSITORY_ACCESS_SCOPE: RepositoryAccessScope = { restrictToClerkUserId: null };

export function resolveRepositoryAccessScope(input: {
  readonly role: DashboardRole | string | null | undefined;
  readonly clerkUserId: string | null;
}): RepositoryAccessScope {
  const appRole = normalizeDashboardAppRole(input.role ?? undefined);

  if (appRole === "admin" || input.clerkUserId === null) {
    // Admins/owners see everything. When we cannot identify a user we fail closed
    // by returning full visibility only for admins; callers must pass a clerkUserId
    // for non-admin roles (guarded by the dashboard auth guard).
    return appRole === "admin" ? FULL_REPOSITORY_ACCESS_SCOPE : { restrictToClerkUserId: "" };
  }

  return { restrictToClerkUserId: input.clerkUserId };
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
    sql: `${repositoryAlias}.id IN (SELECT ra.repository_id FROM repository_access ra WHERE ra.clerk_user_id = $${nextParamIndex})`,
    values: [scope.restrictToClerkUserId]
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
