"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import React, { useState } from "react";
import { AuthProvider } from "~/components/ui/orion/authProvider";
import { Footer } from "~/components/ui/orion/Footer";
import { Header } from "~/components/ui/orion/Header";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";

import { trpc } from "~/trpc/client";
import { createTRPCHttpBatchClientClient } from "~/trpc/create-client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: true,
      staleTime: Infinity,
    },
  },
});

export const GlobalProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const trpcClient = trpc.createClient({
    links: [createTRPCHttpBatchClientClient()],
  });
  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <trpc.Provider queryClient={queryClient} client={trpcClient}>
          <AuthProvider>
            <TooltipProvider>
              <div className="flex h-svh max-h-svh flex-col overflow-hidden">
                <Header />
                <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
                <Footer />
              </div>{" "}
            </TooltipProvider>
            <Toaster />
          </AuthProvider>
        </trpc.Provider>
      </NextThemesProvider>
    </QueryClientProvider>
  );
};
