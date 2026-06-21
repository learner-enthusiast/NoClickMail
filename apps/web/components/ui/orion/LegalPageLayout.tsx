import Image from "next/image";
import Link from "next/link";

type LegalPageLayoutProps = {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
};

export function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <div className="mb-10 flex flex-col items-center gap-3 text-center">
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <Image src="/orion.png" alt="Orion" width={40} height={40} className="size-10" />
          <span className="text-lg font-bold tracking-tight">Orion</span>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>
      </div>

      <article className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-foreground [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_li]:text-muted-foreground [&_p]:leading-relaxed [&_p]:text-muted-foreground">
        {children}
      </article>

      <div className="mt-12 flex flex-wrap justify-center gap-4 border-t border-border pt-8 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <Link href="/privacy" className="hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:text-foreground">
          Terms of Service
        </Link>
        <Link href="/api-auth/login" className="hover:text-foreground">
          Sign in
        </Link>
      </div>
    </div>
  );
}
