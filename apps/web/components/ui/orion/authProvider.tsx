"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import type { RouterOutputs } from "@repo/trpc/client";
import { trpc } from "~/trpc/client";
import { clearCsrfCookieClient } from "~/lib/clear-csrf-cookie";

type User = RouterOutputs["auth"]["me"];
type AuthError = ReturnType<typeof trpc.auth.me.useQuery>["error"];

type AuthContextValue = {
  user: User | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
  isError: boolean;
  error: AuthError;
  refetch: () => void;
  logout: () => Promise<void>;
  isLoggingOut: boolean;
};

const AUTHENTICATED_ROUTES = [
  "/dashboard/inbox",
  "/dashboard/calendar",
  "/dashboard/sent",
  "/dashboard/drafts",
  "/dashboard/trash",
  "/dashboard/help",
];

function isAuthenticatedRoute(pathname: string) {
  return AUTHENTICATED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const utils = trpc.useUtils();

  const {
    data: user,
    isPending: isLoading,
    isError,
    error,
    isSuccess,
    refetch,
  } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
  });

  const isAuthenticated = isSuccess && !!user;

  useEffect(() => {
    if (isLoading) return;

    const isProtected = isAuthenticatedRoute(pathname);

    if (!isAuthenticated && isProtected) {
      router.replace("/api-auth/login");
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      clearCsrfCookieClient();
      utils.auth.me.reset();
      await utils.auth.me.invalidate();
      router.replace("/");
    }
  }, [logoutMutation, router, utils]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: isAuthenticated ? user : undefined,
      isAuthenticated,
      isLoading,
      isError,
      error: error ?? null,
      refetch,
      logout,
      isLoggingOut: logoutMutation.isPending,
    }),
    [user, isAuthenticated, isLoading, isError, error, refetch, logout, logoutMutation.isPending],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
