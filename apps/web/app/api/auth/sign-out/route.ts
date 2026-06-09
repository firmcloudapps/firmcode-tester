import { NextResponse } from "next/server";
import { clearSessionCookies } from "../../../../lib/insforge-route-auth";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
