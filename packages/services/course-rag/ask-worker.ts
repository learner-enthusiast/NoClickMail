import { logger } from "@repo/logger";
import PineconeVectorStore from "../pinecone";
import { generateCourseAnswer, type GeneratedAnswer } from "./answer-generator";
import { verifyCourseAnswer } from "./answer-verifier";
import type { CourseAskInputModelType, CourseAskResultModelType } from "./model";
import { formatMs, retrieveCourseChunks } from "./retrieve";

const MAX_ATTEMPTS = 3;
const MIN_RANK = 5;
const DEFAULT_TOP_K = 5;

function appendTimestampsToAnswer(
  answer: string,
  timestamps: GeneratedAnswer["timestamps"],
): string {
  if (timestamps.length === 0) return answer;

  const lines = timestamps.map((t) => {
    const start = formatMs(t.startMs);
    const end = formatMs(t.endMs);
    return `- **${t.moduleId}** · ${t.label} · ${start}–${end} · ${t.sourceFile}`;
  });

  return `${answer}\n\n**Where it's taught:**\n${lines.join("\n")}`;
}

export async function runCourseAsk(input: {
  courseId: string;
  question: string;
  topK?: number;
  vectors: PineconeVectorStore;
  courseContext?: string;
}): Promise<CourseAskResultModelType> {
  const ranAt = new Date().toISOString();
  const topK = input.topK ?? DEFAULT_TOP_K;

  if (!input.vectors.isConfigured()) {
    return {
      answer:
        "Course vector store is not configured. Set COURSE_PINECONE_API_KEY and COURSE_PINECONE_INDEX, then run `pnpm course-rag:ingest`.",
      citations: [],
      meta: {
        courseId: input.courseId,
        topK,
        matchCount: 0,
        ranAt,
        ragReady: false,
        attempts: 0,
      },
    };
  }

  let lastResult: CourseAskResultModelType | null = null;
  let retryFeedback: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    logger.info("course-rag ask attempt", { attempt, courseId: input.courseId });

    const { rewrite, chunks } = await retrieveCourseChunks({
      courseId: input.courseId,
      question: input.question,
      vectors: input.vectors,
      topK,
      courseContext: input.courseContext,
    });

    const generated = await generateCourseAnswer({
      question: input.question,
      chunks,
      retryFeedback,
    });

    const citations = chunks.map((c) => ({
      id: c.id,
      score: c.score,
      text: c.text,
      lectureId: c.lectureId,
      sourceFile: c.sourceFile,
      startMs: c.startMs,
      endMs: c.endMs,
    }));

    if (!generated.taughtInCourse) {
      return {
        answer:
          generated.answer ||
          "This topic does not appear to be covered in the indexed course transcripts.",
        citations,
        meta: {
          courseId: input.courseId,
          topK,
          matchCount: chunks.length,
          ranAt,
          ragReady: true,
          taughtInCourse: false,
          attempts: attempt,
          rewrite,
        },
      };
    }

    const verification = await verifyCourseAnswer({
      question: input.question,
      chunks,
      generated,
    });

    const answerWithTimestamps = appendTimestampsToAnswer(
      generated.answer,
      generated.timestamps,
    );

    lastResult = {
      answer: answerWithTimestamps,
      citations,
      meta: {
        courseId: input.courseId,
        topK,
        matchCount: chunks.length,
        ranAt,
        ragReady: true,
        taughtInCourse: true,
        qualityRank: verification.rank,
        qualityReason: verification.reason,
        attempts: attempt,
        rewrite,
      },
    };

    logger.info("course-rag verify result", {
      attempt,
      rank: verification.rank,
      passes: verification.passes,
    });

    if (verification.passes) {
      return lastResult;
    }

    if (attempt < MAX_ATTEMPTS) {
      retryFeedback = `Score ${verification.rank}/10 (need ≥${MIN_RANK}). ${verification.reason}`;
    }
  }

  return (
    lastResult ?? {
      answer: "Unable to generate a satisfactory answer after multiple attempts.",
      citations: [],
      meta: {
        courseId: input.courseId,
        topK,
        matchCount: 0,
        ranAt,
        ragReady: true,
        attempts: MAX_ATTEMPTS,
      },
    }
  );
}
