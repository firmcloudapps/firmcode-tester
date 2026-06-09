import React from "react";
import { redirect } from "next/navigation";
import { AuthPage } from "../../../components/auth/auth-page";
import { ROLE_BASED_AUTH_REDIRECT_PATH } from "../../../lib/auth-redirect";
import { getServerDashboardAuthSession } from "../../../lib/dashboard-auth";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (process.env.NODE_ENV !== "test") {
    const session = await getServerDashboardAuthSession();

    if (session !== null) {
      redirect(ROLE_BASED_AUTH_REDIRECT_PATH);
    }
  }

  return <AuthPage mode="sign-in" />;
}
