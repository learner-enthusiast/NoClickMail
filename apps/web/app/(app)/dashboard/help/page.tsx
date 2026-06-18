import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Inbox,
  MessageCircle,
  DraftingCompass,
  Trash,
  Sparkles,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

const FEATURES = [
  {
    icon: Inbox,
    title: "Inbox",
    description:
      "Read incoming mail, open full message bodies, and mark messages as read when you open them. Delete messages to move them to Trash. Use “Show more” to load older mail.",
    href: "/dashboard/inbox",
  },
  {
    icon: MessageCircle,
    title: "Sent",
    description:
      "Review messages you've already sent. Useful when you need context before replying or drafting with Orion.",
    href: "/dashboard/sent",
  },
  {
    icon: DraftingCompass,
    title: "Drafts",
    description: "See Gmail drafts you've started. Open a draft to continue where you left off.",
    href: "/dashboard/drafts",
  },
  {
    icon: Trash,
    title: "Trash",
    description:
      "Browse messages you've deleted from Inbox. Orion keeps these in sync with your Gmail account.",
    href: "/dashboard/trash",
  },
  {
    icon: Calendar,
    title: "Calendar",
    description:
      "View Google Calendar events in day, week, or month view. Navigate with the arrows or jump to Today.",
    href: "/dashboard/calendar",
  },
  {
    icon: Sparkles,
    title: "Orion Intelligence",
    description:
      "The assistant panel on the right helps you summarize threads, draft replies, and rewrite text. Type @ to mention someone from your sent-mail contacts, or use the calendar button to create an invite.",
    href: "/dashboard/inbox",
  },
] as const;

const STEPS = [
  {
    step: "1",
    title: "Sign in",
    body: "Use your Google account to sign in. Orion uses secure cookie-based sessions.",
  },
  {
    step: "2",
    title: "Connect Gmail & Calendar",
    body: "Open the connections menu in the top header (refresh icon) and connect Gmail and Google Calendar. Both are required for mail and scheduling features.",
  },
  {
    step: "3",
    title: "Work from the dashboard",
    body: "Use the sidebar to switch between Inbox, Calendar, Drafts, Sent, and Trash. Orion Intelligence stays open on the right while you work.",
  },
  {
    step: "4",
    title: "Let Orion help",
    body: "Ask Orion to summarize an email, draft a reply, or rewrite text. Nothing is sent automatically — you stay in control of what goes out.",
  },
] as const;

const FAQ = [
  {
    q: "Why don't I see any emails?",
    a: "Make sure Gmail is connected in the header connections menu. If you just connected, give sync a moment — new mail also arrives via live updates in the background.",
  },
  {
    q: "Why is the calendar empty?",
    a: "Connect Google Calendar from the same connections menu. Events load for the day, week, or month you're viewing.",
  },
  {
    q: "How do mentions work in chat?",
    a: "Type @ in the Orion chat box to search contacts from your sent mail. Pick someone to insert their email into your prompt.",
  },
  {
    q: "Do changes sync automatically?",
    a: "Yes. When Gmail or Calendar changes, Orion refreshes your inbox and calendar views in the background.",
  },
] as const;

export default function HelpPage() {
  return (
    <div className="mx-auto overflow-y-auto h-[calc(100vh-4rem)] max-w-4xl space-y-10 px-4 py-10 md:px-6">
      {/* Hero */}
      <section className="flex flex-col items-center gap-4 text-center">
        <Image src="/orion.png" alt="Orion" width={56} height={56} className="size-14" />
        <div>
          <h1 className="text-headline-sm font-bold text-foreground">Help &amp; Guide</h1>
          <p className="mt-2 max-w-2xl text-body-md text-muted-foreground">
            Orion is your AI executive assistant for email and calendar — built for professionals
            who want clarity without inbox noise
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/inbox">
            Go to Inbox
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      {/* What it does */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">What Orion does</h2>
        <p className="text-body-md text-muted-foreground leading-relaxed">
          Orion connects to your Gmail and Google Calendar, keeps them in sync, and gives you an AI
          assistant that can summarize mail, draft responses, rewrite text, and schedule meetings —
          all from one dashboard. Mail lands in your Inbox, calendar events appear in multiple
          views, and Orion Intelligence works beside you on every dashboard page.
        </p>
      </section>

      {/* Getting started */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">Getting started</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {STEPS.map(({ step, title, body }) => (
            <Card key={step}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3 text-base">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {step}
                  </span>
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 pt-6">
            <RefreshCw className="mt-0.5 size-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Connections:</span> use the refresh icon
              in the top header to connect or check Gmail and Google Calendar status.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Features */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">What you can do</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, description, href }) => (
            <Card key={title}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="size-5 text-primary" />
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href={href}>Open {title}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">Common questions</h2>
        <div className="space-y-3">
          {FAQ.map(({ q, a }) => (
            <Card key={q}>
              <CardContent className="pt-6">
                <p className="font-medium text-foreground">{q}</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="rounded-xl border border-border bg-secondary/30 px-6 py-8 text-center">
        <p className="text-lg font-semibold text-foreground">Need more help?</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Start in your Inbox and ask Orion Intelligence on the right — it can walk you through
          summarizing, drafting, and scheduling.
        </p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/dashboard/inbox">Back to dashboard</Link>
        </Button>
      </section>
    </div>
  );
}
