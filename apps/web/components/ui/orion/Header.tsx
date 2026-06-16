"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/components/ui/orion/authProvider";

export function Header() {
  const { isAuthenticated, user, logout, isLoading } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold">
          Streamyst
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          {isAuthenticated && (
            <Link href="/inbox" className="text-muted-foreground hover:text-foreground">
              Inbox
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {isLoading ? null : isAuthenticated ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
              <Button variant="outline" size="sm" onClick={() => logout()}>
                Logout
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/api-auth/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
