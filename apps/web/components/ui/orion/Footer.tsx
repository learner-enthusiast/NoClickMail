import { Calendar, DraftingCompass, Inbox, LucideIcon, MessageCircle, Trash } from "lucide-react";
import Link from "next/link";

export function Footer() {
  const NAV_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
    { label: "Inbox", href: "/dashboard/inbox", icon: Inbox },
    { label: "Calendar", href: "/dashboard/calendar", icon: Calendar },
    { label: "Drafts", href: "/dashboard/drafts", icon: DraftingCompass },
    { label: "Sent", href: "/dashboard/sent", icon: MessageCircle },
    { label: "Trash", href: "/dashboard/trash", icon: Trash },
  ];
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-[1080px] border border-x-border flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} Orion Experience Quiet Intelligence</span>
        <nav className="flex flex-row gap-8">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-2.5 rounded-md py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="flex size-7 items-center justify-center rounded-md bg-muted transition-colors group-hover:bg-secondary">
                <Icon className="size-3.5" />
              </span>
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
