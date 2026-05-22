import type { Metadata } from "next";
import { ClerkProviderBoundary } from "../components/clerk-provider-boundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "Firmcode",
  description: "AI-powered pull request review dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ClerkProviderBoundary>{children}</ClerkProviderBoundary>
      </body>
    </html>
  );
}
