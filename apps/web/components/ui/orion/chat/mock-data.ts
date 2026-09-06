import type { ChatMessage, ChatThread } from "./types";

export const MOCK_CHAT_THREADS: ChatThread[] = [
  {
    id: "weekly-planning",
    title: "Weekly planning",
    preview: "Block focus time before investor calls…",
    updatedAt: "2026-09-06T08:30:00.000Z",
    mode: "text-to-text",
  },
  {
    id: "inbox-summary",
    title: "Inbox summary",
    preview: "Three threads need replies today…",
    updatedAt: "2026-09-05T19:12:00.000Z",
    mode: "text-to-text",
  },
  {
    id: "voice-briefing",
    title: "Morning voice briefing",
    preview: "Listen to today’s calendar overview…",
    updatedAt: "2026-09-05T07:45:00.000Z",
    mode: "text-to-voice",
  },
  {
    id: "meeting-notes",
    title: "Meeting notes capture",
    preview: "Transcribe standup and extract actions…",
    updatedAt: "2026-09-04T16:20:00.000Z",
    mode: "text-to-text",
  },
  {
    id: "live-coach",
    title: "Live coaching session",
    preview: "Practice pitch with voice responses…",
    updatedAt: "2026-09-03T11:05:00.000Z",
    mode: "voice-to-voice",
  },
];

export const MOCK_CHAT_MESSAGES: Record<string, ChatMessage[]> = {
  "weekly-planning": [
    {
      id: "m1",
      role: "user",
      content: "Help me plan next week around two investor calls and a product launch.",
      createdAt: "2026-09-06T08:28:00.000Z",
    },
    {
      id: "m2",
      role: "assistant",
      content:
        "Here is a draft structure:\n\n• Mon — deep work AM, inbox sweep PM\n• Tue — prep investor narrative\n• Wed — launch checklist + comms review\n• Thu — investor calls (buffer 30m before each)\n• Fri — retrospective + follow-ups\n\nWant me to turn this into calendar holds?",
      createdAt: "2026-09-06T08:29:00.000Z",
    },
  ],
  "inbox-summary": [
    {
      id: "m3",
      role: "user",
      content: "Summarize what needs attention in my inbox today.",
      createdAt: "2026-09-05T19:10:00.000Z",
    },
    {
      id: "m4",
      role: "assistant",
      content:
        "Three threads look urgent: vendor contract redlines, customer escalation from Acme, and a calendar conflict for Thursday’s board prep.",
      createdAt: "2026-09-05T19:11:00.000Z",
    },
  ],
  "voice-briefing": [
    {
      id: "m5",
      role: "user",
      content: "Give me a spoken briefing for today’s schedule.",
      createdAt: "2026-09-05T07:44:00.000Z",
    },
    {
      id: "m6",
      role: "assistant",
      content: "[Voice reply preview] You have four meetings, with a 90-minute focus block suggested at 2 PM.",
      createdAt: "2026-09-05T07:45:00.000Z",
    },
  ],
  "meeting-notes": [
    {
      id: "m7",
      role: "user",
      content: "Capture notes from my standup recording.",
      createdAt: "2026-09-04T16:18:00.000Z",
    },
    {
      id: "m8",
      role: "assistant",
      content: "Action items: ship approval UI, refresh OAuth tokens, finalize launch email draft.",
      createdAt: "2026-09-04T16:19:00.000Z",
    },
  ],
  "live-coach": [
    {
      id: "m9",
      role: "user",
      content: "Let's practice my product pitch with back-and-forth voice.",
      createdAt: "2026-09-03T11:03:00.000Z",
    },
    {
      id: "m10",
      role: "assistant",
      content: "[Voice reply preview] Strong opening. Tighten the problem statement to 15 seconds before the demo.",
      createdAt: "2026-09-03T11:04:00.000Z",
    },
  ],
};

export function getThreadById(id: string): ChatThread | undefined {
  return MOCK_CHAT_THREADS.find((thread) => thread.id === id);
}

export function getMessagesByThreadId(id: string): ChatMessage[] {
  return MOCK_CHAT_MESSAGES[id] ?? [];
}
