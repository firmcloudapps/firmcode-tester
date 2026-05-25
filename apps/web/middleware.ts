import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isProtectedDashboardPath, PROTECTED_DASHBOARD_ROUTES } from "./lib/protected-routes";

const isProtectedRoute = createRouteMatcher([...PROTECTED_DASHBOARD_ROUTES]);
const clerkDashboardMiddleware = clerkMiddleware(
  async (auth, request) => protectDashboardRequest(auth, request),
  {
    signInUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? "/sign-in",
    signUpUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? "/sign-up"
  }
);

interface ProtectableClerkAuth {
  protect(): Promise<unknown>;
}

export async function protectDashboardRequest(auth: ProtectableClerkAuth, request: Request): Promise<void> {
  if (isProtectedRequest(request)) {
    await auth.protect();
  }
}

export default async function middleware(request: NextRequest, event: NextFetchEvent): Promise<Response | undefined> {
  if (!hasClerkMiddlewareConfig()) {
    return createClerkUnavailableResponse(request);
  }

  try {
    return (await clerkDashboardMiddleware(request, event)) ?? undefined;
  } catch (error) {
    console.error("Clerk middleware failed before dashboard route protection completed.", {
      message: error instanceof Error ? error.message : "Unknown Clerk middleware error"
    });

    return createClerkUnavailableResponse(request);
  }
}

export function hasClerkMiddlewareConfig(env: Record<string, string | undefined> = process.env): boolean {
  return hasValue(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) && hasValue(env.CLERK_SECRET_KEY);
}

function createClerkUnavailableResponse(request: Request): Response | undefined {
  if (!isProtectedRequest(request)) {
    return NextResponse.next();
  }

  const pathname = new URL(request.url).pathname;
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "A signed-in Clerk session is required." }, { status: 401 });
  }

  return NextResponse.redirect(new URL(process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? "/sign-in", request.url));
}

function isProtectedRequest(request: Request): boolean {
  return "nextUrl" in request ? isProtectedRoute(request as Parameters<typeof isProtectedRoute>[0]) : isProtectedDashboardPath(new URL(request.url).pathname);
}

function hasValue(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== "";
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
