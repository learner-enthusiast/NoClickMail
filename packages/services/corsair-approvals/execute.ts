import {
  corsairAgentExecuteAction,
  type CorsairAgentExecutionParameters,
  type CorsairEvent,
} from "@repo/database/schema";
import GmailService from "../gmail";
import CalendarService from "../calendar";
import type { ListEventsInputModelType } from "../calendar/model";
import TenantCorsairAgent from "../open-ai_SDK/corsair-agent";
import { badRequest } from "../error";
import { extractGmailSendFields, hasGmailSendFields } from "./planner";

const gmailService = new GmailService();
const calendarService = new CalendarService();

function formatResult(data: unknown): string {
  if (typeof data === "string") return data;
  return JSON.stringify(data, null, 2);
}

function readAgentContext(
  parameters: Record<string, unknown>,
): CorsairAgentExecutionParameters | null {
  const ctx = parameters.agentContext;
  if (!ctx || typeof ctx !== "object") return null;
  const candidate = ctx as CorsairAgentExecutionParameters;
  if (typeof candidate.prompt !== "string" || typeof candidate.enhancedPrompt !== "string") {
    return null;
  }
  return candidate;
}

async function executeCorsairAgent(
  userId: string,
  params: CorsairAgentExecutionParameters,
  signal?: AbortSignal,
): Promise<string> {
  let output = "";
  for await (const delta of new TenantCorsairAgent(userId).executePromptStream(
    params.prompt,
    params.history,
    signal,
    { enhancedPrompt: params.enhancedPrompt, retrieved: params.retrieved },
  )) {
    output += delta;
  }
  return output;
}

function requireStringParam(
  parameters: Record<string, unknown>,
  key: string,
  message: string,
): string {
  const value = parameters[key];
  if (typeof value !== "string") throw badRequest(message);
  return value;
}

async function executeGmailSend(
  userId: string,
  parameters: Record<string, unknown>,
): Promise<string> {
  const sendFields = extractGmailSendFields(parameters);
  if (!sendFields) {
    throw badRequest(
      "Gmail send requires to, subject, and body. Reject this approval and ask Orion to send the email again.",
    );
  }

  await gmailService.sendMessage(userId, sendFields);
  return `Your email to ${sendFields.to} with subject "${sendFields.subject}" was sent successfully.`;
}

async function executeGmailWithAgent(
  userId: string,
  action: string,
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  const agentContext = readAgentContext(parameters);
  if (!agentContext) {
    throw badRequest(`Gmail ${action} is not supported without agent context`);
  }
  return executeCorsairAgent(userId, agentContext, signal);
}

