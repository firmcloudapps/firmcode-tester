import { ForbiddenException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations, type DatabaseExecutor } from "../src/infrastructure/database/migrations";
import type { VerifiedClerkToken } from "../src/modules/auth/clerk-token-verifier";
import { PostgresDashboardWorkspaceResolver } from "../src/modules/auth/workspace-resolver";

interface PgPoolLike extends DatabaseExecutor {
  end(): Promise<void>;
}

function createTestPool(): PgPoolLike {
  const db = newDb({ autoCreateForeignKeyIndices: true, noAstCoverageCheck: true });
  const adapters = db.adapters.createPg();

  return new adapters.Pool();
}

function createDeterministicUuidFactory(): () => string {
  let index = 0;

  return () => {
    index += 1;
    return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
  };
}

describe("PostgresDashboardWorkspaceResolver", () => {
  let pool: PgPoolLike;
  let resolver: PostgresDashboardWorkspaceResolver;

  beforeEach(async () => {
    pool = createTestPool();
    await runDatabaseMigrations(pool);
    resolver = new PostgresDashboardWorkspaceResolver(pool, createDeterministicUuidFactory());
  });

  afterEach(async () => {
    await pool.end();
  });

  it("creates personal workspace users as Developer by default and repeats idempotently", async () => {
    const first = await resolver.resolve({
      token: createToken({ clerkUserId: "user_personal" }),
      selectedWorkspaceId: null
    });
    const second = await resolver.resolve({
      token: createToken({ clerkUserId: "user_personal" }),
      selectedWorkspaceId: null
    });
    const later = await resolver.resolve({
      token: createToken({ clerkUserId: "user_later" }),
      selectedWorkspaceId: null
    });
    const workspaceCount = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM workspaces");
    const membershipCount = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM workspace_memberships"
    );

    expect(first).toMatchObject({
      workspaceId: "00000000-0000-4000-8000-000000000001",
      clerkUserId: "user_personal",
      clerkOrgId: null,
      role: "developer"
    });
    expect(second).toEqual(first);
    expect(later).toMatchObject({
      workspaceId: "00000000-0000-4000-8000-000000000002",
      clerkUserId: "user_later",
      clerkOrgId: null,
      role: "developer"
    });
    expect(workspaceCount.rows[0]).toEqual({ count: "2" });
    expect(membershipCount.rows[0]).toEqual({ count: "2" });
  });

  it("preserves an internally seeded personal Admin role instead of downgrading it", async () => {
    await insertWorkspace("00000000-0000-4000-8000-000000000101", null, "Seeded support workspace");
    await insertMembership("00000000-0000-4000-8000-000000000101", "user_seeded", "admin", true);

    const resolved = await resolver.resolve({
      token: createToken({ clerkUserId: "user_seeded" }),
      selectedWorkspaceId: null
    });

    expect(resolved.role).toBe("admin");
  });

  it("syncs personal workspace Admin promotion from trusted Clerk metadata", async () => {
    await insertWorkspace("00000000-0000-4000-8000-000000000111", null, "Existing personal workspace");
    await insertMembership("00000000-0000-4000-8000-000000000111", "user_existing", "developer", true);

    const resolved = await resolver.resolve({
      token: createToken({
        clerkUserId: "user_existing",
        firmcodeRole: "admin"
      }),
      selectedWorkspaceId: null
    });
    const audits = await pool.query<{ previous_role: string | null; next_role: string | null; source: string }>(
      "SELECT previous_role, next_role, source FROM workspace_audit_events WHERE workspace_id = $1",
      ["00000000-0000-4000-8000-000000000111"]
    );

    expect(resolved.role).toBe("admin");
    expect(audits.rows).toEqual([
      {
        previous_role: "developer",
        next_role: "admin",
        source: "clerk_firmcode_role_metadata"
      }
    ]);
  });

  it("creates and resolves one workspace per Clerk organization", async () => {
    const first = await resolver.resolve({
      token: createToken({
        clerkUserId: "user_member",
        clerkOrgId: "org_firmcode",
        orgRole: "org:member"
      }),
      selectedWorkspaceId: null
    });
    const second = await resolver.resolve({
      token: createToken({
        clerkUserId: "user_admin",
        clerkOrgId: "org_firmcode",
        orgRole: "org:admin"
      }),
      selectedWorkspaceId: null
    });
    const workspaces = await pool.query<{ id: string; clerk_org_id: string | null }>(
      "SELECT id, clerk_org_id FROM workspaces ORDER BY created_at"
    );

    expect(first).toMatchObject({
      workspaceId: "00000000-0000-4000-8000-000000000001",
      clerkOrgId: "org_firmcode",
      role: "developer"
    });
    expect(second).toMatchObject({
      workspaceId: first.workspaceId,
      clerkOrgId: "org_firmcode",
      role: "admin"
    });
    expect(workspaces.rows).toEqual([{ id: first.workspaceId, clerk_org_id: "org_firmcode" }]);
  });

  it("treats Clerk organization roles as the authoritative Firmcode role source", async () => {
    const member = await resolver.resolve({
      token: createToken({
        clerkUserId: "user_metadata_member",
        clerkOrgId: "org_metadata",
        orgRole: "org:member",
        firmcodeRole: "admin"
      }),
      selectedWorkspaceId: null
    });
    const fallbackAdmin = await resolver.resolve({
      token: createToken({
        clerkUserId: "user_metadata_admin",
        clerkOrgId: "org_metadata",
        orgRole: "org:custom",
        firmcodeRole: "admin"
      }),
      selectedWorkspaceId: null
    });

    expect(member.role).toBe("developer");
    expect(fallbackAdmin.role).toBe("admin");
  });

  it("maps Clerk organization Admins to Admin and members to Developer", async () => {
    const admin = await resolver.resolve({
      token: createToken({
        clerkUserId: "user_admin",
        clerkOrgId: "org_roles",
        orgRole: "org:admin"
      }),
      selectedWorkspaceId: null
    });
    const owner = await resolver.resolve({
      token: createToken({
        clerkUserId: "user_owner",
        clerkOrgId: "org_roles",
        orgRole: "org:owner",
        firmcodeRole: "admin"
      }),
      selectedWorkspaceId: null
    });
    const member = await resolver.resolve({
      token: createToken({
        clerkUserId: "user_member",
        clerkOrgId: "org_roles",
        orgRole: "org:member"
      }),
      selectedWorkspaceId: null
    });

    expect(admin.role).toBe("admin");
    expect(owner.role).toBe("admin");
    expect(member.role).toBe("developer");
  });

  it("denies inactive memberships instead of repairing them active", async () => {
    await insertWorkspace("00000000-0000-4000-8000-000000000201", "org_inactive", "Inactive org");
    await insertMembership("00000000-0000-4000-8000-000000000201", "user_inactive", "developer", false);

    await expect(
      resolver.resolve({
        token: createToken({
          clerkUserId: "user_inactive",
          clerkOrgId: "org_inactive",
          orgRole: "org:member"
        }),
        selectedWorkspaceId: null
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    const membership = await pool.query<{ active: boolean }>(
      "SELECT active FROM workspace_memberships WHERE workspace_id = $1 AND clerk_user_id = $2",
      ["00000000-0000-4000-8000-000000000201", "user_inactive"]
    );
    expect(membership.rows[0]).toEqual({ active: false });
  });

  it("switches to a selected active workspace only when the user belongs to it", async () => {
    await insertWorkspace("00000000-0000-4000-8000-000000000301", null, "Personal");
    await insertWorkspace("00000000-0000-4000-8000-000000000302", "org_selected", "Selected org");
    await insertWorkspace("00000000-0000-4000-8000-000000000303", "org_other", "Other org");
    await insertMembership("00000000-0000-4000-8000-000000000301", "user_switch", "developer", true);
    await insertMembership("00000000-0000-4000-8000-000000000302", "user_switch", "admin", true);

    const selectedOrg = await resolver.resolve({
      token: createToken({ clerkUserId: "user_switch" }),
      selectedWorkspaceId: "00000000-0000-4000-8000-000000000302"
    });
    const selectedPersonal = await resolver.resolve({
      token: createToken({
        clerkUserId: "user_switch",
        clerkOrgId: "org_selected",
        orgRole: "org:admin"
      }),
      selectedWorkspaceId: "00000000-0000-4000-8000-000000000301"
    });

    expect(selectedOrg).toMatchObject({
      workspaceId: "00000000-0000-4000-8000-000000000302",
      clerkOrgId: "org_selected",
      role: "admin"
    });
    expect(selectedPersonal).toMatchObject({
      workspaceId: "00000000-0000-4000-8000-000000000301",
      clerkOrgId: null,
      role: "developer"
    });
    await expect(
      resolver.resolve({
        token: createToken({ clerkUserId: "user_switch" }),
        selectedWorkspaceId: "00000000-0000-4000-8000-000000000303"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("writes audit events for elevated role grants and removals", async () => {
    await insertWorkspace("00000000-0000-4000-8000-000000000401", "org_audit", "Audit org");
    await insertMembership("00000000-0000-4000-8000-000000000401", "user_audit", "developer", true);

    await resolver.resolve({
      token: createToken({
        clerkUserId: "user_audit",
        clerkOrgId: "org_audit",
        orgRole: "org:admin"
      }),
      selectedWorkspaceId: null
    });
    await resolver.resolve({
      token: createToken({
        clerkUserId: "user_audit",
        clerkOrgId: "org_audit",
        orgRole: "org:member"
      }),
      selectedWorkspaceId: null
    });

    const audits = await pool.query<{
      actor_clerk_user_id: string;
      target_clerk_user_id: string;
      previous_role: string | null;
      next_role: string | null;
      source: string;
    }>(
      `
SELECT actor_clerk_user_id, target_clerk_user_id, previous_role, next_role, source
FROM workspace_audit_events
WHERE workspace_id = $1
ORDER BY created_at, id
`,
      ["00000000-0000-4000-8000-000000000401"]
    );

    expect(audits.rows).toEqual([
      {
        actor_clerk_user_id: "user_audit",
        target_clerk_user_id: "user_audit",
        previous_role: "developer",
        next_role: "admin",
        source: "clerk_organization_role"
      },
      {
        actor_clerk_user_id: "user_audit",
        target_clerk_user_id: "user_audit",
        previous_role: "admin",
        next_role: "developer",
        source: "clerk_organization_role"
      }
    ]);
  });

  async function insertWorkspace(id: string, clerkOrgId: string | null, name: string): Promise<void> {
    await pool.query(
      "INSERT INTO workspaces (id, clerk_org_id, name) VALUES ($1, $2, $3)",
      [id, clerkOrgId, name]
    );
  }

  async function insertMembership(
    workspaceId: string,
    clerkUserId: string,
    role: "owner" | "admin" | "developer" | "viewer",
    active: boolean
  ): Promise<void> {
    await pool.query(
      "INSERT INTO workspace_memberships (workspace_id, clerk_user_id, role, active) VALUES ($1, $2, $3, $4)",
      [workspaceId, clerkUserId, role, active]
    );
  }
});

function createToken(overrides: Partial<VerifiedClerkToken>): VerifiedClerkToken {
  return {
    clerkUserId: "user_default",
    clerkOrgId: null,
    sessionId: "sess_default",
    orgRole: null,
    firmcodeRole: null,
    billingCapabilities: [],
    ...overrides
  };
}
