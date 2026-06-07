"use client";

import { InsForgeProviderBoundary } from "../insforge-provider-boundary";
import { loadWebInsForgeAuthRenderConfig } from "../../config/insforge";

interface AuthProviderBoundaryProps {
  children: React.ReactNode;
}

export function AuthProviderBoundary({ children }: AuthProviderBoundaryProps) {
  const config = loadWebInsForgeAuthRenderConfig();
  return (
    <InsForgeProviderBoundary
      signInUrl={config.signInUrl}
      signUpUrl={config.signUpUrl}
      afterSignInUrl={config.afterSignInUrl}
      afterSignUpUrl={config.afterSignUpUrl}
    >
      {children}
    </InsForgeProviderBoundary>
  );
}