async function executeGmailAction(
  userId: string,
  action: string,
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<string> {
  switch (action) {
    case "search": {
      const result = await gmailService.listInbox(userId, {
        maxResults: 20,
        q: typeof parameters.query === "string" ? parameters.query : undefined,
      });
      return formatResult(result);
    }
    case "read": {
      const messageId = requireStringParam(parameters, "messageId", "Gmail read requires messageId");
      const result = await gmailService.getMessage(userId, { id: messageId });
      return formatResult(result);
    }
    case "send":
      return executeGmailSend(userId, parameters);
    case "reply":
    case "forward":
    case "create_draft":
    case "update_draft":
      return executeGmailWithAgent(userId, action, parameters, signal);
    case "delete": {
      const id = requireStringParam(parameters, "messageId", "Gmail delete requires messageId");
      await gmailService.deleteMessage(userId, {
        id,
        permanent: parameters.permanent === true,
        isDraft: parameters.isDraft === true,
      });
      return "The email was deleted successfully.";
    }
    case "archive":
    case "modify_labels": {
      const id = requireStringParam(parameters, "messageId", "Gmail label change requires messageId");
      await gmailService.markMessageRead(userId, { id, read: true });
      return `Gmail labels updated for message ${id}.`;
    }
    default:
      throw badRequest(`Unsupported Gmail action: ${action}`);
  }
}

async function executeCalendarAction(
  userId: string,
  action: string,
  parameters: Record<string, unknown>,
): Promise<string> {
  const calendarId =
    typeof parameters.calendarId === "string" ? parameters.calendarId : "primary";

  const listEventsInput = (
    overrides: Pick<ListEventsInputModelType, "q" | "timeMin" | "timeMax"> = {},
  ): ListEventsInputModelType => ({
    calendarId,
    maxResults: 20,
    singleEvents: true,
    orderBy: "startTime",
    ...overrides,
  });

  switch (action) {
    case "search": {
      const result = await calendarService.listEvents(
        userId,
        listEventsInput({
          q: typeof parameters.query === "string" ? parameters.query : undefined,
          timeMin: typeof parameters.timeMin === "string" ? parameters.timeMin : undefined,
          timeMax: typeof parameters.timeMax === "string" ? parameters.timeMax : undefined,
        }),
      );
      return formatResult(result);
    }
    case "read": {
      const eventId = parameters.eventId;
      if (typeof eventId !== "string") throw badRequest("Calendar read requires eventId");
      const result = await calendarService.getEvent(userId, { calendarId, id: eventId });
      return formatResult(result);
    }
    case "create": {
      const summary = parameters.summary;
      const start = parameters.start;
      const end = parameters.end;
      const startDt =
        typeof start === "object" && start !== null && "dateTime" in start
          ? String((start as { dateTime?: string }).dateTime ?? "")
          : typeof start === "string"
            ? start
            : "";
      const endDt =
        typeof end === "object" && end !== null && "dateTime" in end
          ? String((end as { dateTime?: string }).dateTime ?? "")
          : typeof end === "string"
            ? end
            : "";
      if (typeof summary !== "string" || !startDt || !endDt) {
        throw badRequest("Calendar create requires summary, start, and end");
      }
      const attendees = Array.isArray(parameters.attendees)
        ? parameters.attendees
            .map((a) =>
              typeof a === "object" && a !== null && "email" in a
                ? String((a as { email: string }).email)
                : null,
            )
            .filter((e): e is string => !!e)
        : undefined;
      const result = await calendarService.createEvent(userId, {
        calendarId,
        summary,
        description:
          typeof parameters.description === "string" ? parameters.description : undefined,
        location: typeof parameters.location === "string" ? parameters.location : undefined,
        start: startDt,
        end: endDt,
        attendees,
      });
      return `Calendar event created.\n\n${formatResult(result)}`;
    }
    case "delete": {
      const eventId = parameters.eventId;
      if (typeof eventId !== "string") throw badRequest("Calendar delete requires eventId");
      const result = await calendarService.deleteEvent(userId, { calendarId, id: eventId });
      return `Calendar event deleted.\n\n${formatResult(result)}`;
    }
    case "check_availability": {
      const result = await calendarService.listEvents(
        userId,
        listEventsInput({
          timeMin: typeof parameters.timeMin === "string" ? parameters.timeMin : undefined,
          timeMax: typeof parameters.timeMax === "string" ? parameters.timeMax : undefined,
        }),
      );
      return `Availability check:\n\n${formatResult(result)}`;
    }
    default:
      throw badRequest(`Unsupported calendar action: ${action}`);
  }
}

export async function executeApprovedCorsairEvent(
  userId: string,
  approval: CorsairEvent,
  signal?: AbortSignal,
): Promise<string> {
  const parameters = approval.parameters as Record<string, unknown>;

  if (approval.service === "gmail" && hasGmailSendFields(parameters)) {
    return executeGmailSend(userId, parameters);
  }

  if (approval.action === corsairAgentExecuteAction) {
    const agentParams = parameters as unknown as CorsairAgentExecutionParameters;
    return executeCorsairAgent(userId, agentParams, signal);
  }

  if (approval.service === "gmail") {
    return executeGmailAction(userId, approval.action, parameters, signal);
  }

  if (approval.service === "google_calendar") {
    return executeCalendarAction(userId, approval.action, parameters);
  }

  throw badRequest(`Unsupported approval service: ${approval.service}`);
}

export async function* executeApprovedCorsairEventStream(
  userId: string,
  approval: CorsairEvent,
  signal?: AbortSignal,
): AsyncGenerator<{ type: "delta"; text: string } | { type: "done"; output: string }> {
  if (approval.action === corsairAgentExecuteAction) {
    const params = approval.parameters as unknown as CorsairAgentExecutionParameters;
    let output = "";
    for await (const delta of new TenantCorsairAgent(userId).executePromptStream(
      params.prompt,
      params.history,
      signal,
      { enhancedPrompt: params.enhancedPrompt, retrieved: params.retrieved },
    )) {
      output += delta;
      yield { type: "delta", text: delta };
    }
    yield { type: "done", output };
    return;
  }

  const output = await executeApprovedCorsairEvent(userId, approval, signal);
  yield { type: "delta", text: output };
  yield { type: "done", output };
}
