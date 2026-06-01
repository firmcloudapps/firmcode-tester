import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations } from "../src/infrastructure/database/migrations";
import { PostgresDashboardAuthStore } from "../src/modules/review-runs/dashboard-auth.store";
import { RulesController } from "../src/modules/rules/rules.controller";
import { RulesService } from "../src/modules/rules/rules.service";
import { PostgresRulesStore } from "../src/modules/rules/rules.store";

interface PgPoolLike {
  query<Row = unknown>(sql: string, values?: readonly unknown[]): Promise<{ rows: Row[] }>;
  end(): Promise<void>;
}

const WORKSPACE_ID = "00000000-0000-4000-8000-000000000101";
const OTHER_WORKSPACE_ID = "00000000-0000-4000-8000-000000000102";
const REPOSITORY_ID = "00000000-0000-4000-8000-000000000201";
const OTHER_REPOSITORY_ID = "00000000-0000-4000-8000-000000000202";
const OWNER_USER_ID = "user_owner";
const ADMIN_USER_ID = "user_admin";
const DEVELOPER_USER_ID = "user_developer";
const VIEWER_USER_ID = "user_viewer";

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

describe("rules and policies dashboard API", () => {
  let pool: PgPoolLike;
  let controller: RulesController;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    await seedRulesData(pool);

    controller = new RulesController(new RulesService(new PostgresRulesStore(pool), new PostgresDashboardAuthStore(pool)));
  });

  afterEach(async () => {
    await pool.end();
  });

  it("reads workspace review policies with typed defaults and Owner/Admin permissions", async () => {
    const response = await controller.getRules(undefined, WORKSPACE_ID, OWNER_USER_ID);

    expect(response.workspacePolicy).toMatchObject({
      workspaceId: WORKSPACE_ID,
      repositoryId: null,
      scope: "workspace",
      reviewPreferences: {
        reviewDraftPullRequests: false,
        requireTestsForRiskyChanges: true,
        suggestMissingTests: true
      },
      commentPolicy: {
        maxInlineComments: 10,
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
      promptInstructions: "",
      ignoredPaths: [],
      generatedFileIgnorePatterns: [],
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
      updatedByClerkUserId: null
    });
    expect(response.permissions.canManagePolicies).toBe(true);
    expect(response.permissions.canManageWorkspacePolicies).toBe(true);
    expect(response.permissions.canManageRepositoryPolicies).toBe(true);
    expect(response.permissions.canManageSensitiveWorkspacePolicies).toBe(true);
    expect(response.repositoryPolicies).toEqual([]);
  });

  it("allows Developer and Viewer roles to read policies as read-only", async () => {
    const developer = await controller.getRules(undefined, WORKSPACE_ID, DEVELOPER_USER_ID);
    const developerRepository = await controller.getRules(REPOSITORY_ID, WORKSPACE_ID, DEVELOPER_USER_ID);
    const viewer = await controller.getRules(undefined, WORKSPACE_ID, VIEWER_USER_ID);

    expect(developer.permissions.canManagePolicies).toBe(false);
    expect(developerRepository.permissions.canManagePolicies).toBe(true);
    expect(developer.permissions.canManageWorkspacePolicies).toBe(false);
    expect(developer.permissions.canManageRepositoryPolicies).toBe(true);
    expect(developer.permissions.canManageSensitiveWorkspacePolicies).toBe(false);
    expect(viewer.permissions.canManagePolicies).toBe(false);
    expect(developer.workspacePolicy.commentPolicy.severityThreshold).toBe("medium");
    expect(developerRepository.selectedRepositoryPolicy?.repositoryId).toBe(REPOSITORY_ID);
    expect(viewer.workspacePolicy.commentPolicy.maxInlineComments).toBe(10);
  });

  it("updates workspace policy fields for owners and preserves unrelated fields on partial updates", async () => {
    await controller.updateRules(
      {
        commentPolicy: {
          maxInlineComments: 5,
          severityThreshold: "high"
        },
        categories: {
          performance: false,
          ci: false
        },
        promptInstructions: "Prefer focused comments with concrete evidence.",
        ignoredPaths: ["docs/generated/**", "snapshots/*.snap"],
        generatedFileIgnorePatterns: ["**/*.generated.ts"],
        semgrep: {
          enabled: false
        },
        analysis: {
          llmReviewEnabled: false
        },
        infrastructureSecurity: {
          dependencyReviewEnabled: false
        },
        workspaceControls: {
          retentionDays: 45,
          apiKeyCreationEnabled: true,
          supportSafetyOverridesEnabled: true
        }
      },
      WORKSPACE_ID,
      OWNER_USER_ID
    );
    const response = await controller.updateRules(
      {
        reviewPreferences: {
          suggestMissingTests: false
        }
      },
      WORKSPACE_ID,
      ADMIN_USER_ID
    );

    expect(response.workspacePolicy).toMatchObject({
      reviewPreferences: {
        reviewDraftPullRequests: false,
        requireTestsForRiskyChanges: true,
        suggestMissingTests: false
      },
      commentPolicy: {
        maxInlineComments: 5,
        severityThreshold: "high"
      },
      categories: {
        performance: false,
        ci: false,
        security: true
      },
      promptInstructions: "Prefer focused comments with concrete evidence.",
      ignoredPaths: ["docs/generated/**", "snapshots/*.snap"],
      generatedFileIgnorePatterns: ["**/*.generated.ts"],
      semgrep: {
        enabled: false,
        includeInfrastructureRules: true
      },
      analysis: {
        treeSitterEnabled: true,
        llmReviewEnabled: false
      },
      infrastructureSecurity: {
        dependencyReviewEnabled: false,
        securityReviewEnabled: true
      },
      workspaceControls: {
        retentionDays: 45,
        apiKeyCreationEnabled: true,
        billingChangesRequireAdmin: true,
        supportSafetyOverridesEnabled: true
      },
      updatedByClerkUserId: ADMIN_USER_ID
    });
  });

  it("updates repository-specific policies only when the repository belongs to the caller workspace", async () => {
    const response = await controller.updateRules(
      {
        repositoryId: REPOSITORY_ID,
        commentPolicy: {
          severityThreshold: "critical"
        },
        ignoredPaths: ["fixtures/**"]
      },
      WORKSPACE_ID,
      OWNER_USER_ID
    );

    expect(response.selectedRepositoryPolicy).toMatchObject({
      repositoryId: REPOSITORY_ID,
      scope: "repository",
      commentPolicy: {
        maxInlineComments: 10,
        severityThreshold: "critical"
      },
      ignoredPaths: ["fixtures/**"],
      updatedByClerkUserId: OWNER_USER_ID
    });
    expect(response.repositoryPolicies).toHaveLength(1);
    expect(response.repositoryPolicies[0]).toMatchObject({
      repositoryId: REPOSITORY_ID,
      fullName: "openclaw/firmcode"
    });

    const developerResponse = await controller.updateRules(
      {
        repositoryId: REPOSITORY_ID,
        semgrep: {
          includeInfrastructureRules: false
        },
        infrastructureSecurity: {
          securityReviewEnabled: false
        }
      },
      WORKSPACE_ID,
      DEVELOPER_USER_ID
    );

    expect(developerResponse.selectedRepositoryPolicy).toMatchObject({
      repositoryId: REPOSITORY_ID,
      semgrep: {
        enabled: true,
        includeInfrastructureRules: false
      },
      infrastructureSecurity: {
        securityReviewEnabled: false,
        dependencyReviewEnabled: true
      },
      updatedByClerkUserId: DEVELOPER_USER_ID
    });
  });

  it("rejects invalid policy field names, types, thresholds, and prompt formats", async () => {
    await expect(controller.updateRules({ unknown: true }, WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRules({ commentPolicy: { maxInlineComments: 51 } }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRules({ commentPolicy: { severityThreshold: "urgent" } }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRules({ categories: { security: "yes" } }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRules({ promptInstructions: "x".repeat(4_001) }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRules({ promptInstructions: "review\u0000everything" }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRules({ workspaceControls: { retentionDays: 0 } }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRules({ workspaceControls: { apiKeyCreationEnabled: "yes" } }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
  });

  it("validates ignored paths and generated-file ignore patterns as repository-relative safe patterns", async () => {
    await expect(controller.updateRules({ ignoredPaths: ["/etc/passwd"] }, WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(controller.updateRules({ ignoredPaths: ["../secrets"] }, WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(
      BadRequestException
    );
    await expect(
      controller.updateRules({ generatedFileIgnorePatterns: [""] }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRules({ generatedFileIgnorePatterns: ["a".repeat(241)] }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
    await expect(
      controller.updateRules({ ignoredPaths: Array.from({ length: 101 }, (_, index) => `path-${index}`) }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(BadRequestException);
  });

  it("requires Owner/Admin for mutations and denies cross-workspace policy targets", async () => {
    await expect(controller.getRules(undefined, WORKSPACE_ID, undefined)).rejects.toThrow(UnauthorizedException);
    await expect(
      controller.updateRules({ commentPolicy: { maxInlineComments: 3 } }, WORKSPACE_ID, DEVELOPER_USER_ID)
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.updateRules({ workspaceControls: { retentionDays: 45 } }, WORKSPACE_ID, DEVELOPER_USER_ID)
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.updateRules({ repositoryId: REPOSITORY_ID, workspaceControls: { retentionDays: 45 } }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.updateRules({ commentPolicy: { maxInlineComments: 3 } }, WORKSPACE_ID, VIEWER_USER_ID)
    ).rejects.toThrow(ForbiddenException);
    await expect(controller.getRules(OTHER_REPOSITORY_ID, WORKSPACE_ID, OWNER_USER_ID)).rejects.toThrow(NotFoundException);
    await expect(
      controller.updateRules({ repositoryId: OTHER_REPOSITORY_ID, ignoredPaths: ["private/**"] }, WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(NotFoundException);
    await expect(
      controller.updateRules({ repositoryId: REPOSITORY_ID, ignoredPaths: ["private/**"] }, OTHER_WORKSPACE_ID, OWNER_USER_ID)
    ).rejects.toThrow(NotFoundException);
  });

  it("rejects sensitive prompt instructions without storing or returning the secret", async () => {
    const secret = "ghp_abcdefghijklmnopqrstuvwxyz123456";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await expect(
        controller.updateRules({ promptInstructions: `Use this token ${secret}` }, WORKSPACE_ID, OWNER_USER_ID)
      ).rejects.toThrow(BadRequestException);
      const response = await controller.getRules(undefined, WORKSPACE_ID, OWNER_USER_ID);
      const stored = await pool.query<{ prompt_instructions: string }>(
        "SELECT prompt_instructions FROM review_policies WHERE workspace_id = $1",
        [WORKSPACE_ID]
      );

      expect(JSON.stringify(response)).not.toContain(secret);
      expect(JSON.stringify(stored.rows)).not.toContain(secret);
      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

async function seedRulesData(pool: PgPoolLike): Promise<void> {
  await pool.query(
    `
INSERT INTO workspaces (id, clerk_org_id, name) VALUES
('${WORKSPACE_ID}', 'org_firmcode', 'Firmcode'),
('${OTHER_WORKSPACE_ID}', 'org_other', 'Other');

INSERT INTO workspace_memberships (workspace_id, clerk_user_id, role, active) VALUES
('${WORKSPACE_ID}', '${OWNER_USER_ID}', 'owner', true),
('${WORKSPACE_ID}', '${ADMIN_USER_ID}', 'admin', true),
('${WORKSPACE_ID}', '${DEVELOPER_USER_ID}', 'developer', true),
('${WORKSPACE_ID}', '${VIEWER_USER_ID}', 'viewer', true);

INSERT INTO github_installations (
  id,
  workspace_id,
  installation_id,
  account_login,
  account_type,
  permissions_json
) VALUES
(
  '00000000-0000-4000-8000-000000000301',
  '${WORKSPACE_ID}',
  301,
  'openclaw',
  'Organization',
  '{"pull_requests":"write"}'
),
(
  '00000000-0000-4000-8000-000000000302',
  '${OTHER_WORKSPACE_ID}',
  302,
  'other',
  'Organization',
  '{"pull_requests":"write"}'
);

INSERT INTO repositories (
  id,
  installation_id,
  github_repository_id,
  owner,
  name,
  full_name,
  private,
  default_branch,
  enabled
) VALUES
(
  '${REPOSITORY_ID}',
  '00000000-0000-4000-8000-000000000301',
  201,
  'openclaw',
  'firmcode',
  'openclaw/firmcode',
  false,
  'main',
  true
),
(
  '${OTHER_REPOSITORY_ID}',
  '00000000-0000-4000-8000-000000000302',
  202,
  'other',
  'private-fork',
  'other/private-fork',
  true,
  'main',
  true
);

INSERT INTO repository_access (repository_id, clerk_user_id, granted_by_clerk_user_id) VALUES
('${REPOSITORY_ID}', '${DEVELOPER_USER_ID}', '${OWNER_USER_ID}'),
('${REPOSITORY_ID}', '${VIEWER_USER_ID}', '${OWNER_USER_ID}');
`
  );
}
