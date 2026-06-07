import type { Metadata } from "next";
import { AuthProviderBoundary } from "../components/auth/auth-provider-boundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "Firmcode",
  description: "AI-powered pull request review dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProviderBoundary>{children}</AuthProviderBoundary>
      </body>
    </html>
  );
}
