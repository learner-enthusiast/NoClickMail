"use client";

import { Button } from "~/components/ui/button";

import { env } from "~/env.js";
import { connectionStatus } from "~/hooks/connections";

const API_BASE = (env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/trpc").replace(
  /\/trpc\/?$/,
  "",
);

const PROVIDERS = [
  { id: "gmail", label: "Gmail" },
  { id: "googlecalendar", label: "Google Calendar" },
] as const;

export function Connections() {
  const { data, isPending } = connectionStatus();

  function connect(plugin: string) {
    window.location.href = `${API_BASE}/connect/${plugin}`;
  }

  return (
    <div className="grid gap-4">
      {PROVIDERS.map((provider) => {
        const connected = data?.[provider.id] ?? false;
        return (
          <div
            key={provider.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <span className="font-medium">{provider.label}</span>

            {isPending ? (
              <span className="text-sm text-muted-foreground">Checking…</span>
            ) : connected ? (
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                Connected
              </span>
            ) : (
              <Button onClick={() => connect(provider.id)}>Connect</Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
