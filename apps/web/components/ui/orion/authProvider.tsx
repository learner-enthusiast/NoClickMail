"use client";

import { usePathname, useRouter } from "next/navigation";
import React, { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import type { RouterInputs, RouterOutputs } from "@repo/trpc/client";
import { trpc } from "~/trpc/client";

type User = RouterOutputs["auth"]["me"];
type LoginInput = RouterInputs["auth"]["loginUserWithEmailandPassword"];
type SignUpInput = RouterInputs["auth"]["createUserWithEmailandPassword"];
type AuthError = ReturnType<typeof trpc.auth.me.useQuery>["error"];

type AuthContextValue = {
  user: User | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
  isError: boolean;
  error: AuthError;
  refetch: () => void;
  login: (input: LoginInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  logout: () => Promise<void>;
  isLoggingIn: boolean;
  isSigningUp: boolean;
  isLoggingOut: boolean;
};

const AUTHENTICATED_ROUTES = ["/inbox", "/settings"];
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

    // Authenticated users may only be on protected routes → bounce off public pages.
    if (isAuthenticated && !isProtected) {
      router.replace("/inbox");
      return;
    }

    // Unauthenticated users may only be on public routes → bounce off protected pages.
    if (!isAuthenticated && isProtected) {
      router.replace("/api-auth/login");
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  const loginMutation = trpc.auth.loginUserWithEmailandPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });

  const signUpMutation = trpc.auth.createUserWithEmailandPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });

  const login = useCallback(
    async (input: LoginInput) => {
      await loginMutation.mutateAsync(input);
    },
    [loginMutation],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      await signUpMutation.mutateAsync(input);
    },
    [signUpMutation],
  );

  const logout = useCallback(async () => {
    await utils.client.auth.logout.query();
    utils.auth.me.reset();
    router.replace("/api-auth/login");
  }, [router, utils]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: isAuthenticated ? user : undefined,
      isAuthenticated,
      isLoading,
      isError,
      error: error ?? null,
      refetch,
      login,
      signUp,
      logout,
      isLoggingIn: loginMutation.isPending,
      isSigningUp: signUpMutation.isPending,
      isLoggingOut: false,
    }),
    [
      user,
      isAuthenticated,
      isLoading,
      isError,
      error,
      refetch,
      login,
      signUp,
      logout,
      loginMutation.isPending,
      signUpMutation.isPending,
    ],
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
