import React from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { loadWebClerkConfig } from "../config/clerk";

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
      signInFallbackRedirectUrl={clerk.afterSignInUrl}
      signUpFallbackRedirectUrl={clerk.afterSignUpUrl}
    >
      {children}
    </ClerkProvider>
  );
}
