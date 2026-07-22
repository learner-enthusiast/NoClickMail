import { env } from "../env";
import { buildContextBlock, type RetrievedCourseChunk } from "./retrieve";

type ChatCompletionResponse = {
  choices?: { message?: { content?: string } }[];
};

export type GeneratedAnswer = {
  taughtInCourse: boolean;
  answer: string;
  timestamps: Array<{
    moduleId: string;
    lectureId: string;
    sourceFile: string;
    startMs: number;
    endMs: number;
    label: string;
  }>;
};

const GENERATOR_SYSTEM = `You are a Udemy course tutor. Answer ONLY from the provided lecture transcript excerpts.

Rules:
- If the excerpts do not cover the user's question, set taughtInCourse=false and explain the topic is not covered in the indexed course material.
- If covered, set taughtInCourse=true and write a clear explanation synthesizing the excerpts.
- Include precise timestamps (from the excerpts) where the topic is taught.
- Do not invent content outside the excerpts.

Respond JSON only:
{
  "taughtInCourse": true,
  "answer": "Clear explanation for the student...",
  "timestamps": [
    {
      "moduleId": "module 4",
      "lectureId": "module 4/...",
      "sourceFile": "lecture.vtt",
      "startMs": 12000,
      "endMs": 45000,
      "label": "Short label of what is taught at this timestamp"
    }
  ]
}`;

export async function generateCourseAnswer(input: {
  question: string;
  chunks: RetrievedCourseChunk[];
  retryFeedback?: string;
}): Promise<GeneratedAnswer> {
  const context = buildContextBlock(input.chunks);
  const feedbackBlock = input.retryFeedback
    ? `\n\nPrevious attempt feedback (improve this):\n${input.retryFeedback}`
    : "";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: GENERATOR_SYSTEM },
        {
          role: "user",
          content: `User question:\n${input.question}\n\nTranscript excerpts:\n${context || "(none retrieved)"}${feedbackBlock}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Answer generation failed: ${res.status} ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as ChatCompletionResponse;
  const raw = json.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("Answer generation returned empty response");

  const parsed = JSON.parse(raw) as GeneratedAnswer;
  return {
    taughtInCourse: Boolean(parsed.taughtInCourse),
    answer: parsed.answer?.trim() ?? "",
    timestamps: Array.isArray(parsed.timestamps) ? parsed.timestamps : [],
  };
}
