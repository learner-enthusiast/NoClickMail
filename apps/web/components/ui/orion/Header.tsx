"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Calendar, Check, Mail, RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useAuth } from "~/components/ui/orion/authProvider";
import { ThemeToggle } from "~/components/ui/orion/ThemeToggle";
import { cn } from "~/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@radix-ui/react-hover-card";
import { connectionStatus } from "~/hooks/connections";
import { env } from "~/env";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/inbox" },
  { label: "Activity", href: "/activity" },
  { label: "Analytics", href: "/analytics" },
] as const;
const API_BASE = (env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/trpc").replace(
  /\/trpc\/?$/,
  "",
);

const CONNECTION_ITEMS = [
  { id: "gmail", label: "Gmail", icon: Mail },
  { id: "googlecalendar", label: "Google Calendar", icon: Calendar },
] as const;
function ConnectionsDropdown() {
  const { data, isPending } = connectionStatus();

  function connect(plugin: string) {
    window.location.href = `${API_BASE}/connect/${plugin}`;
  }

  return (
    <HoverCard openDelay={100} closeDelay={150}>
      <HoverCardTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Connection status"
        >
          <RefreshCw className="size-5" />
        </Button>
      </HoverCardTrigger>

      <HoverCardContent align="end" className="w-72 p-3">
        <p className="mb-3 text-sm font-semibold text-foreground">Connections</p>

        <div className="space-y-2">
          {CONNECTION_ITEMS.map(({ id, label, icon: Icon }) => {
            const connected = data?.[id] ?? false;

            return (
              <div key={id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <Icon className="size-4 text-muted-foreground" />
                  {label}
                </span>

                {isPending ? (
                  <span className="text-xs text-muted-foreground">Checking…</span>
                ) : connected ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-chart-5">
                    <Check className="size-3.5" />
                    Connected
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    onClick={() => connect(id)}
                  >
                    Connect
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "relative pb-1 text-sm font-medium transition-colors",
        isActive
          ? "text-foreground after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-primary-accent"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

export function Header() {
  const { isAuthenticated, user, isLoading } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-secondary">
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Left — logo + brand */}
        <Link href="/inbox" className="flex items-center gap-2.5">
          <Image src="/orion.png" alt="Orion" width={32} height={32} className="size-8" />
          <span className="text-lg font-semibold tracking-tight text-foreground">Orion</span>
        </Link>

        {/* Center — nav (authenticated only) */}
        {isAuthenticated && (
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </nav>
        )}

        {/* Right — actions */}
        <div className="flex items-center gap-1">
          {!isLoading && isAuthenticated ? (
            <>
              <ConnectionsDropdown />
              <Avatar className="ml-1 size-9">
                {user?.profileImageUrl ? (
                  <AvatarImage src={user.profileImageUrl} alt={user.fullName} />
                ) : null}
                <AvatarFallback className="bg-surface-bright text-xs text-foreground">
                  {user?.fullName?.charAt(0) ?? "?"}
                </AvatarFallback>
              </Avatar>
            </>
          ) : (
            !isLoading && (
              <Button asChild size="sm">
                <Link href="/api-auth/login">Login</Link>
              </Button>
            )
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
