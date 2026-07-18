"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";

const FAQS = [
  {
    id: "what-is-orion",
    question: "What is Orion?",
    answer:
      "Orion is an AI executive assistant for Gmail and Google Calendar. It helps you search mail, draft replies, schedule meetings, and stay on top of your inbox — with you always in control of what gets sent.",
  },
  {
    id: "how-connect",
    question: "How does Orion connect to my Gmail and Calendar?",
    answer:
      "Orion uses Corsair for OAuth and Google APIs. You sign in with Google once, grant the scopes you need, and Orion talks to Gmail and Calendar through that secure connection — no password sharing.",
  },
  {
    id: "sends-without-me",
    question: "Will Orion send emails or invites without my approval?",
    answer:
      "No. Drafts and calendar invites are prepared for you to review. Nothing leaves your account until you confirm — so replies and meetings only go out when you say so.",
  },
  {
    id: "data-privacy",
    question: "What happens to my email data?",
    answer:
      "Orion only accesses what you authorize for the features you use. Mail and calendar data is used to power your assistant workflows — not sold, and not used to train public models.",
  },
  {
    id: "corsair-mcp",
    question: "What is Corsair MCP, and why does it matter?",
    answer:
      "Corsair MCP is how Orion will expose email and calendar actions as tools an agent can call with natural language — search, draft, schedule, and more. The Agent section on this page is a preview of that direction.",
  },
] as const;

export default function FAQ() {
  return (
    <section id="faq" className="scroll-mt-20 px-6 py-20 md:py-28">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 md:flex-row md:justify-between md:gap-16">
        <div className="shrink-0 md:max-w-xs">
          <p className="text-label-sm uppercase tracking-[0.04em] text-muted-foreground">FAQ</p>
          <h2 className="mt-3 text-headline-lg text-foreground">Questions you may need answered</h2>
        </div>

        <Accordion type="single" collapsible defaultValue={FAQS[0].id} className="w-full min-w-0">
          {FAQS.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger className="text-left text-base text-on-surface hover:no-underline cursor-pointer">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-body-lg text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
