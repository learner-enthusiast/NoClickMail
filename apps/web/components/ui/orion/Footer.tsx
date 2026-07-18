import { Calendar, DraftingCompass, Inbox, LucideIcon, MessageCircle, Trash } from "lucide-react";
import Link from "next/link";
import { useAuth } from "./authProvider";

export function Footer() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const NAV_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
    { label: "Inbox", href: "/dashboard/inbox", icon: Inbox },
    { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
    { label: "Drafts", href: "/dashboard/drafts", icon: DraftingCompass },
    { label: "Sent", href: "/dashboard/sent", icon: MessageCircle },
    { label: "Trash", href: "/dashboard/trash", icon: Trash },
  ];
  const LEGAL_LINKS = [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ] as const;

  return (
    <footer className="shrink-0 border-t border-border">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-3 px-6 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center">
        <span className="shrink-0">© {new Date().getFullYear()} Orion · Quiet Intelligence</span>

        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-end">
          {LEGAL_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="leading-none transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}

          {isAuthenticated &&
            NAV_ITEMS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="leading-none transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            ))}
        </nav>
      </div>
    </footer>
  );
}
