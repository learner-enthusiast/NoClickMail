import { TRPCError } from "@trpc/server";
import { corsairApprovalService, ragService, CorsairAgent } from "../../services";
import { formatApprovalCreatedMessage } from "@repo/services/corsair-approvals";
import type { RagRunResultModelType } from "@repo/services/rag/pipeline.model";

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

async function* runDirectOrClarifyRoute(
  rag: RagRunResultModelType,
): AsyncGenerator<RunAgentStreamDelta, RunAgentExecution> {
  const output = rag.assistantMessage ?? "";
  if (output) yield { type: "delta", text: output };
  return { output };
}

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

async function* runCorsairRoute(
  input: RunRagPipelineInput,
): AsyncGenerator<RunAgentStreamEvent, RunAgentExecution> {
  const { planned, requiresApproval } = await corsairApprovalService.planFromRag({
    prompt: input.prompt,
    rag: input.rag,
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
        rag: input.rag,
        planned,
      }),
    });

    const output = formatApprovalCreatedMessage(approval.id);
    yield { type: "approval_created", approvalId: approval.id };
    yield { type: "delta", text: output };
    return { output, approvalId: approval.id };
  }

  const agent = new CorsairAgent(input.userId);
  let output = "";
  for await (const delta of agent.executePromptStream(
    input.prompt,
    input.rag.history,
    input.signal,
    { enhancedPrompt: input.rag.enhancedPrompt, retrieved: input.rag.retrieved },
  )) {
    output += delta;
    yield { type: "delta", text: delta };
  }
  return { output };
}

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

  return yield* runAssistantReplyRoute(rag, input.signal);
}

export async function* executeAgentTurn(
  input: RunRagPipelineInput,
): AsyncGenerator<RunAgentStreamEvent, RunAgentExecution> {
  try {
    return yield* runRagPipeline(input);
  } catch (e) {
    rethrowAbortError(e);
  }
}
