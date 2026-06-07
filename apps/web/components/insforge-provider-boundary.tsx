"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { insforge } from "../lib/insforge";

interface InsForgeUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

interface InsForgeAuthContextValue {
  user: InsForgeUser | null;
  isLoading: boolean;
  isSignedIn: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
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

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data } = await insforge.auth.getCurrentUser();
        if (data?.user) {
          setUser(data.user as InsForgeUser);
        }
      } catch (error) {
        console.error("Failed to get session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await insforge.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      setUser(data.user as InsForgeUser);
      window.location.href = afterSignInUrl;
    }
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

    // If user is immediately signed in (email verification disabled)
    if (data?.user) {
      setUser(data.user as InsForgeUser);
      window.location.href = afterSignUpUrl;
    }
  };

  const signOut = async () => {
    await insforge.auth.signOut();
    setUser(null);
    window.location.href = signInUrl;
  };

  const getToken = async (): Promise<string | null> => {
    // In InsForge, the SDK handles tokens via cookies
    // This is a placeholder - the actual token is managed by the SDK
    return null;
  };

  const value: InsForgeAuthContextValue = {
    user,
    isLoading,
    isSignedIn: !!user,
    signIn,
    signUp,
    signOut,
    getToken
  };

  return (
    <InsForgeAuthContext.Provider value={value}>
      {children}
    </InsForgeAuthContext.Provider>
  );
}
