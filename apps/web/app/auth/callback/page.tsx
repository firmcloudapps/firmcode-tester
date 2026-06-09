"use client";

import { useEffect } from "react";
import { useInsForgeAuth } from "../../../components/insforge-provider-boundary";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const { isSignedIn, isLoading } = useInsForgeAuth();

  useEffect(() => {
    if (isLoading) return;

    if (isSignedIn) {
      window.location.href = "/auth/redirect";
    } else {
      window.location.href = "/sign-in";
    }
  }, [isLoading, isSignedIn]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </main>
  );
}
