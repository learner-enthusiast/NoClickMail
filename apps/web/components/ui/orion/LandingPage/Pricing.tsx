"use client";

import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { useAuth } from "../authProvider";

export default function Pricing() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuth();
  return (
    <section id="pricing" className="scroll-mt-20 px-6 py-20 md:py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <p className="text-label-sm uppercase tracking-[0.04em] text-muted-foreground">Pricing</p>
        <h2 className="text-headline-lg text-foreground">Still figuring it out</h2>
        <p className="max-w-xl text-body-lg text-muted-foreground">
          We&apos;re still figuring out the pricing. In the meantime, enjoy Orion for free — while
          it lasts.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-md rounded-xl border border-outline bg-linear-to-tr from-surface-container/80 to-transparent px-8 py-10 text-center">
        <p className="text-label-sm uppercase tracking-[0.04em] text-secondary-accent">
          Early access
        </p>
        <p className="mt-3 text-4xl font-bold tracking-tight text-foreground">₹0</p>
        <p className="mt-2 text-sm text-muted-foreground">Free for now · no card required</p>
        <ul className="mt-6 space-y-2 text-left text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-secondary-accent" aria-hidden>
              ·
            </span>
            Gmail &amp; Calendar via Corsair
          </li>
          <li className="flex gap-2">
            <span className="text-secondary-accent" aria-hidden>
              ·
            </span>
            Drafts, search, and scheduling
          </li>
        </ul>
        <Button size="lg" className="mt-8 w-full" onClick={() => router.push("/api-auth/login")}>
          {isAuthenticated ? "Go to Dashboard" : "Get Started free"}
        </Button>
      </div>
    </section>
  );
}
