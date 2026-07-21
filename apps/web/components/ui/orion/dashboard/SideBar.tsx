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
  Tag,
} from "lucide-react";

import { useAuth } from "~/components/ui/orion/authProvider";
import { cn } from "~/lib/utils";
import { gmailListLabels } from "~/hooks/gmail";
import { Skeleton } from "../../skeleton";
import { Badge } from "../../badge";

const NAV_ITEMS: { id: string; label: string; href: string; icon: LucideIcon }[] = [
  { id: "INBOX", label: "Inbox", href: "/dashboard/inbox", icon: Inbox },
  { id: "CALENDAR", label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { id: "DRAFT", label: "Drafts", href: "/dashboard/drafts", icon: DraftingCompass },
  { id: "SENT", label: "Sent", href: "/dashboard/sent", icon: MessageCircle },
  { id: "TRASH", label: "Trash", href: "/dashboard/trash", icon: Trash },
];

type SideBarLinkProps = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  unreadCount?: number;
  isLoading?: boolean;
};

function SideBarLink({ label, href, icon: Icon, isLoading, unreadCount }: SideBarLinkProps) {
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

      <span className="flex-1">{label}</span>

      {isLoading ? (
        <Skeleton className="h-5 w-7 rounded-full" />
      ) : unreadCount && unreadCount > 0 ? (
        <Badge variant="secondary" className="min-w-5 rounded-full px-1.5 text-xs tabular-nums">
          {unreadCount}
        </Badge>
      ) : null}
    </Link>
  );
}
const NAV_TO_GMAIL_LABEL: Record<string, string | null> = {
  INBOX: "INBOX",
  DRAFTS: "DRAFT", // Gmail uses DRAFT, not DRAFTS
  SENT: "SENT",
  TRASH: "TRASH",
  CALENDAR: null,
};
function UserLabelSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
      <Skeleton className="size-[18px] rounded" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-5 w-7 rounded-full" />
    </div>
  );
}
export function SideBar() {
  const { logout, isLoggingOut } = useAuth();
  const { data: labelsData, isPending: isLoading } = gmailListLabels();
  const unreadByLabelId = new Map(
    (labelsData?.labels ?? []).map((l) => [l.id, l.messagesUnread ?? 0]),
  );
  const userLabels = (labelsData?.labels ?? []).filter((l) => l.type === "user");

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
        {NAV_ITEMS.map((item) => {
          const gmailLabelId = NAV_TO_GMAIL_LABEL[item.id];
          const showBadgeLoading = isLoading && gmailLabelId != null;
          const unreadCount = gmailLabelId != null ? unreadByLabelId.get(gmailLabelId) : undefined;
          return (
            <SideBarLink
              key={item.id}
              {...item}
              isLoading={showBadgeLoading}
              unreadCount={unreadCount}
            />
          );
        })}
        {/* User labels */}
        <div className="my-2 border-t border-border" />
        <p className="px-3 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          Labels
        </p>
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <UserLabelSkeleton key={i} />)
          : userLabels.map((l) => (
              <SideBarLink
                key={l.id}
                id={l.id}
                label={l.name}
                href={`/dashboard/label/${encodeURIComponent(l.id)}`}
                icon={Tag}
                isLoading={false}
                unreadCount={l.messagesUnread ?? 0}
              />
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
          onClick={async () => {
            await logout();
          }}
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
