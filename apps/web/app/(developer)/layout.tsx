import React from "react";

export const dynamic = "force-dynamic";

interface DeveloperLayoutProps {
  children: React.ReactNode;
}

export default async function DeveloperLayout({ children }: DeveloperLayoutProps) {
  return <>{children}</>;
}
