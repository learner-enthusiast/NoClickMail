"use client";

import { useEffect } from "react";
import { useAuth } from "~/components/ui/orion/authProvider";
import { trpc } from "~/trpc/client";
import { env } from "~/env";

const API_BASE = (env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/trpc").replace(
  /\/trpc\/?$/,
  "",
);

export function useRealtimeSync() {
  const { isAuthenticated, isLoading } = useAuth();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;

    const es = new EventSource(`${API_BASE}/events/stream`, {
      withCredentials: true, // sends auth cookie
    });

    es.addEventListener("gmail.inbox.changed", () => {
      void utils.gmail.inbox.invalidate();
      void utils.gmail.message.invalidate();
    });

    es.addEventListener("calendar.events.changed", () => {
      void utils.calendar.events.invalidate();
    });

    es.onerror = () => {
      // browser auto-reconnects; optional logging
    };

    return () => es.close();
  }, [isAuthenticated, isLoading, utils]);
}
