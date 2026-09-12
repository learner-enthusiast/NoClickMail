import { z } from "zod";
import { completeChat } from "@repo/openai-client";
import type { CorsairEvent } from "@repo/database/schema";
import type { ThreadContextMessageModelType } from "@repo/rag-models/context.model";
import { extractGmailSendFields } from "./planner";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const APPROVAL_LINK_RE = /\/approval\/([0-9a-f-]{36})/gi;

const GLOBAL_SIGNATURE_PATTERNS = [
  /\bmy (address|email|signature|contact)\b/i,
  /\badd (my )?(address|email|signature)\b/i,
  /\bsign(?:ature)?\b/i,
  /\bbest,?[\s\S]{0,20}\[your name\]/i,
];

const approvalEditPlanModel = z.object({
  to: z.string().nullable(),
  subject: z.string().nullable(),
  body: z.string().nullable(),
});

export type ApprovalEditDraft = {
  to?: string;
  subject?: string;
  body?: string;
};

export function extractApprovalIdsFromText(text: string): string[] {
  return [...new Set([...text.matchAll(APPROVAL_LINK_RE)].map((match) => match[1]!))];
}

function approvalRecipient(approval: CorsairEvent): string | undefined {
  const fields = extractGmailSendFields(approval.parameters as Record<string, unknown>);
  return fields?.to;
}

function approvalSubject(approval: CorsairEvent): string | undefined {
  const params = approval.parameters as Record<string, unknown>;
  return typeof params.subject === "string" ? params.subject : undefined;
}

function summarizeApproval(approval: CorsairEvent): string {
  const to = approvalRecipient(approval);
  const subject = approvalSubject(approval);
  if (to && subject) return `Send "${subject}" to ${to}`;
  if (subject) return `"${subject}"`;
  if (to) return `Email to ${to}`;
  return approval.title;
}

function looksLikeGlobalSignatureEdit(prompt: string): boolean {
  return GLOBAL_SIGNATURE_PATTERNS.some((pattern) => pattern.test(prompt));
}

function matchApprovalsByPromptHint(
  prompt: string,
  approvals: CorsairEvent[],
): CorsairEvent[] {
  const lower = prompt.toLowerCase();
  const byRecipient = approvals.filter((approval) => {
    const to = approvalRecipient(approval)?.toLowerCase();
    return to ? lower.includes(to) : false;
  });
  if (byRecipient.length === 1) return byRecipient;

  const bySubject = approvals.filter((approval) => {
    const subject = approvalSubject(approval)?.toLowerCase();
    return subject && subject.length > 3 && lower.includes(subject);
  });
  if (bySubject.length === 1) return bySubject;

  return [];
}

export function resolveApprovalsToEdit(input: {
  prompt: string;
  history: ThreadContextMessageModelType[];
  pendingInThread: CorsairEvent[];
}): { approvals: CorsairEvent[] } | { clarify: string } {
  const { prompt, history, pendingInThread } = input;
  if (pendingInThread.length === 0) {
    return {
      clarify:
        "I don't see any pending approvals in this conversation. Create an email send request first, or share the approval ID you'd like to edit.",
    };
  }

  const uuidInPrompt = prompt.match(UUID_RE)?.[0]?.toLowerCase();
  if (uuidInPrompt) {
    const matched = pendingInThread.find((approval) => approval.id.toLowerCase() === uuidInPrompt);
    if (matched) return { approvals: [matched] };
    return {
      clarify:
        "That approval ID isn't pending in this thread (it may already be sent or rejected). Share a pending approval link from this chat or open /approvals.",
    };
  }

  const historyIds = new Set<string>();
  for (const message of history) {
    if (message.role !== "assistant") continue;
    for (const id of extractApprovalIdsFromText(message.content)) {
      historyIds.add(id);
    }
  }

  const recentPending = pendingInThread.filter((approval) => historyIds.has(approval.id));
  if (recentPending.length === 1) return { approvals: recentPending };

  const hinted = matchApprovalsByPromptHint(prompt, pendingInThread);
  if (hinted.length === 1) return { approvals: hinted };

  if (pendingInThread.length === 1) return { approvals: pendingInThread };

  if (looksLikeGlobalSignatureEdit(prompt) && pendingInThread.length > 1) {
    return { approvals: pendingInThread };
  }

  const lines = pendingInThread.map(
    (approval, index) =>
      `${index + 1}. ${summarizeApproval(approval)} — [Review](/approval/${approval.id})`,
  );

  return {
    clarify:
      `I found ${pendingInThread.length} pending approvals in this thread. Which one should I edit?\n\n` +
      `${lines.join("\n")}\n\n` +
      "Reply with the recipient email, subject line, or paste the approval ID.",
  };
}

export async function planApprovalEditsFromChat(input: {
  prompt: string;
  current: { to: string; subject: string; body: string };
  signal?: AbortSignal;
}): Promise<ApprovalEditDraft> {
  const result = await completeChat({
    model: "gpt-4o-mini",
    systemPrompt: `You update pending Gmail approval drafts from user chat instructions.

Given the current To, Subject, and Body plus the user's edit request:
- Return null for any field that should NOT change.
- Return the full new body text when the body should change (integrate address, email, name, signature naturally).
- Replace placeholders like [Your Name] with real details when the user provides them.
- Do not invent facts the user did not provide.`,
    userPrompt: [
      `Current To: ${input.current.to}`,
      `Current Subject: ${input.current.subject}`,
      "Current Body:",
      input.current.body,
      "",
      `User edit request:\n${input.prompt}`,
    ].join("\n"),
    temperature: 0,
    signal: input.signal,
    outputDto: {
      name: "approval_edit_plan",
      zodSchema: approvalEditPlanModel,
      jsonSchema: {
        type: "object",
        properties: {
          to: { type: ["string", "null"] },
          subject: { type: ["string", "null"] },
          body: { type: ["string", "null"] },
        },
        required: ["to", "subject", "body"],
        additionalProperties: false,
      },
    },
  });

  const draft: ApprovalEditDraft = {};
  if (result.to != null) draft.to = result.to;
  if (result.subject != null) draft.subject = result.subject;
  if (result.body != null) draft.body = result.body;
  return draft;
}

export function formatApprovalUpdatedMessage(input: {
  id: string;
  to?: string;
  subject?: string;
}): string {
  const label = input.to ? `email to ${input.to}` : "approval";
  const subjectLine = input.subject ? `\nSubject: ${input.subject}` : "";
  return (
    `Updated the pending ${label}.${subjectLine}\n\n` +
    `[Review approval](/approval/${input.id})\n\n` +
    "Open the link to review and send when ready."
  );
}

export function formatMultipleApprovalsUpdatedMessage(
  approvals: Array<{ id: string; to?: string; subject?: string }>,
): string {
  if (approvals.length === 1) {
    return formatApprovalUpdatedMessage(approvals[0]!);
  }

  const lines = approvals.map((approval, index) => {
    const label = approval.to ? `Send to ${approval.to}` : `Approval ${index + 1}`;
    return `${index + 1}. ${label} — [Review](/approval/${approval.id})`;
  });

  return (
    `Updated ${approvals.length} pending approvals.\n\n` +
    `${lines.join("\n")}\n\n` +
    "Review each approval before sending."
  );
}
