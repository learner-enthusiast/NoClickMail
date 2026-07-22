import EmbeddingService from "../embeddings";
import PineconeVectorStore from "../pinecone";
import { rewriteUserPrompt } from "./prompt-rewriter";
import type { CourseCitationModelType, CourseVectorMetadataModelType } from "./model";

const embeddings = new EmbeddingService();

export type RetrievedCourseChunk = CourseCitationModelType & {
  moduleId: string;
};

function toChunk(
  id: string,
  score: number,
  meta: Record<string, unknown>,
): RetrievedCourseChunk | null {
  if (typeof meta.text !== "string") return null;

  return {
    id,
    score,
    text: meta.text,
    lectureId: String(meta.lectureId ?? ""),
    sourceFile: meta.sourceFile ? String(meta.sourceFile) : undefined,
    startMs: meta.startMs != null ? Number(meta.startMs) : undefined,
    endMs: meta.endMs != null ? Number(meta.endMs) : undefined,
    moduleId: String(meta.moduleId ?? "unknown"),
  };
}

/** Multi-query retrieve: rewrite prompts → embed → Pinecone → dedupe → top-K. */
export async function retrieveCourseChunks(input: {
  courseId: string;
  question: string;
  vectors: PineconeVectorStore;
  topK?: number;
  courseContext?: string;
}): Promise<{ rewrite: Awaited<ReturnType<typeof rewriteUserPrompt>>; chunks: RetrievedCourseChunk[] }> {
  const topK = input.topK ?? 5;

  const rewrite = await rewriteUserPrompt({
    question: input.question,
    courseContext: input.courseContext,
  });

  const queries = [
    rewrite.rewritten,
    rewrite.stepBack,
    ...rewrite.subQuestions,
  ].filter((q, i, arr) => arr.indexOf(q) === i);

  const queryVectors = await embeddings.embed(queries);
  const byId = new Map<string, RetrievedCourseChunk>();

  for (let i = 0; i < queries.length; i++) {
    const vector = queryVectors[i]!;
    const matches = await input.vectors.queryRecords(input.courseId, vector, topK);

    for (const match of matches) {
      const chunk = toChunk(match.id, match.score, match.metadata as Record<string, unknown>);
      if (!chunk) continue;

      const existing = byId.get(chunk.id);
      if (!existing || chunk.score > existing.score) {
        byId.set(chunk.id, chunk);
      }
    }
  }

  const chunks = [...byId.values()].sort((a, b) => b.score - a.score).slice(0, topK);

  return { rewrite, chunks };
}

export function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function buildContextBlock(chunks: RetrievedCourseChunk[]): string {
  return chunks
    .map((c, i) => {
      const start = c.startMs != null ? formatMs(c.startMs) : "?";
      const end = c.endMs != null ? formatMs(c.endMs) : "?";
      return [
        `[${i + 1}] score=${c.score.toFixed(3)}`,
        `module=${c.moduleId}`,
        `lecture=${c.lectureId}`,
        `time=${start}–${end}`,
        `file=${c.sourceFile ?? "unknown"}`,
        `text=${c.text}`,
      ].join("\n");
    })
    .join("\n\n");
}

export type { CourseVectorMetadataModelType };
