"use client";

import { useEffect, useState } from "react";
import { Calendar, Mail, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

type DemoId = "reply" | "schedule" | "search";

const DEMOS: {
  id: DemoId;
  label: string;
  icon: typeof Mail;
  prompt: string;
  steps: { tool: string; detail: string }[];
  result: { title: string; body: string; meta: string };
}[] = [
  {
    id: "reply",
    label: "Draft a reply",
    icon: Mail,
    prompt: "Reply to Priya — confirm Thursday and ask for the deck.",
    steps: [
      { tool: "gmail.search", detail: "thread:from:priya subject:kickoff" },
      { tool: "gmail.draft", detail: "tone: concise · length: short" },
    ],
    result: {
      title: "To: priya.sharma@acme.com",
      body: "Thursday works — looking forward to it. Could you share the deck beforehand?",
      meta: "Draft ready · awaiting your send",
    },
  },
  {
    id: "schedule",
    label: "Schedule a meeting",
    icon: Calendar,
    prompt: "Find 30 min with Arjun next week and send an invite.",
    steps: [
      { tool: "calendar.freeBusy", detail: "Arjun · next week · 30m" },
      { tool: "calendar.create", detail: "Tue 2:00–2:30 PM · Google Meet" },
    ],
    result: {
      title: "Sync with Arjun",
      body: "Tue · 2:00–2:30 PM · Google Meet link attached",
      meta: "Invite queued · confirm to send",
    },
  },
  {
    id: "search",
    label: "Search mail",
    icon: Search,
    prompt: "Where’s the Q3 pricing PDF from last month?",
    steps: [
      { tool: "gmail.search", detail: "filename:pdf Q3 pricing newer_than:30d" },
      { tool: "gmail.get", detail: "message · attachment metadata" },
    ],
    result: {
      title: "Re: Q3 pricing — final",
      body: "From: ananya.mehta@ · Attachment: Q3_pricing_final.pdf",
      meta: "1 match · open in inbox",
    },
  },
];

function TypingPrompt({ text, active }: { text: string; active: boolean }) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (!active) {
      setShown("");
      return;
    }
    setShown("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, 22);
    return () => window.clearInterval(id);
  }, [text, active]);

  return (
    <p className="font-mono text-sm text-on-surface">
      <span className="text-muted-foreground">&gt; </span>
      {shown}
      <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-primary-accent align-middle" />
    </p>
  );
}

function DemoPanel({ demo, active }: { demo: (typeof DEMOS)[number]; active: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-outline bg-linear-to-tr from-surface-container/80 to-transparent">
      <div className="border-b border-outline px-4 py-3 sm:px-5">
        <p className="mb-2 text-label-sm uppercase tracking-[0.04em] text-muted-foreground">
          You say
        </p>
        <TypingPrompt text={demo.prompt} active={active} />
      </div>

      <div className="grid gap-0 sm:grid-cols-[1fr_1.15fr]">
        <div className="border-b border-outline px-4 py-4 sm:border-b-0 sm:border-r sm:px-5">
          <p className="mb-3 text-label-sm uppercase tracking-[0.04em] text-muted-foreground">
            Corsair MCP
          </p>
          <ol className="flex flex-col gap-2.5">
            {demo.steps.map((step, i) => (
              <motion.li
                key={step.tool}
                initial={{ opacity: 0, x: -8 }}
                animate={active ? { opacity: 1, x: 0 } : { opacity: 0.4, x: 0 }}
                transition={{ delay: active ? 0.55 + i * 0.35 : 0, duration: 0.35 }}
                className="rounded-lg border border-outline/80 bg-background/40 px-3 py-2"
              >
                <p className="font-mono text-xs text-ai-accent">{step.tool}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
              </motion.li>
            ))}
          </ol>
        </div>

        <div className="px-4 py-4 sm:px-5">
          <p className="mb-3 text-label-sm uppercase tracking-[0.04em] text-muted-foreground">
            Result
          </p>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={active ? { opacity: 1, y: 0 } : { opacity: 0.5, y: 0 }}
            transition={{ delay: active ? 1.4 : 0, duration: 0.4 }}
            className="rounded-lg border border-outline bg-background/50 px-4 py-3"
          >
            <p className="text-label-lg text-on-surface">{demo.result.title}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">{demo.result.body}</p>
            <p className="mt-3 text-label-sm uppercase tracking-[0.04em] text-secondary-accent">
              {demo.result.meta}
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function Agent() {
  const [tab, setTab] = useState<DemoId>("reply");

  return (
    <section id="agent" className="scroll-mt-20 px-6 py-20 md:py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <span className="inline-flex items-center rounded-full border border-outline px-3 py-1 font-mono text-label-sm uppercase tracking-[0.04em] text-primary-accent">
          Corsair MCP · Preview
        </span>
        <h2 className="text-headline-lg text-foreground">Talk to your inbox</h2>
        <p className="max-w-xl text-body-lg text-muted-foreground">
          Natural language → email and calendar actions over Corsair MCP. Pick a flow — this is
          where Orion is heading.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <Tabs value={tab} onValueChange={(v) => setTab(v as DemoId)} className="gap-4">
          <TabsList className="mx-auto flex h-auto w-full flex-wrap justify-center gap-1 bg-transparent p-0 sm:w-fit">
            {DEMOS.map((demo) => {
              const Icon = demo.icon;
              return (
                <TabsTrigger
                  key={demo.id}
                  value={demo.id}
                  className={cn(
                    "gap-2 rounded-lg border border-transparent px-3 py-2 data-[state=active]:border-outline data-[state=active]:bg-surface-container/80 data-[state=active]:shadow-none",
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={1.75} />
                  {demo.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {DEMOS.map((demo) => (
            <TabsContent key={demo.id} value={demo.id} className="mt-2 outline-none">
              <AnimatePresence mode="wait">
                {tab === demo.id && (
                  <motion.div
                    key={demo.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                  >
                    <DemoPanel demo={demo} active={tab === demo.id} />
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
