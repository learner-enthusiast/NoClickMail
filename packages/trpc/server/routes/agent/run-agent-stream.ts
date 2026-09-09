import { TRPCError } from "@trpc/server";
import { corsairApprovalService, ragService, CorsairAgent } from "../../services";
import { formatApprovalCreatedMessage } from "@repo/services";
import type { RagRunResultModelType } from "@repo/services/model";

type RunAgentStreamDelta = { type: "delta"; text: string };
type RunAgentStreamApproval = { type: "approval_created"; approvalId: string };
export type RunAgentStreamEvent = RunAgentStreamDelta | RunAgentStreamApproval;

type RunAgentExecution = {
  output: string;
  approvalId?: string;
};

type RunRagPipelineInput = {
  userId: string;
  prompt: string;
  threadId: string;
  messageId: string;
  rag: RagRunResultModelType;
  signal: AbortSignal;
};

function rethrowAbortError(e: unknown): never {
  if (e instanceof DOMException && e.name === "AbortError") {
    throw new TRPCError({ code: "CLIENT_CLOSED_REQUEST", message: "Request aborted" });
  }
  throw e;
}

/** Inject email writer draft into the enhanced prompt for Corsair planning/execution. */
function withEmailDraft(enhancedPrompt: string, emailDraft: string): string {
  return [
    enhancedPrompt,
    "",
    "---",
    "Email draft from Orion writer (use for send/reply unless the user overrides):",
    emailDraft,
    "---",
  ].join("\n");
}

async function createEmailDraft(rag: RagRunResultModelType, prompt: string, signal: AbortSignal) {
  return ragService.generateEmailDraft(
    {
      prompt,
      enhancedPrompt: rag.enhancedPrompt,
      history: rag.history,
      retrieved: rag.retrieved,
      longTermMemories: rag.longTermMemories,
    },
    signal,
  );
}

/** Stream pre-built clarify/direct replies from the determiner. */
async function* runDirectOrClarifyRoute(
  rag: RagRunResultModelType,
): AsyncGenerator<RunAgentStreamDelta, RunAgentExecution> {
  const output = rag.assistantMessage ?? "";
  if (output) yield { type: "delta", text: output };
  return { output };
}

/** Stream a general assistant reply (no Corsair, no email writer). */
async function* runAssistantReplyRoute(
  rag: RagRunResultModelType,
  signal: AbortSignal,
): AsyncGenerator<RunAgentStreamDelta, RunAgentExecution> {
  const output = await ragService.generateAssistantReply(
    {
      prompt: rag.enhancedPrompt,
      history: rag.history,
      longTermMemories: rag.longTermMemories,
    },
    signal,
  );
  if (output) yield { type: "delta", text: output };
  return { output };
}

/** Stream polished email copy only (no Gmail/Calendar actions). */
async function* runEmailWriterRoute(
  input: RunRagPipelineInput,
): AsyncGenerator<RunAgentStreamDelta, RunAgentExecution> {
  const output = await createEmailDraft(input.rag, input.prompt, input.signal);
  if (output) yield { type: "delta", text: output };
  return { output };
}

/** Stream Corsair Gmail/Calendar actions; optionally prepends email writer draft. */
async function* runCorsairRoute(
  input: RunRagPipelineInput,
): AsyncGenerator<RunAgentStreamEvent, RunAgentExecution> {
  let ragForExecution = input.rag;
  let emailDraft: string | undefined;

  if (input.rag.runEmailWriterAgent) {
    emailDraft = await createEmailDraft(input.rag, input.prompt, input.signal);
    ragForExecution = {
      ...input.rag,
      enhancedPrompt: withEmailDraft(input.rag.enhancedPrompt, emailDraft),
    };
  }

  const { planned, requiresApproval } = await corsairApprovalService.planFromRag({
    prompt: input.prompt,
    rag: ragForExecution,
    signal: input.signal,
  });

  if (requiresApproval) {
    const approval = await corsairApprovalService.createFromPlanned({
      userId: input.userId,
      planned,
      parameters: corsairApprovalService.buildParametersForRag({
        prompt: input.prompt,
        threadId: input.threadId,
        messageId: input.messageId,
        rag: ragForExecution,
        planned,
      }),
    });

    const approvalMessage = formatApprovalCreatedMessage(approval.id);
    const output = emailDraft ? `${emailDraft}\n\n---\n\n${approvalMessage}` : approvalMessage;
    yield { type: "approval_created", approvalId: approval.id };
    yield { type: "delta", text: output };
    return { output, approvalId: approval.id };
  }

  const agent = new CorsairAgent(input.userId);
  let output = "";

  if (emailDraft) {
    const draftBlock = `${emailDraft}\n\n---\n\n`;
    output += draftBlock;
    yield { type: "delta", text: draftBlock };
  }

  for await (const delta of agent.executePromptStream(
    input.prompt,
    input.rag.history,
    input.signal,
    { enhancedPrompt: ragForExecution.enhancedPrompt, retrieved: input.rag.retrieved },
  )) {
    output += delta;
    yield { type: "delta", text: delta };
  }

  return { output };
}

/**
 * Pick execution strategy from RAG flags and stream the assistant response.
 *
 * Order: clarify/direct → Corsair → email writer → general assistant.
 */
export async function* runRagPipeline(
  input: RunRagPipelineInput,
): AsyncGenerator<RunAgentStreamEvent, RunAgentExecution> {
  const { rag } = input;

  if (rag.route === "clarify" || rag.route === "direct") {
    return yield* runDirectOrClarifyRoute(rag);
  }

  if (rag.runCorsairAgent) {
    return yield* runCorsairRoute(input);
  }

  if (rag.runEmailWriterAgent) {
    return yield* runEmailWriterRoute(input);
  }

  return yield* runAssistantReplyRoute(rag, input.signal);
}

/** Entry point from agentsRouter — streams deltas then returns final output. */
export async function* streamAgentResponseForRagResult(
  input: RunRagPipelineInput,
): AsyncGenerator<RunAgentStreamEvent, RunAgentExecution> {
  try {
    return yield* runRagPipeline(input);
  } catch (e) {
    rethrowAbortError(e);
  }
}
