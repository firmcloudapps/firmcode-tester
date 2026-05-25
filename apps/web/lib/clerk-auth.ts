import { auth } from "@clerk/nextjs/server";

export async function getClerkApiBearerToken(env: Record<string, string | undefined> = process.env): Promise<string | null> {
  try {
    const session = await auth();
    const template = env.CLERK_JWT_AUDIENCE;
    const token =
      template !== undefined && template !== ""
        ? await session.getToken({ template })
        : await session.getToken();

    return token ?? null;
  } catch {
    return null;
  }
}
