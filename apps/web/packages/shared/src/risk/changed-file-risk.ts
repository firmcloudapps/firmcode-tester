import type { UnifiedDiff, UnifiedDiffFile } from "../diff/unified-diff";

export type ChangedFileRiskFlag =
  | "auth"
  | "secrets"
  | "database_migration"
  | "dependency"
  | "infrastructure"
  | "public_api"
  | "ci_workflow";

export type ChangedFileRiskLevel = "low" | "medium" | "high";

export type ChangedFileRiskSource = "path" | "content";

export interface ChangedFileRiskReason {
  readonly flag: ChangedFileRiskFlag;
  readonly source: ChangedFileRiskSource;
  readonly reason: string;
  readonly lineNumber?: number;
}

export interface ChangedFileRiskClassification {
  readonly flags: ChangedFileRiskFlag[];
  readonly level: ChangedFileRiskLevel;
  readonly isInfrastructure: boolean;
  readonly reasons: ChangedFileRiskReason[];
}

export interface ChangedFileRiskInput {
  readonly path: string | null;
  readonly previousPath?: string | null;
  readonly patch?: string | null;
  readonly content?: string | null;
}

export interface ReviewContextChangedFileRisk {
  readonly path: string;
  readonly previousPath: string | null;
  readonly risk: ChangedFileRiskClassification;
}

const EMPTY_RISK_CLASSIFICATION: ChangedFileRiskClassification = {
  flags: [],
  level: "low",
  isInfrastructure: false,
  reasons: []
};

const AUTH_PATH_SEGMENTS = new Set([
  "auth",
  "authentication",
  "authorization",
  "iam",
  "jwt",
  "login",
  "oauth",
  "openid",
  "permission",
  "permissions",
  "rbac",
  "role",
  "roles",
  "security",
  "session",
  "sessions",
  "signin",
  "signup",
  "sso"
]);

const SECRET_PATH_PATTERNS: readonly RegExp[] = [
  /(^|\/)\.env(\.|$)/,
  /(^|\/)\.npmrc$/,
  /(^|\/)\.pypirc$/,
  /(^|\/)\.netrc$/,
  /(^|\/)id_rsa(\.pub)?$/,
  /(^|\/).*(secret|secrets|credential|credentials|keystore|keyring|private-key).*/i,
  /\.(pem|p12|pfx|key|keystore|jks)$/i
];

const DATABASE_MIGRATION_PATH_PATTERNS: readonly RegExp[] = [
  /(^|\/)migrations?\//i,
  /(^|\/)db\/migrate\//i,
  /(^|\/)prisma\/migrations\//i,
  /(^|\/)alembic\/versions\//i,
  /(^|\/)liquibase\//i,
  /(^|\/)flyway\//i,
  /(^|\/)schema\/migrations?\//i,
  /(^|\/)\d{8,}[_-].*\.(sql|py|js|ts)$/i
];

const DEPENDENCY_FILES = new Set([
  "cargo.lock",
  "cargo.toml",
  "composer.json",
  "composer.lock",
  "gemfile",
  "gemfile.lock",
  "go.mod",
  "go.sum",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "pom.xml",
  "pyproject.toml",
  "requirements.in",
  "requirements.txt",
  "uv.lock",
  "yarn.lock"
]);

const DEPENDENCY_FILE_PATTERNS: readonly RegExp[] = [
  /(^|\/)requirements\/.*\.txt$/i,
  /(^|\/)requirements-.*\.txt$/i,
  /(^|\/)build\.gradle(\.kts)?$/i,
  /(^|\/)gradle\.lockfile$/i,
  /(^|\/)deps\.edn$/i,
  /(^|\/)mix\.exs$/i,
  /(^|\/)mix\.lock$/i
];

const INFRA_PATH_PATTERNS: readonly RegExp[] = [
  /(^|\/)dockerfile$/i,
  /(^|\/).*\.dockerfile$/i,
  /(^|\/)docker-compose\.(ya?ml|json)$/i,
  /(^|\/)(infra|infrastructure|terraform|k8s|kubernetes|helm|charts|deploy|deployment|ops)\//i,
  /(^|\/)(serverless|sam|template)\.ya?ml$/i,
  /(^|\/)cloudformation\//i,
  /(^|\/)ansible\//i,
  /(^|\/)playbooks\//i,
  /\.(tf|tfvars|hcl)$/i
];

const CI_WORKFLOW_PATH_PATTERNS: readonly RegExp[] = [
  /^\.github\/workflows\/.+\.ya?ml$/i,
  /^\.gitlab-ci\.ya?ml$/i,
  /^\.circleci\/config\.ya?ml$/i,
  /^\.buildkite\/.+\.ya?ml$/i,
  /^\.drone\.ya?ml$/i,
  /^azure-pipelines\.ya?ml$/i,
  /^bitbucket-pipelines\.ya?ml$/i,
  /(^|\/)jenkinsfile$/i
];

