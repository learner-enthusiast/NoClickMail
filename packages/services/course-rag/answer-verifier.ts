import { env } from "../env";
import { buildContextBlock, type RetrievedCourseChunk } from "./retrieve";
import type { GeneratedAnswer } from "./answer-generator";

type ChatCompletionResponse = {
  choices?: { message?: { content?: string } }[];
};

export type VerificationResult = {
  rank: number;
  reason: string;
  passes: boolean;
};

const VERIFIER_SYSTEM = `You verify course RAG answers for quality and grounding.

Score the answer from 1–10:
- 10: Fully grounded, accurate, timestamps correct, directly answers the question
- 7–9: Good answer with minor gaps
- 5–6: Partially correct but missing key details or weak timestamps
- 1–4: Hallucinated, off-topic, wrong timestamps, or poorly explained

Check:
1. Is the answer supported by the transcript excerpts?
2. Are timestamps plausible and relevant?
3. Does it address the user's question?

Respond JSON only:
{
  "rank": 8,
  "reason": "Brief justification",
  "passes": true
}

Set passes=true when rank >= 5.`;

export async function verifyCourseAnswer(input: {
  question: string;
  chunks: RetrievedCourseChunk[];
  generated: GeneratedAnswer;
}): Promise<VerificationResult> {
  const context = buildContextBlock(input.chunks);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VERIFIER_SYSTEM },
        {
          role: "user",
          content: [
            `User question:\n${input.question}`,
            `\nTranscript excerpts:\n${context}`,
            `\nGenerated answer:\n${input.generated.answer}`,
            `\nClaimed timestamps:\n${JSON.stringify(input.generated.timestamps, null, 2)}`,
            `\nTaught in course: ${input.generated.taughtInCourse}`,
          ].join("\n"),
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Answer verification failed: ${res.status} ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as ChatCompletionResponse;
  const raw = json.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("Answer verification returned empty response");

  const parsed = JSON.parse(raw) as VerificationResult;
  const rank = Math.min(10, Math.max(1, Math.round(Number(parsed.rank) || 1)));

  return {
    rank,
    reason: parsed.reason?.trim() ?? "",
    passes: rank >= 5,
  };
}
