import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

export default async function middleware(request: NextRequest, _event: NextFetchEvent): Promise<Response> {
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)"
  ]
};
