import { z } from "zod";
import { completeChat } from "../open-ai_SDK";
import {
  corsairEventRiskLevelValues,
  corsairEventServiceValues,
  gmailCorsairActionValues,
  googleCalendarCorsairActionValues,
} from "@repo/database/schema";
import type { RagRunResultModelType } from "../rag/pipeline.model";

const dateTimeFieldModel = z.object({
  dateTime: z.string().nullable(),
  date: z.string().nullable(),
  timeZone: z.string().nullable(),
});

const plannedParametersModel = z.object({
  messageId: z.string().nullable(),
  threadId: z.string().nullable(),
  query: z.string().nullable(),
  to: z.array(z.string()).nullable(),
  cc: z.array(z.string()).nullable(),
  bcc: z.array(z.string()).nullable(),
  subject: z.string().nullable(),
  body: z.string().nullable(),
  inReplyTo: z.string().nullable(),
  forwardMessageId: z.string().nullable(),
  addLabels: z.array(z.string()).nullable(),
  removeLabels: z.array(z.string()).nullable(),
  permanent: z.boolean().nullable(),
  isDraft: z.boolean().nullable(),
  calendarId: z.string().nullable(),
  eventId: z.string().nullable(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  start: dateTimeFieldModel.nullable(),
  end: dateTimeFieldModel.nullable(),
  attendees: z
    .array(
      z.object({
        email: z.string(),
        displayName: z.string().nullable(),
      }),
    )
    .nullable(),
  timeMin: z.string().nullable(),
  timeMax: z.string().nullable(),
});

export const plannedCorsairActionModel = z.object({
  service: z.enum(corsairEventServiceValues),
  action: z.string(),
  title: z.string(),
  description: z.string(),
  riskLevel: z.enum(corsairEventRiskLevelValues),
  parameters: plannedParametersModel,
});

export type PlannedCorsairAction = z.infer<typeof plannedCorsairActionModel>;

const GMAIL_AGENT_FALLBACK_ACTIONS = new Set([
  "reply",
  "forward",
  "create_draft",
  "update_draft",
]);

/** Normalize Gmail send fields from planned/stored parameters. */
export function extractGmailSendFields(
  parameters: Record<string, unknown>,
): { to: string; subject: string; body: string } | null {
  const toRaw = parameters.to;
  const to = Array.isArray(toRaw)
    ? toRaw.find((v) => typeof v === "string" && v.trim().length > 0)
    : toRaw;
  const subject = parameters.subject;
  const body = parameters.body;

  if (typeof to !== "string" || !to.trim()) return null;
  if (typeof subject !== "string" || !subject.trim()) return null;
  if (typeof body !== "string" || !body.trim()) return null;

  return { to: to.trim(), subject: subject.trim(), body: body.trim() };
}

export function hasGmailSendFields(parameters: Record<string, unknown>): boolean {
  return extractGmailSendFields(parameters) !== null;
}

/** Prefer agent_execute when a direct Gmail action cannot run with stored parameters. */
export function ensureExecutablePlannedAction(
  planned: PlannedCorsairAction,
): PlannedCorsairAction {
  if (planned.action === "agent_execute") return planned;

  if (planned.service !== "gmail") return planned;

  const compact = compactPlannedParameters(planned.parameters);

  if (GMAIL_AGENT_FALLBACK_ACTIONS.has(planned.action)) {
    return {
      ...planned,
      action: "agent_execute",
      description: `${planned.description} (runs via Corsair agent after approval)`,
    };
  }

  if (planned.action === "send" && !hasGmailSendFields(compact)) {
    return {
      ...planned,
      action: "agent_execute",
      description: `${planned.description} (email details will be resolved by Corsair at execution)`,
    };
  }

  return planned;
}

const CALENDAR_APPROVAL_ACTIONS = new Set(["create", "update", "delete"]);

/** Whether a planned Corsair action must go through the approval flow before running. */
export function requiresCorsairApproval(
  planned: PlannedCorsairAction,
  rawPlanned?: PlannedCorsairAction,
): boolean {
  const source = rawPlanned ?? planned;

  if (source.service === "gmail") {
    return source.action === "send" || source.action === "reply";
  }

  if (source.service === "google_calendar") {
    return CALENDAR_APPROVAL_ACTIONS.has(source.action);
  }

  return false;
}

/** Drop nulls so execution only sees concrete values. */
export function compactPlannedParameters(
  parameters: z.infer<typeof plannedParametersModel>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      const nested: Record<string, unknown> = {};
      for (const [nk, nv] of Object.entries(value as Record<string, unknown>)) {
        if (nv !== null && nv !== undefined) nested[nk] = nv;
      }
      if (Object.keys(nested).length > 0) out[key] = nested;
      continue;
    }
    out[key] = value;
  }
  return out;
}

