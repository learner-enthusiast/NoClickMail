import { Calendar, Mail } from "lucide-react";
import { OrionLogo } from "../OrionLogo";

const ITEMS = [
  {
    id: "gmail",
    title: "Gmail",
    subtitle: "Search · Draft · Send",
    icon: Mail,
    accent: "text-secondary-accent",
    ring: "bg-secondary-accent/10",
  },
  {
    id: "orion",
    title: "Orion",
    subtitle: "via Corsair",
    icon: null, // custom logo
    accent: "text-primary-accent",
    ring: "bg-primary-accent/10",
    featured: true,
  },
  {
    id: "calendar",
    title: "Google Calendar",
    subtitle: "Invite · Schedule",
    icon: Calendar,
    accent: "text-ai-accent",
    ring: "bg-ai-accent/10",
  },
] as const;

export default function Integrations() {
  return (
    <section id="integrations" className="scroll-mt-20 px-6 py-20 md:py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <p className="text-label-sm uppercase tracking-[0.04em] text-muted-foreground">
          Integrations
        </p>
        <h2 className="text-headline-lg text-foreground">Plug Gmail &amp; Calendar into Orion</h2>
        <p className="max-w-xl text-body-lg text-muted-foreground">
          Corsair sits in the middle — OAuth, Gmail/Calendar APIs, webhooks, and OpenAPI for tools.
        </p>
      </div>

      <div className="mx-auto mt-14 flex max-w-4xl flex-col items-stretch justify-center gap-6 sm:flex-row sm:items-center sm:gap-4 md:gap-8">
        {ITEMS.map((item, i) => {
          const Icon = item.icon;
          const featured = "featured" in item && item.featured;

          return (
            <div key={item.id} className="flex flex-1 items-center gap-4 sm:contents">
              <div
                className={`flex flex-1 flex-col items-center gap-3 rounded-xl border border-outline bg-linear-to-tr from-surface-container/80 to-transparent px-6 py-8 ${
                  featured ? "sm:scale-105 sm:shadow-sm ring-1 ring-primary-accent/20" : ""
                }`}
              >
                <span
                  className={`flex size-14 items-center justify-center rounded-xl ${item.ring} ${item.accent}`}
                >
                  {Icon ? (
                    <Icon className="size-7" strokeWidth={1.75} />
                  ) : (
                    <OrionLogo className="size-9" />
                  )}
                </span>
                <p className="text-label-lg text-on-surface">{item.title}</p>
                <p className="text-label-sm uppercase tracking-[0.04em] text-muted-foreground">
                  {item.subtitle}
                </p>
              </div>

              {/* connector between cards on desktop */}
              {i < ITEMS.length - 1 && (
                <div className="hidden h-px w-8 shrink-0 bg-outline sm:block" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
