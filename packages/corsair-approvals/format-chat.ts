import {
  corsairAgentExecuteAction,
  type CorsairEvent,
} from "@repo/database/schema";
import { extractGmailSendFields } from "./planner";

function stripTrailingJsonBlock(text: string): string {
  const match = text.match(/^([\s\S]*?)\n\n[\[{]/);
  return match?.[1]?.trim() ?? text.trim();
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

export function formatApprovalExecutionForChat(
  approval: Pick<CorsairEvent, "service" | "action" | "title" | "parameters">,
  rawOutput: string,
): string {
  if (approval.action === corsairAgentExecuteAction) {
    const trimmed = rawOutput.trim();
    return trimmed || `Completed: ${approval.title}`;
  }

  const params = approval.parameters as Record<string, unknown>;

  if (approval.service === "gmail") {
    switch (approval.action) {
      case "send": {
        const sendFields = extractGmailSendFields(params);
        if (sendFields) {
          return `Your email to ${sendFields.to} with subject "${sendFields.subject}" was sent successfully.`;
        }
        break;
      }
      case "delete":
        return "The email was deleted successfully.";
      case "archive":
      case "modify_labels":
        return "The email labels were updated successfully.";
      case "reply":
        return "Your reply was sent successfully.";
      case "forward":
        return "The email was forwarded successfully.";
      case "create_draft":
        return "Your draft was created successfully.";
      case "update_draft":
        return "Your draft was updated successfully.";
      case "search":
        return "Here are the emails I found for your search.";
      case "read":
        return "Here is the email you requested.";
    }
  }

  if (approval.service === "google_calendar") {
    switch (approval.action) {
      case "create": {
        const summary =
          typeof params.summary === "string" && params.summary.trim()
            ? params.summary
            : approval.title;
        return `Calendar event "${summary}" was created successfully.`;
      }
      case "delete":
        return "The calendar event was deleted successfully.";
      case "search":
        return "Here are the calendar events I found.";
      case "read":
        return "Here is the calendar event you requested.";
      case "check_availability":
        return "Here is your availability for the requested time range.";
    }
  }

  const withoutJson = stripTrailingJsonBlock(rawOutput);
  if (withoutJson && !looksLikeJson(withoutJson)) {
    return withoutJson;
  }

  return `Completed: ${approval.title}`;
}