const PUBLIC_API_PATH_PATTERNS: readonly RegExp[] = [
  /(^|\/)(openapi|swagger)\.(json|ya?ml)$/i,
  /(^|\/).*\.proto$/i,
  /(^|\/).*\.graphqls?$/i,
  /(^|\/)(routes?|controllers?|endpoints?)\//i,
  /^(api|apis)\//i,
  /(^|\/)(public-api|sdk)\//i
];

const CONTENT_RULES: ReadonlyArray<{
  readonly flag: ChangedFileRiskFlag;
  readonly pattern: RegExp;
  readonly reason: string;
}> = [
  {
    flag: "secrets",
    pattern:
      /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|database[_-]?url|password|passwd|private[_-]?key|secret)\b\s*[:=]\s*["']?[^"'\s]+/i,
    reason: "adds a value that looks like a secret or credential"
  },
  {
    flag: "secrets",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    reason: "adds private key material"
  },
  {
    flag: "secrets",
    pattern: /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/,
    reason: "adds a token-like credential"
  },
  {
    flag: "auth",
    pattern: /\b(?:authenticate|authorize|jwt|oauth|session|permission|role|rbac|login|logout)\b/i,
    reason: "changes authentication or authorization logic"
  },
  {
    flag: "database_migration",
    pattern: /\b(?:create|alter|drop)\s+(?:table|index|type|view|schema)\b/i,
    reason: "changes database schema operations"
  },
  {
    flag: "dependency",
    pattern: /^\s*["']?(?:dependencies|devDependencies|peerDependencies|optionalDependencies)["']?\s*[:=]/i,
    reason: "changes dependency declarations"
  },
  {
    flag: "infrastructure",
    pattern: /\b(?:resource|provider|container|image|ports|ingress|serviceAccount|kind:\s*(?:Deployment|Service|Ingress|CronJob))\b/i,
    reason: "changes deployment or infrastructure configuration"
  },
  {
    flag: "ci_workflow",
    pattern: /\b(?:github_token|permissions|runs-on|workflow_dispatch|pull_request|push|jobs|steps)\s*:/i,
    reason: "changes CI workflow behavior"
  },
  {
    flag: "public_api",
    pattern:
      /\b(?:export\s+(?:async\s+)?(?:function|class|interface|type|const)|@Controller\b|router\.(?:get|post|put|patch|delete)\b|app\.(?:get|post|put|patch|delete)\b|paths:\s*$|rpc\s+\w+\s*\()/i,
    reason: "changes exported or routed public API surface"
  }
];

const HIGH_RISK_FLAGS = new Set<ChangedFileRiskFlag>(["auth", "secrets", "database_migration"]);
const INFRASTRUCTURE_FLAGS = new Set<ChangedFileRiskFlag>(["infrastructure", "ci_workflow"]);

export function classifyChangedFileRisk(input: ChangedFileRiskInput): ChangedFileRiskClassification {
  const contentToScan = input.patch === null || input.patch === undefined || input.patch.length === 0 ? input.content : "";
  const reasons = [
    ...classifyPathRisk(input.path),
    ...classifyPathRisk(input.previousPath ?? null),
    ...classifyContentRisk(input.patch ?? ""),
    ...classifyContentRisk(contentToScan ?? "")
  ];

  return buildRiskClassification(reasons);
}

export function classifyPathRisk(path: string | null): ChangedFileRiskReason[] {
  if (path === null || path.trim().length === 0) {
    return [];
  }

  const normalizedPath = normalizePath(path);
  const basename = normalizedPath.split("/").at(-1) ?? normalizedPath;
  const reasons: ChangedFileRiskReason[] = [];

  if (pathHasAnySegment(normalizedPath, AUTH_PATH_SEGMENTS)) {
    reasons.push({
      flag: "auth",
      source: "path",
      reason: "path is in an authentication, authorization, or security area"
    });
  }

  if (matchesAny(normalizedPath, SECRET_PATH_PATTERNS)) {
    reasons.push({
      flag: "secrets",
      source: "path",
      reason: "path is a secrets or credential file"
    });
  }

  if (matchesAny(normalizedPath, DATABASE_MIGRATION_PATH_PATTERNS)) {
    reasons.push({
      flag: "database_migration",
      source: "path",
      reason: "path is a database migration file"
    });
  }

  if (DEPENDENCY_FILES.has(basename) || matchesAny(normalizedPath, DEPENDENCY_FILE_PATTERNS)) {
    reasons.push({
      flag: "dependency",
      source: "path",
      reason: "path is a dependency manifest or lockfile"
    });
  }

  if (matchesAny(normalizedPath, INFRA_PATH_PATTERNS)) {
    reasons.push({
      flag: "infrastructure",
      source: "path",
      reason: "path is deployment or infrastructure configuration"
    });
  }

  if (matchesAny(normalizedPath, CI_WORKFLOW_PATH_PATTERNS)) {
    reasons.push({
      flag: "ci_workflow",
      source: "path",
      reason: "path is a CI workflow definition"
    });
  }

  if (matchesAny(normalizedPath, PUBLIC_API_PATH_PATTERNS)) {
    reasons.push({
      flag: "public_api",
      source: "path",
      reason: "path is part of a public API surface"
    });
  }

  return reasons;
}

export function classifyContentRisk(content: string): ChangedFileRiskReason[] {
  if (content.trim().length === 0) {
    return [];
  }

  const reasons: ChangedFileRiskReason[] = [];
  const normalizedLines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const diffLike = normalizedLines.some((line) => line.startsWith("@@ ")) || normalizedLines.some((line) => line.startsWith("diff --git "));

  for (const [index, rawLine] of normalizedLines.entries()) {
    const line = readAddedOrPlainLine(rawLine, diffLike);

    if (line === null) {
      continue;
    }

    for (const rule of CONTENT_RULES) {
      if (rule.pattern.test(line)) {
        reasons.push({
          flag: rule.flag,
          source: "content",
          reason: rule.reason,
          lineNumber: index + 1
        });
      }
    }
  }

  return reasons;
}

export function classifyUnifiedDiffRisk(diff: UnifiedDiff): ReviewContextChangedFileRisk[] {
  return diff.files
    .map((file): ReviewContextChangedFileRisk | null => {
      const path = file.newPath ?? file.oldPath;

      if (path === null) {
        return null;
      }

      return {
        path,
        previousPath: file.oldPath === file.newPath ? null : file.oldPath,
        risk: classifyChangedFileRisk({
          path: file.newPath,
          previousPath: file.oldPath,
          patch: serializeUnifiedDiffFileAdditions(file)
        })
      };
    })
    .filter((file): file is ReviewContextChangedFileRisk => file !== null);
}

function buildRiskClassification(reasons: ChangedFileRiskReason[]): ChangedFileRiskClassification {
  if (reasons.length === 0) {
    return EMPTY_RISK_CLASSIFICATION;
  }

  const flags = [...new Set(reasons.map((reason) => reason.flag))].sort(compareRiskFlags);
  const level = flags.some((flag) => HIGH_RISK_FLAGS.has(flag)) ? "high" : "medium";
  const isInfrastructure = flags.some((flag) => INFRASTRUCTURE_FLAGS.has(flag));

  return {
    flags,
    level,
    isInfrastructure,
    reasons: dedupeReasons(reasons)
  };
}

function serializeUnifiedDiffFileAdditions(file: UnifiedDiffFile): string {
  return file.hunks
    .flatMap((hunk) =>
      hunk.lines
        .filter((line) => line.type === "addition")
        .map((line) => `+${line.content}`)
    )
    .join("\n");
}

function dedupeReasons(reasons: ChangedFileRiskReason[]): ChangedFileRiskReason[] {
  const seen = new Set<string>();
  const deduped: ChangedFileRiskReason[] = [];

  for (const reason of reasons) {
    const key = `${reason.flag}:${reason.source}:${reason.reason}:${reason.lineNumber ?? ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(reason);
  }

  return deduped;
}

function compareRiskFlags(left: ChangedFileRiskFlag, right: ChangedFileRiskFlag): number {
  const leftIndex = RISK_FLAG_ORDER.indexOf(left);
  const rightIndex = RISK_FLAG_ORDER.indexOf(right);

  return leftIndex - rightIndex;
}

const RISK_FLAG_ORDER: readonly ChangedFileRiskFlag[] = [
  "auth",
  "secrets",
  "database_migration",
  "dependency",
  "infrastructure",
  "public_api",
  "ci_workflow"
];

function readAddedOrPlainLine(rawLine: string, diffLike: boolean): string | null {
  if (rawLine.startsWith("+++") || rawLine.startsWith("---")) {
    return null;
  }

  if (rawLine.startsWith("+")) {
    return rawLine.slice(1);
  }

  if (rawLine.startsWith("-") || diffLike) {
    return null;
  }

  return rawLine;
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function pathHasAnySegment(path: string, segments: ReadonlySet<string>): boolean {
  return path.split("/").some((segment) => segments.has(segment));
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "").toLowerCase();
}
