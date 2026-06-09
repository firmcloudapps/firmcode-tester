"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { insforge } from "../lib/insforge";

const ACCESS_TOKEN_COOKIE = "insforge_access_token";

function persistAccessToken(token: string): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ACCESS_TOKEN_COOKIE}=${token}; path=/; SameSite=Lax; max-age=3600${secure}`;
}

function clearAccessToken(): void {
  document.cookie = `${ACCESS_TOKEN_COOKIE}=; path=/; max-age=0`;
}

interface InsForgeUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

interface PublicAuthConfig {
  requireEmailVerification: boolean;
  verifyEmailMethod: "code" | "link";
}

export type AuthCompletionResult =
  | { status: "signed_in" }
  | { status: "needs_email_verification"; email: string; method: "code" | "link" };

interface InsForgeAuthContextValue {
  user: InsForgeUser | null;
  isLoading: boolean;
  isSignedIn: boolean;
  authConfig: PublicAuthConfig | null;
  signIn: (email: string, password: string) => Promise<AuthCompletionResult>;
  signUp: (email: string, password: string, name?: string) => Promise<AuthCompletionResult>;
  signInWithGoogle: () => Promise<void>;
  verifyEmail: (email: string, otp: string, intent?: "sign-in" | "sign-up") => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const InsForgeAuthContext = createContext<InsForgeAuthContextValue | null>(null);

export function useInsForgeAuth(): InsForgeAuthContextValue {
  const context = useContext(InsForgeAuthContext);
  if (!context) {
    throw new Error("useInsForgeAuth must be used within InsForgeProviderBoundary");
  }
  return context;
}

interface InsForgeProviderBoundaryProps {
  children: React.ReactNode;
  signInUrl?: string;
  signUpUrl?: string;
  afterSignInUrl?: string;
  afterSignUpUrl?: string;
}

export function InsForgeProviderBoundary({
  children,
  signInUrl = "/sign-in",
  afterSignInUrl = "/auth/redirect",
  afterSignUpUrl = "/auth/redirect"
}: InsForgeProviderBoundaryProps) {
  const [user, setUser] = useState<InsForgeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authConfig, setAuthConfig] = useState<PublicAuthConfig | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const [{ data }, configResult] = await Promise.all([
          insforge.auth.getCurrentUser(),
          insforge.auth.getPublicAuthConfig().catch(() => ({ data: null, error: null }))
        ]);

        if (data?.user) {
          setUser(data.user as InsForgeUser);
          const tokenInMemory = (insforge as any).tokenManager?.getSession()?.accessToken as string | undefined;
          if (tokenInMemory) {
            persistAccessToken(tokenInMemory);
          }
        }

        if (configResult.data) {
          setAuthConfig({
            requireEmailVerification: configResult.data.requireEmailVerification,
            verifyEmailMethod: configResult.data.verifyEmailMethod
          });
        }
      } catch (error) {
        console.error("Failed to get session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await insforge.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data?.user && data.accessToken) {
      setUser(data.user as InsForgeUser);
      persistAccessToken(data.accessToken);
      window.location.href = afterSignInUrl;
      return { status: "signed_in" } satisfies AuthCompletionResult;
    }

    if (data?.user && (data.user.emailVerified === false || authConfig?.requireEmailVerification === true)) {
      return {
        status: "needs_email_verification",
        email: data.user.email,
        method: authConfig?.verifyEmailMethod ?? "code"
      } satisfies AuthCompletionResult;
    }

    throw new Error("Sign-in did not complete successfully.");
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name,
      redirectTo: window.location.origin + signInUrl
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data?.user && data.accessToken) {
      setUser(data.user as InsForgeUser);
      persistAccessToken(data.accessToken);
      window.location.href = afterSignUpUrl;
      return { status: "signed_in" } satisfies AuthCompletionResult;
    }

    const verificationMethod = authConfig?.verifyEmailMethod ?? "code";
    if (data?.requireEmailVerification || (data?.user && !data.accessToken)) {
      return {
        status: "needs_email_verification",
        email,
        method: verificationMethod
      } satisfies AuthCompletionResult;
    }

    if (data?.user) {
      setUser(data.user as InsForgeUser);
      if (data.accessToken) persistAccessToken(data.accessToken);
      window.location.href = afterSignUpUrl;
      return { status: "signed_in" } satisfies AuthCompletionResult;
    }

    throw new Error("Sign-up did not complete successfully.");
  };

  const signInWithGoogle = async () => {
    const redirectTo = new URL("/auth/callback", window.location.origin).toString();
    const { error } = await insforge.auth.signInWithOAuth("google", { redirectTo });

    if (error) {
      throw new Error(error.message);
    }
  };

  const verifyEmail = async (email: string, otp: string, intent: "sign-in" | "sign-up" = "sign-up") => {
    const { data, error } = await insforge.auth.verifyEmail({
      email,
      otp
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.user) {
      throw new Error("Verification did not return an authenticated session.");
    }

    setUser(data.user as InsForgeUser);
    const verifyToken = (data as any)?.accessToken as string | undefined;
    if (verifyToken) persistAccessToken(verifyToken);
    window.location.href = intent === "sign-in" ? afterSignInUrl : afterSignUpUrl;
  };

  const resendVerificationEmail = async (email: string) => {
    const { error } = await insforge.auth.resendVerificationEmail({
      email,
      redirectTo: window.location.origin + signInUrl
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const signOut = async () => {
    await insforge.auth.signOut();
    clearAccessToken();
    setUser(null);
    window.location.href = signInUrl;
  };

  const getToken = async (): Promise<string | null> => {
    const fromMemory = (insforge as any).tokenManager?.getSession()?.accessToken as string | undefined;
    if (fromMemory) {
      persistAccessToken(fromMemory);
      return fromMemory;
    }
    const { data } = await insforge.auth.refreshSession();
    if (data?.accessToken) {
      persistAccessToken(data.accessToken);
      return data.accessToken;
    }
    return null;
  };

  const value: InsForgeAuthContextValue = {
    user,
    isLoading,
    isSignedIn: !!user,
    authConfig,
    signIn,
    signUp,
    signInWithGoogle,
    verifyEmail,
    resendVerificationEmail,
    signOut,
    getToken
  };

  return (
    <InsForgeAuthContext.Provider value={value}>
      {children}
    </InsForgeAuthContext.Provider>
  );
}
