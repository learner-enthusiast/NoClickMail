import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} Streamyst. All rights reserved.</span>
        <nav className="flex gap-4">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <Link href="/inbox" className="hover:text-foreground">
            Inbox
          </Link>
        </nav>
      </div>
    </footer>
  );
}
