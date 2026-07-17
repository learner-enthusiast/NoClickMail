"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Inbox,
  Calendar,
  Plus,
  HelpCircle,
  LogOut,
  type LucideIcon,
  DraftingCompass,
  MessageCircle,
  Trash,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/components/ui/orion/authProvider";
import { cn } from "~/lib/utils";

const NAV_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Inbox", href: "/dashboard/inbox", icon: Inbox },
  { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { label: "Drafts", href: "/dashboard/drafts", icon: DraftingCompass },
  { label: "Sent", href: "/dashboard/sent", icon: MessageCircle },
  { label: "Trash", href: "/dashboard/trash", icon: Trash },
];

function SideBarLink({ label, href, icon: Icon }: (typeof NAV_ITEMS)[number]) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-secondary text-primary"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <Icon className="size-[18px] shrink-0" />
      {label}
    </Link>
  );
}

export function SideBar() {
  const { logout, isLoggingOut } = useAuth();

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-sidebar">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <Image src="/orion.png" alt="Orion" width={36} height={36} className="size-9" />
        <div className="leading-tight">
          <p className="text-lg font-bold tracking-tight text-foreground">Orion</p>
          <p className="text-[10px] tracking-[0.2em] text-muted-foreground">QUIET INTELLIGENCE</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-3 py-2">
        {NAV_ITEMS.map((item) => (
          <SideBarLink key={item.href} {...item} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="mt-auto px-3 pb-4">
        <div className="my-2 border-t border-border" />

        <Link
          href="/dashboard/help"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <HelpCircle className="size-[18px]" />
          Help
        </Link>

        <button
          type="button"
          onClick={() => logout()}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:opacity-50"
        >
          <LogOut className="size-[18px]" />
          {isLoggingOut ? "Logging out…" : "Logout"}
        </button>
      </div>
    </aside>
  );
}
