"use client";

import { Loader2, Mail, Calendar } from "lucide-react";
import { connectionStatus } from "~/hooks/connections";
import { Button } from "~/components/ui/button";
import { connectProvider, type ConnectionProvider } from "~/lib/connect";

type Require = ConnectionProvider | "both";

const META: Record<ConnectionProvider, { label: string; icon: typeof Mail; description: string }> =
  {
    gmail: {
      label: "Gmail",
      icon: Mail,
      description: "Connect Gmail to read and manage your inbox, sent mail, drafts, and trash.",
    },
    googlecalendar: {
      label: "Google Calendar",
      icon: Calendar,
      description: "Connect Google Calendar to view and schedule events.",
    },
  };

function requiredProviders(require: Require): ConnectionProvider[] {
  if (require === "both") return ["gmail", "googlecalendar"];
  return [require];
}

function isSatisfied(
  data: { gmail: boolean; googlecalendar: boolean } | undefined,
  require: Require,
) {
  if (!data) return false;
  return requiredProviders(require).every((p) => data[p]);
}

type RequireConnectionProps = {
  /** Which integration(s) must be connected before showing children */
  require: Require;
  children: React.ReactNode;
  /** Optional custom fallback while loading */
  loading?: React.ReactNode;
};

export function RequireConnection({ require, children, loading }: RequireConnectionProps) {
  const { data, isPending, isError } = connectionStatus();

  if (isPending) {
    return (
      loading && (
        <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Checking connections…
        </div>
      )
    );
  }

  if (isError) {
    return (
      <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center p-6 text-sm text-destructive">
        Could nt load connection status. Try refreshing.
      </div>
    );
  }

  if (isSatisfied(data, require)) {
    return <>{children}</>;
  }

  const missing = requiredProviders(require).filter((p) => !data?.[p]);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Connect your accounts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {require === "both"
              ? "Orion needs Gmail and Google Calendar before this page can load."
              : `Connect ${META[missing[0]!].label} to continue.`}
          </p>
        </div>

        <div className="space-y-3">
          {missing.map((id) => {
            const { label, icon: Icon, description } = META[id];
            return (
              <div
                key={id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => connectProvider(id)}>
                  Connect
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
