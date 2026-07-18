"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { usePathname } from "next/navigation";
import React from "react";
import { AuthProvider } from "~/components/ui/orion/authProvider";
import { Footer } from "~/components/ui/orion/Footer";
import { Header } from "~/components/ui/orion/Header";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { SmoothScrollProvider } from "~/providers/smooth-scroll";

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

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRoot = pathname === "/";

  const shell = (
    <div className="flex h-svh max-h-svh flex-col overflow-hidden">
      <Header />
      <main
        data-scroll-root={isRoot ? "" : undefined}
        className={cn(
          "flex-1",
          // root: scroll the leftover viewport; elsewhere: lock height for dashboard panels
          isRoot ? "min-h-0 overflow-y-auto" : "min-h-0 overflow-hidden",
        )}
      >
        {children}
      </main>
      {isRoot && <Footer />}
    </div>
  );

  // Lenis only on landing; must wrap Header too so hash nav can call useLenis()
  return isRoot ? <SmoothScrollProvider>{shell}</SmoothScrollProvider> : shell;
}

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
              <AppShell>{children}</AppShell>
            </TooltipProvider>
            <Toaster />
          </AuthProvider>
        </trpc.Provider>
      </NextThemesProvider>
    </QueryClientProvider>
  );
};
