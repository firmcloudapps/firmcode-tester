import React from "react";

interface ClerkProviderBoundaryProps {
  children: React.ReactNode;
}

export function ClerkProviderBoundary({ children }: ClerkProviderBoundaryProps) {
  return <>{children}</>;
}
