import { env } from "../env";
import type { RewritePromptInputModelType, RewritePromptResultModelType } from "./model";

type ChatCompletionResponse = {
  choices?: { message?: { content?: string } }[];
};

type LlmRewritePayload = {
  stepBack: string;
  rewritten: string;
  subQuestions: string[];
};

const DEFAULT_COURSE_CONTEXT =
  "A Udemy course on React Native and Expo (navigation, APIs, sensors, maps, notifications, etc.)";

const SYSTEM_PROMPT = `You rewrite user questions for a course transcript RAG system.

Given a user question about lecture content, produce exactly three transformations:

1. stepBack — Step-back prompting: a broader, conceptual question that situates the specific ask.
   Focus on underlying principles, definitions, or module-level topics the course would cover.
   Example: for "How do I use expo-router tabs?" → "What are the core navigation patterns and routing concepts in Expo Router?"

2. rewritten — A clear, grammatically correct, standalone question optimized for semantic search over lecture transcripts.
   Fix typos, remove filler, keep intent. One focused question, under 40 words.

3. subQuestions — Break the original ask into 2–5 smaller, concrete sub-questions that together cover the full intent.
   Each sub-question should be searchable on its own.

Respond with JSON only:
{
  "stepBack": "...",
  "rewritten": "...",
  "subQuestions": ["...", "..."]
}`;

async function callRewriteLlm(
  question: string,
  courseContext: string,
  signal?: AbortSignal,
): Promise<LlmRewritePayload> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Course context: ${courseContext}\n\nUser question:\n${question}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Prompt rewrite failed: ${res.status} ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as ChatCompletionResponse;
  const raw = json.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("Prompt rewrite returned empty response");

  const parsed = JSON.parse(raw) as LlmRewritePayload;
  if (!parsed.stepBack || !parsed.rewritten || !Array.isArray(parsed.subQuestions)) {
    throw new Error("Prompt rewrite returned invalid JSON shape");
  }

  const subQuestions = parsed.subQuestions.map((q) => q.trim()).filter(Boolean);
  if (subQuestions.length === 0) {
    throw new Error("Prompt rewrite returned no sub-questions");
  }

  return {
    stepBack: parsed.stepBack.trim(),
    rewritten: parsed.rewritten.trim(),
    subQuestions,
  };
}

/** Deterministic fallback when the LLM call fails. */
function buildFallbackRewrite(question: string): LlmRewritePayload {
  const trimmed = question.trim().replace(/\s+/g, " ");
  const cap = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const withQuestionMark = cap.endsWith("?") ? cap : `${cap}?`;

  return {
    stepBack: `What are the core concepts and fundamentals related to: ${withQuestionMark}`,
    rewritten: withQuestionMark,
    subQuestions: [
      withQuestionMark,
      `What does the course explain about ${trimmed.replace(/\?+$/, "")}?`,
      `Which module or lecture covers ${trimmed.replace(/\?+$/, "")}?`,
    ],
  };
}

/**
 * Advanced RAG prompt rewriting — three strategies in one pass:
 * 1. Step-back prompting (broader conceptual question)
 * 2. Proper rewrite (retrieval-optimized)
 * 3. Sub-questions (decomposed multi-query)
 */
export async function rewriteUserPrompt(
  input: RewritePromptInputModelType,
  signal?: AbortSignal,
): Promise<RewritePromptResultModelType> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const courseContext = input.courseContext ?? DEFAULT_COURSE_CONTEXT;
  const original = input.question.trim();

  let payload: LlmRewritePayload;
  try {
    payload = await callRewriteLlm(original, courseContext, signal);
  } catch {
    payload = buildFallbackRewrite(original);
  }

  return {
    original,
    stepBack: payload.stepBack,
    rewritten: payload.rewritten,
    subQuestions: payload.subQuestions,
    ranAt: new Date().toISOString(),
  };
}
