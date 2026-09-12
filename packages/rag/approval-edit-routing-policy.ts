import type { RequestDeterminationModelType } from "@repo/rag-models/determiner.model";
import type { ThreadContextMessageModelType } from "@repo/rag-models/context.model";

const APPROVAL_LINK_RE = /\/approval\/([0-9a-f-]{36})/gi;

const EDIT_APPROVAL_PATTERNS = [
  /\b(edit|update|change|modify)\b.*\b(approval|pending email|email draft)\b/i,
  /\b(edit the approval)\b/i,
  /\b(add|include|put)\b.*\b(my )?(address|email|signature|contact)\b.*\b(approval|email|draft)\b/i,
  /\b(approval)\b.*\b(add|include|update|change)\b/i,
];

/** True when the user likely wants to edit a pending approval from chat. */
export function looksLikeEditApprovalRequest(prompt: string): boolean {
  return EDIT_APPROVAL_PATTERNS.some((pattern) => pattern.test(prompt));
}

export function extractApprovalIdsFromText(text: string): string[] {
  return [...new Set([...text.matchAll(APPROVAL_LINK_RE)].map((match) => match[1]!))];
}

export function recentApprovalIdsFromHistory(history: ThreadContextMessageModelType[]): string[] {
  const ids: string[] = [];
  for (const message of [...history].reverse()) {
    if (message.role !== "assistant") continue;
    for (const id of extractApprovalIdsFromText(message.content)) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** Prefer edit-approval routing over Corsair when the thread mentions pending approvals. */
export function resolveEditApprovalWithoutCorsair(
  prompt: string,
  history: ThreadContextMessageModelType[],
  determination: RequestDeterminationModelType,
): RequestDeterminationModelType {
  if (determination.requiresEditPendingApproval) {
    return {
      ...determination,
      requiresCorsairMcpTool: false,
      requiresEmailWriterAgent: false,
    };
  }

  if (!looksLikeEditApprovalRequest(prompt)) return determination;

  const hasApprovalContext =
    recentApprovalIdsFromHistory(history).length > 0 ||
    /\bapproval\b/i.test(history.slice(-4).map((m) => m.content).join("\n"));

  if (!hasApprovalContext) return determination;

  return {
    ...determination,
    requiresEditPendingApproval: true,
    requiresCorsairMcpTool: false,
    requiresEmailWriterAgent: false,
    needsUserClarification: false,
    clarifyingQuestion: null,
    directResponse: null,
    reasoning: `${determination.reasoning} Routed to pending approval edit from chat context.`,
  };
}