const PLANNER_MODEL = "gpt-4o-mini";

const PLANNER_SYSTEM = `You plan Corsair actions for Orion — an executive assistant with Gmail and Google Calendar access.

Given the user's chat request and RAG context, output a single planned action.

Rules:
- service: "gmail" for email tasks, "google_calendar" for calendar/scheduling tasks
- action: pick the most specific operation (prefer concrete actions over agent_execute)
- gmail actions: ${gmailCorsairActionValues.filter((a) => a !== "agent_execute").join(", ")}
- calendar actions: ${googleCalendarCorsairActionValues.filter((a) => a !== "agent_execute").join(", ")}
- use agent_execute only when the request needs multiple chained steps or unclear decomposition
- parameters: fill only fields needed for that action; set unused fields to null
- for action "send": parameters.to (array of recipient emails), parameters.subject, and parameters.body are REQUIRED — infer all three from the user request and thread; never leave them null
- if you cannot determine to, subject, and body for an email, use action agent_execute instead of send
- riskLevel: high for send/delete/forward; medium for create/update/draft; low for search/read/check_availability
- title: short user-facing summary (max 80 chars)
- description: one sentence explaining what will happen when the action runs
- approval is required only for gmail send/reply and calendar create/update/delete; read/search/draft actions run immediately`;

function plannerJsonSchema() {
  const dateTimeField = {
    type: "object",
    properties: {
      dateTime: { type: ["string", "null"] },
      date: { type: ["string", "null"] },
      timeZone: { type: ["string", "null"] },
    },
    required: ["dateTime", "date", "timeZone"],
    additionalProperties: false,
  };

  const stringOrNull = { type: ["string", "null"] };
  const stringArrayOrNull = {
    type: ["array", "null"],
    items: { type: "string" },
  };
  const boolOrNull = { type: ["boolean", "null"] };

  return {
    type: "object",
    properties: {
      service: { type: "string", enum: [...corsairEventServiceValues] },
      action: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      riskLevel: { type: "string", enum: [...corsairEventRiskLevelValues] },
      parameters: {
        type: "object",
        properties: {
          messageId: stringOrNull,
          threadId: stringOrNull,
          query: stringOrNull,
          to: stringArrayOrNull,
          cc: stringArrayOrNull,
          bcc: stringArrayOrNull,
          subject: stringOrNull,
          body: stringOrNull,
          inReplyTo: stringOrNull,
          forwardMessageId: stringOrNull,
          addLabels: stringArrayOrNull,
          removeLabels: stringArrayOrNull,
          permanent: boolOrNull,
          isDraft: boolOrNull,
          calendarId: stringOrNull,
          eventId: stringOrNull,
          summary: stringOrNull,
          description: stringOrNull,
          location: stringOrNull,
          start: { anyOf: [dateTimeField, { type: "null" }] },
          end: { anyOf: [dateTimeField, { type: "null" }] },
          attendees: {
            anyOf: [
              {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    email: { type: "string" },
                    displayName: { type: ["string", "null"] },
                  },
                  required: ["email", "displayName"],
                  additionalProperties: false,
                },
              },
              { type: "null" },
            ],
          },
          timeMin: stringOrNull,
          timeMax: stringOrNull,
        },
        required: [
          "messageId",
          "threadId",
          "query",
          "to",
          "cc",
          "bcc",
          "subject",
          "body",
          "inReplyTo",
          "forwardMessageId",
          "addLabels",
          "removeLabels",
          "permanent",
          "isDraft",
          "calendarId",
          "eventId",
          "summary",
          "description",
          "location",
          "start",
          "end",
          "attendees",
          "timeMin",
          "timeMax",
        ],
        additionalProperties: false,
      },
    },
    required: ["service", "action", "title", "description", "riskLevel", "parameters"],
    additionalProperties: false,
  };
}

export async function planCorsairActionFromRag(
  input: {
    prompt: string;
    rag: RagRunResultModelType;
    signal?: AbortSignal;
  },
): Promise<PlannedCorsairAction> {
  const context = [
    `User request:\n${input.prompt}`,
    input.rag.enhancedPrompt !== input.prompt
      ? `\nEnhanced prompt:\n${input.rag.enhancedPrompt}`
      : "",
    `\nDeterminer reasoning:\n${input.rag.meta.determination.reasoning}`,
    input.rag.history.length
      ? `\nRecent thread:\n${input.rag.history
          .slice(-5)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return completeChat({
    model: PLANNER_MODEL,
    systemPrompt: PLANNER_SYSTEM,
    userPrompt: context,
    temperature: 0,
    signal: input.signal,
    outputDto: {
      name: "planned_corsair_action",
      zodSchema: plannedCorsairActionModel,
      jsonSchema: plannerJsonSchema(),
    },
  });
}
