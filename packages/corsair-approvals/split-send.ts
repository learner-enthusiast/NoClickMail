import { compactPlannedParameters, type PlannedCorsairAction } from "./planner";

const EMAIL_RE = /(?:^|[\s,@])@?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

const INDIVIDUAL_SEND_PATTERNS = [
  /\bseparate(?:ly)?\b/i,
  /\bindividual(?:ly)?\b/i,
  /\bdifferent\s+(?:email\s+)?threads?\b/i,
  /\b(?:each|every)\s+(?:person|recipient|one|address|email)\b/i,
  /\bone\s+by\s+one\b/i,
  /\bnot\s+in\s+one\s+email\b/i,
  /\bsend\s+(?:it\s+)?(?:to\s+each|differently)\b/i,
  /\bmultiple\s+threads?\b/i,
  /\btwo\s+different\b/i,
  /\bcsv\b/i,
  /\bper\s+recipient\b/i,
  /\bsplit\b/i,
];

const BUNDLE_SEND_PATTERNS = [
  /\bone\s+email\b/i,
  /\bsame\s+email\b/i,
  /\ball\s+in\s+one\b/i,
  /\btogether\b/i,
  /\bboth\s+in\b/i,
  /\bcc\s+(?:both|all|them)\b/i,
  /\bbcc\s+(?:both|all|them)\b/i,
  /\bsingle\s+email\b/i,
];

/** Extract unique email addresses from free text (@mentions, CSV, comma lists). */
export function extractEmailsFromText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const match of text.matchAll(EMAIL_RE)) {
    const email = match[1]?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }

  return out;
}

/** Merge recipient emails from planned parameters and the user prompt. */
export function collectSendRecipients(
  prompt: string,
  parameters: Record<string, unknown>,
): string[] {
  const fromParams = Array.isArray(parameters.to)
    ? parameters.to.filter((v): v is string => typeof v === "string" && v.includes("@"))
    : typeof parameters.to === "string" && parameters.to.includes("@")
      ? [parameters.to]
      : [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const email of [...fromParams, ...extractEmailsFromText(prompt)]) {
    const trimmed = email.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }

  return out;
}

/** True when the user wants one approval (and send) per recipient. */
export function wantsIndividualSends(prompt: string, recipientCount: number): boolean {
  if (recipientCount <= 1) return false;
  if (BUNDLE_SEND_PATTERNS.some((pattern) => pattern.test(prompt))) return false;
  if (INDIVIDUAL_SEND_PATTERNS.some((pattern) => pattern.test(prompt))) return true;
  return extractEmailsFromText(prompt).length > 1;
}

export function shouldSplitGmailSendApprovals(
  planned: PlannedCorsairAction,
  prompt: string,
): boolean {
  if (planned.service !== "gmail" || planned.action !== "send") return false;

  const compact = compactPlannedParameters(planned.parameters);
  const recipients = collectSendRecipients(prompt, compact);
  return wantsIndividualSends(prompt, recipients.length);
}

export type RecipientSendDraft = {
  to: string;
  subject: string;
  body: string;
};

function sortRecipientsByPromptOrder(prompt: string, recipients: string[]): string[] {
  const lowerPrompt = prompt.toLowerCase();
  return [...recipients].sort(
    (a, b) => lowerPrompt.indexOf(a.toLowerCase()) - lowerPrompt.indexOf(b.toLowerCase()),
  );
}

/** Split multi-email writer output into subject/body blocks. */
export function parseEmailDraftBlocks(text: string): Array<{ subject: string; body: string }> {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!/^Subject:/im.test(normalized)) return [];

  return normalized
    .split(/\n(?=Subject:\s)/i)
    .map((section) => section.trim())
    .filter((section) => /^Subject:/i.test(section))
    .map((section) => {
      const lines = section.split("\n");
      const subject = (lines[0] ?? "").replace(/^Subject:\s*/i, "").trim();
      const body = lines.slice(1).join("\n").trim();
      return { subject, body };
    })
    .filter((block) => block.subject.length > 0 && block.body.length > 0);
}

/** Map text before each "to email@..." segment in the user prompt. */
export function segmentPromptIntentsByRecipient(
  prompt: string,
  recipients: string[],
): Map<string, string> {
  const intents = new Map<string, string>();
  const lowerPrompt = prompt.toLowerCase();
  let cursor = 0;

  for (const recipient of sortRecipientsByPromptOrder(prompt, recipients)) {
    const idx = lowerPrompt.indexOf(recipient.toLowerCase(), cursor);
    if (idx === -1) continue;

    let before = prompt.slice(cursor, idx).trim();
    before = before.replace(/^(?:and|then|,)\s+/i, "").replace(/\s+to\s*$/i, "").trim();
    before = before.replace(/^(?:write|send|email|draft)\s+/i, "").trim();

    if (before) intents.set(recipient, before);
    cursor = idx + recipient.length;
  }

  return intents;
}

function capitalizeSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function intentToEmailContent(intent: string): { subject: string; body: string } {
  const subject = capitalizeSentence(intent);
  const sentence = intent.trim().endsWith(".") ? intent.trim() : `${intent.trim()}.`;
  const body = `Hi,\n\n${capitalizeSentence(sentence)}\n\nBest,\n[Your Name]`;
  return { subject, body };
}

/** Build one subject/body per recipient from email draft, prompt segments, or planner fallback. */
export function resolvePerRecipientSendDrafts(input: {
  prompt: string;
  recipients: string[];
  emailDraft?: string;
  fallbackSubject?: string;
  fallbackBody?: string;
}): RecipientSendDraft[] {
  const orderedRecipients = sortRecipientsByPromptOrder(input.prompt, input.recipients);
  const intents = segmentPromptIntentsByRecipient(input.prompt, orderedRecipients);
  const draftBlocks = input.emailDraft ? parseEmailDraftBlocks(input.emailDraft) : [];

  return orderedRecipients.map((to, index) => {
    const draftBlock = draftBlocks[index];
    if (draftBlock) {
      return { to, subject: draftBlock.subject, body: draftBlock.body };
    }

    const intent = intents.get(to);
    if (intent) {
      const { subject, body } = intentToEmailContent(intent);
      return { to, subject, body };
    }

    return {
      to,
      subject: input.fallbackSubject?.trim() || "Email",
      body: input.fallbackBody?.trim() || "",
    };
  });
}

export function splitPlannedSendByRecipient(
  planned: PlannedCorsairAction,
  drafts: RecipientSendDraft[],
): PlannedCorsairAction[] {
  return drafts.map(({ to, subject, body }) => ({
    ...planned,
    title: `Send "${subject}" to ${to}`.slice(0, 80),
    description: `Send "${subject}" to ${to}.`,
    parameters: {
      ...planned.parameters,
      to: [to],
      subject,
      body,
    },
  }));
}
