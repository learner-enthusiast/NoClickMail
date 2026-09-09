import type { RequestDeterminationModelType } from "@repo/rag-models/determiner.model";
import type { ThreadContextMessageModelType } from "@repo/rag-models/context.model";

/** Thread contains an uploaded file (current turn or earlier in conversation). */
export function threadHasUploadedDocument(
  prompt: string,
  history: ThreadContextMessageModelType[],
): boolean {
  return (
    /--- Attached file:|--- End attached file ---|📎/i.test(prompt) ||
    history.some((m) => /📎|--- Attached file:/i.test(m.content))
  );
}

const UNCERTAIN_REASONING =
  /\b(not sure|unsure|unclear|ambiguous|may refer|might refer|cannot tell|can't tell|don't know if|uncertain|possibly|might be in)\b/i;

/**
 * When the determiner is confused about where an answer lives, prefer searching indexed
 * document/context chunks instead of asking the user to clarify.
 */
export function resolvePgVectorWhenUnsure(
  prompt: string,
  history: ThreadContextMessageModelType[],
  determination: RequestDeterminationModelType,
): RequestDeterminationModelType {
  const hasDocument = threadHasUploadedDocument(prompt, history);
  const looksUncertain =
    determination.needsUserClarification || UNCERTAIN_REASONING.test(determination.reasoning);

  const shouldSearchInsteadOfClarify =
    looksUncertain &&
    !determination.requiresCorsairMcpTool &&
    (hasDocument || !determination.requiresPgVectorRetrieval);

  if (!shouldSearchInsteadOfClarify) return determination;

  return {
    ...determination,
    needsUserClarification: false,
    clarifyingQuestion: null,
    requiresPgVectorRetrieval: true,
    requiresExternalEnhancement: true,
    directResponse: null,
  };
}
