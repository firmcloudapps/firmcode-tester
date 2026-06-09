import { ForbiddenException } from "@nestjs/common";
import { newDb } from "pg-mem";
import { runDatabaseMigrations, type DatabaseExecutor } from "../src/infrastructure/database/migrations";
import type { VerifiedToken } from "../src/modules/auth/token-verifier";
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
      token: createToken({ userId: "user_personal" }),
      selectedWorkspaceId: null
    });
    const second = await resolver.resolve({
      token: createToken({ userId: "user_personal" }),
      selectedWorkspaceId: null
    });
    const later = await resolver.resolve({
      token: createToken({ userId: "user_later" }),
      selectedWorkspaceId: null
    });
    const workspaceCount = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM workspaces");
    const membershipCount = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM workspace_memberships"
    );

    expect(first).toMatchObject({
      workspaceId: "00000000-0000-4000-8000-000000000001",
      userId: "user_personal",
      orgId: null,
      role: "developer"
    });
    expect(second).toEqual(first);
    expect(later).toMatchObject({
      workspaceId: "00000000-0000-4000-8000-000000000002",
      userId: "user_later",
      orgId: null,
      role: "developer"
    });
    expect(workspaceCount.rows[0]).toEqual({ count: "2" });
    expect(membershipCount.rows[0]).toEqual({ count: "2" });
  });

  it("preserves an internally seeded personal Admin role instead of downgrading it", async () => {
    await insertWorkspace("00000000-0000-4000-8000-000000000101", null, "Seeded support workspace");
    await insertMembership("00000000-0000-4000-8000-000000000101", "user_seeded", "admin", true);

    const resolved = await resolver.resolve({
      token: createToken({ userId: "user_seeded" }),
      selectedWorkspaceId: null
    });

    expect(resolved.role).toBe("admin");
  });

  it("stores user profile data and preserves DB-managed personal roles over token metadata", async () => {
    await insertWorkspace("00000000-0000-4000-8000-000000000111", null, "Existing personal workspace");
    await insertMembership("00000000-0000-4000-8000-000000000111", "user_existing", "developer", true);

    const resolved = await resolver.resolve({
      token: createToken({
        userId: "user_existing",
        firmcodeRole: "admin",
        email: "existing@example.com",
        emailVerified: true
      }),
      selectedWorkspaceId: null
    });
    const audits = await pool.query<{ previous_role: string | null; next_role: string | null; source: string }>(
      "SELECT previous_role, next_role, source FROM workspace_audit_events WHERE workspace_id = $1",
      ["00000000-0000-4000-8000-000000000111"]
    );
    const profile = await pool.query<{ id: string; email: string | null; email_verified: boolean; identity_provider: string }>(
      "SELECT id, email, email_verified, identity_provider FROM user_profiles WHERE id = $1",
      ["user_existing"]
    );

    expect(resolved.role).toBe("developer");
    expect(audits.rows).toEqual([]);
    expect(profile.rows[0]).toEqual({
      id: "user_existing",
      email: "existing@example.com",
      email_verified: true,
      identity_provider: "insforge"
    });
  });

  it("creates and resolves one workspace per provider organization", async () => {
    const first = await resolver.resolve({
      token: createToken({
        userId: "user_member",
        orgId: "org_firmcode",
        orgRole: "org:developer"
      }),
      selectedWorkspaceId: null
    });
    const second = await resolver.resolve({
      token: createToken({
        userId: "user_admin",
        orgId: "org_firmcode",
        orgRole: "org:admin"
      }),
      selectedWorkspaceId: null
    });
    const workspaces = await pool.query<{ id: string; identity_provider_org_id: string | null }>(
      "SELECT id, identity_provider_org_id FROM workspaces ORDER BY created_at"
    );

    expect(first).toMatchObject({
      workspaceId: "00000000-0000-4000-8000-000000000001",
      orgId: "org_firmcode",
      role: "developer"
    });
    expect(second).toMatchObject({
      workspaceId: first.workspaceId,
      orgId: "org_firmcode",
      role: "developer"
    });
    expect(workspaces.rows).toEqual([{ id: first.workspaceId, identity_provider_org_id: "org_firmcode" }]);
  });

  it("resolves organization-less signup sessions into the configured default provider organization", async () => {
    const defaultOrgResolver = new PostgresDashboardWorkspaceResolver(pool, createDeterministicUuidFactory(), {
      id: "org_3EGsxXDTl8pWEfV6da6oENrYhRr",
      name: "Firmcode AI"
    });

    const resolved = await defaultOrgResolver.resolve({
      token: createToken({ userId: "user_signup" }),
      selectedWorkspaceId: null
    });
    const workspace = await pool.query<{ identity_provider_org_id: string | null; name: string }>(
      "SELECT identity_provider_org_id, name FROM workspaces WHERE id = $1",
      [resolved.workspaceId]
    );

    expect(resolved).toMatchObject({
      userId: "user_signup",
      orgId: "org_3EGsxXDTl8pWEfV6da6oENrYhRr",
      role: "developer"
    });
    expect(workspace.rows[0]).toEqual({
      identity_provider_org_id: "org_3EGsxXDTl8pWEfV6da6oENrYhRr",
      name: "Firmcode AI"
    });
  });

  it("preserves an existing default organization Admin membership during signup repair", async () => {
    await insertWorkspace("00000000-0000-4000-8000-000000000151", "org_default", "Firmcode AI");
    await insertMembership("00000000-0000-4000-8000-000000000151", "user_admin", "admin", true);
    const defaultOrgResolver = new PostgresDashboardWorkspaceResolver(pool, createDeterministicUuidFactory(), {
      id: "org_default",
      name: "Firmcode AI"
    });

    const resolved = await defaultOrgResolver.resolve({
      token: createToken({ userId: "user_admin" }),
      selectedWorkspaceId: null
    });

    expect(resolved).toMatchObject({
      workspaceId: "00000000-0000-4000-8000-000000000151",
      orgId: "org_default",
      role: "admin"
    });
  });

  it("ignores provider and token role metadata when seeding new database memberships", async () => {
    const member = await resolver.resolve({
      token: createToken({
        userId: "user_metadata_member",
        orgId: "org_metadata",
        orgRole: "org:developer",
        firmcodeRole: "admin"
      }),
      selectedWorkspaceId: null
    });
    const fallbackAdmin = await resolver.resolve({
      token: createToken({
        userId: "user_metadata_admin",
        orgId: "org_metadata",
        orgRole: "org:custom",
        firmcodeRole: "admin"
      }),
      selectedWorkspaceId: null
    });

    expect(member.role).toBe("developer");
    expect(fallbackAdmin.role).toBe("developer");
  });

  it("seeds provider organization users as Developer regardless of provider organization role", async () => {
    const admin = await resolver.resolve({
      token: createToken({
        userId: "user_admin",
        orgId: "org_roles",
        orgRole: "org:admin"
      }),
      selectedWorkspaceId: null
    });
    const developer = await resolver.resolve({
      token: createToken({
        userId: "user_developer",
        orgId: "org_roles",
        orgRole: "org:developer"
      }),
      selectedWorkspaceId: null
    });

    expect(admin.role).toBe("developer");
    expect(developer.role).toBe("developer");
  });

  it("denies inactive memberships instead of repairing them active", async () => {
    await insertWorkspace("00000000-0000-4000-8000-000000000201", "org_inactive", "Inactive org");
    await insertMembership("00000000-0000-4000-8000-000000000201", "user_inactive", "developer", false);

    await expect(
      resolver.resolve({
        token: createToken({
          userId: "user_inactive",
          orgId: "org_inactive",
          orgRole: "org:developer"
        }),
        selectedWorkspaceId: null
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    const membership = await pool.query<{ active: boolean }>(
      "SELECT active FROM workspace_memberships WHERE workspace_id = $1 AND user_id = $2",
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
      token: createToken({ userId: "user_switch" }),
      selectedWorkspaceId: "00000000-0000-4000-8000-000000000302"
    });
    const selectedPersonal = await resolver.resolve({
      token: createToken({
        userId: "user_switch",
        orgId: "org_selected",
        orgRole: "org:admin"
      }),
      selectedWorkspaceId: "00000000-0000-4000-8000-000000000301"
    });

    expect(selectedOrg).toMatchObject({
      workspaceId: "00000000-0000-4000-8000-000000000302",
      orgId: "org_selected",
      role: "admin"
    });
    expect(selectedPersonal).toMatchObject({
      workspaceId: "00000000-0000-4000-8000-000000000301",
      orgId: null,
      role: "developer"
    });
    await expect(
      resolver.resolve({
        token: createToken({ userId: "user_switch" }),
        selectedWorkspaceId: "00000000-0000-4000-8000-000000000303"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not write elevated audit events from token-only role metadata", async () => {
    await insertWorkspace("00000000-0000-4000-8000-000000000401", "org_audit", "Audit org");

    await resolver.resolve({
      token: createToken({
        userId: "user_audit",
        orgId: "org_audit",
        orgRole: "org:admin"
      }),
      selectedWorkspaceId: null
    });
    await resolver.resolve({
      token: createToken({
        userId: "user_audit",
        orgId: "org_audit",
        orgRole: "org:developer"
      }),
      selectedWorkspaceId: null
    });

    const audits = await pool.query<{
      actor_user_id: string;
      target_user_id: string;
      previous_role: string | null;
      next_role: string | null;
      source: string;
    }>(
      `
SELECT actor_user_id, target_user_id, previous_role, next_role, source
FROM workspace_audit_events
WHERE workspace_id = $1
ORDER BY created_at, id
`,
      ["00000000-0000-4000-8000-000000000401"]
    );

    expect(audits.rows).toEqual([]);
  });

  async function insertWorkspace(id: string, orgId: string | null, name: string): Promise<void> {
    await pool.query(
      "INSERT INTO workspaces (id, identity_provider_org_id, name) VALUES ($1, $2, $3)",
      [id, orgId, name]
    );
  }

  async function insertMembership(
    workspaceId: string,
    userId: string,
    role: "admin" | "developer",
    active: boolean
  ): Promise<void> {
    await pool.query(
      "INSERT INTO user_profiles (id, identity_provider, provider_user_id) VALUES ($1, 'insforge', $1) ON CONFLICT (id) DO NOTHING",
      [userId]
    );
    await pool.query(
      "INSERT INTO workspace_memberships (workspace_id, user_id, role, active) VALUES ($1, $2, $3, $4)",
      [workspaceId, userId, role, active]
    );
  }
});

function createToken(overrides: Partial<VerifiedToken>): VerifiedToken {
  return {
    userId: "user_default",
    orgId: null,
    sessionId: "sess_default",
    orgRole: null,
    firmcodeRole: null,
    billingCapabilities: [],
    provider: "insforge",
    ...overrides
  };
}
