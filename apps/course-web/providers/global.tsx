"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { trpc } from "~/trpc/client";
import { createTRPCHttpBatchClient } from "~/trpc/create-client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [trpcClient] = React.useState(() =>
    trpc.createClient({
      links: [createTRPCHttpBatchClient()],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
