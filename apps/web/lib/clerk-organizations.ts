export function isClerkOrganizationsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NEXT_PUBLIC_CLERK_ORGANIZATIONS_ENABLED?.trim().toLowerCase() === "true";
}
