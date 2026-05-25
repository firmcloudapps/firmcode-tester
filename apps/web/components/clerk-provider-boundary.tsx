import React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { loadWebClerkConfig } from "../config/clerk";
import { ROLE_BASED_AUTH_REDIRECT_PATH } from "../lib/auth-redirect";

interface ClerkProviderBoundaryProps {
  children: React.ReactNode;
}

export function ClerkProviderBoundary({ children }: ClerkProviderBoundaryProps) {
  const clerk = loadWebClerkConfig();

  return (
    <ClerkProvider
      publishableKey={clerk.publishableKey}
      signInUrl={clerk.signInUrl}
      signUpUrl={clerk.signUpUrl}
      signInForceRedirectUrl={ROLE_BASED_AUTH_REDIRECT_PATH}
      signUpForceRedirectUrl={ROLE_BASED_AUTH_REDIRECT_PATH}
      signInFallbackRedirectUrl={clerk.afterSignInUrl}
      signUpFallbackRedirectUrl={clerk.afterSignUpUrl}
    >
      {children}
    </ClerkProvider>
  );
}
