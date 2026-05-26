import React from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AuthPage } from "../../../components/auth/auth-page";
import { ROLE_BASED_AUTH_REDIRECT_PATH } from "../../../lib/auth-redirect";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (process.env.NODE_ENV !== "test") {
    const session = await auth();

    if (session.userId !== null) {
      redirect(ROLE_BASED_AUTH_REDIRECT_PATH);
    }
  }

  return <AuthPage mode="sign-up" />;
}
