"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchInsForgeCurrentUser, fetchInsForgePublicAuthConfig } from "../lib/insforge";

const ACCESS_TOKEN_COOKIE = "insforge_access_token";

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
        const accessToken = readCookie(ACCESS_TOKEN_COOKIE);
        const [currentUser, publicAuthConfig] = await Promise.all([
          accessToken === null ? Promise.resolve(null) : fetchInsForgeCurrentUser(accessToken),
          fetchInsForgePublicAuthConfig().catch(() => null)
        ]);

        if (currentUser) {
          setUser(currentUser as InsForgeUser);
        }

        if (publicAuthConfig) {
          setAuthConfig({
            requireEmailVerification: publicAuthConfig.requireEmailVerification === true,
            verifyEmailMethod: publicAuthConfig.verifyEmailMethod === "link" ? "link" : "code"
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
    const data = await postAuthJson<{
      user?: InsForgeUser;
    }>("/api/auth/sign-in", {
      email,
      password
    });

    if (data.user) {
      setUser(data.user as InsForgeUser);
      window.location.href = afterSignInUrl;
      return { status: "signed_in" } satisfies AuthCompletionResult;
    }

    throw new Error("Sign-in did not complete successfully.");
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const data = await postAuthJson<{
      user?: InsForgeUser | null;
      requireEmailVerification?: boolean;
    }>("/api/auth/sign-up", {
      email,
      password,
      name
    });

    if (data.user && data.requireEmailVerification !== true) {
      setUser(data.user as InsForgeUser);
      window.location.href = afterSignUpUrl;
      return { status: "signed_in" } satisfies AuthCompletionResult;
    }

    const verificationMethod = authConfig?.verifyEmailMethod ?? "code";
    if (data.requireEmailVerification === true || data.user) {
      return {
        status: "needs_email_verification",
        email,
        method: verificationMethod
      } satisfies AuthCompletionResult;
    }

    throw new Error("Sign-up did not complete successfully.");
  };

  const signInWithGoogle = async () => {
    window.location.href = "/api/auth/google";
  };

  const verifyEmail = async (email: string, otp: string, intent: "sign-in" | "sign-up" = "sign-up") => {
    const data = await postAuthJson<{
      user?: InsForgeUser;
    }>("/api/auth/verify-email", {
      email,
      otp
    });

    if (!data.user) {
      throw new Error("Verification did not return an authenticated session.");
    }

    setUser(data.user as InsForgeUser);
    window.location.href = intent === "sign-in" ? afterSignInUrl : afterSignUpUrl;
  };

  const resendVerificationEmail = async (email: string) => {
    await postAuthJson("/api/auth/resend-verification", {
      email
    });
  };

  const signOut = async () => {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      credentials: "same-origin"
    });
    setUser(null);
    window.location.href = signInUrl;
  };

  const getToken = async (): Promise<string | null> => {
    const token = readCookie(ACCESS_TOKEN_COOKIE);

    if (token !== null) {
      return token;
    }

    await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin"
    });
    return readCookie(ACCESS_TOKEN_COOKIE);
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

async function postAuthJson<T = unknown>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body),
    credentials: "same-origin"
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = readErrorMessage(payload) ?? "Authentication request failed.";
    throw new Error(message);
  }

  return payload as T;
}

function readErrorMessage(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object") {
    return null;
  }

  const message = (payload as Record<string, unknown>).message;
  return typeof message === "string" && message.trim() !== "" ? message : null;
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));

  return cookie === undefined ? null : decodeURIComponent(cookie.slice(prefix.length));
}
