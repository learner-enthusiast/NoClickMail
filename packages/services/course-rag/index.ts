import { logger } from "@repo/logger";
import { env } from "../env";
import PineconeVectorStore from "../pinecone";
import { parseTranscriptFile } from "./parse";
import { ingestFromInput, ingestSubtitleDirectory } from "./ingest-worker";
import { resolveCourseRagDir } from "./paths";
import { rewriteUserPrompt } from "./prompt-rewriter";
import { runCourseAsk } from "./ask-worker";
import type {
  CourseAskInputModelType,
  CourseAskResultModelType,
  IngestDirectoryResultModelType,
  IngestTranscriptInputModelType,
  IngestTranscriptResultModelType,
  RewritePromptInputModelType,
  RewritePromptResultModelType,
  TranscriptFormatModelType,
  TranscriptSegmentModelType,
} from "./model";

/**
 * Advanced RAG for Udemy course transcripts (VTT / SRT).
 */
class CourseRagService {
  private readonly vectors = new PineconeVectorStore({
    apiKey: env.COURSE_PINECONE_API_KEY,
    index: env.COURSE_PINECONE_INDEX,
  });

  getCourseRagDir(): string {
    return resolveCourseRagDir();
  }

  /** Whether Pinecone course index is configured. */
  isConfigured(): boolean {
    return this.vectors.isConfigured();
  }

  parseTranscript(
    content: string,
    format: TranscriptFormatModelType,
    sourceFile?: string,
  ): TranscriptSegmentModelType[] {
    return parseTranscriptFile(content, format, sourceFile);
  }

  async ingestTranscript(
    input: IngestTranscriptInputModelType,
  ): Promise<IngestTranscriptResultModelType> {
    return ingestFromInput(this.vectors, input);
  }

  /**
   * Scan class_subtitle folder and embed new/changed VTT/SRT files into Pinecone.
   * Skips unchanged files using a local manifest (.ingest-manifest.<courseId>.json).
   */
  async ingestSubtitleDirectory(opts?: {
    courseId?: string;
    subtitleRoot?: string;
    force?: boolean;
  }): Promise<IngestDirectoryResultModelType> {
    const courseId = opts?.courseId ?? env.COURSE_RAG_COURSE_ID;

    return ingestSubtitleDirectory({
      courseId,
      vectors: this.vectors,
      subtitleRoot: opts?.subtitleRoot ?? env.COURSE_RAG_SUBTITLE_ROOT,
      courseRagDir: resolveCourseRagDir(),
      force: opts?.force,
    });
  }

  /**
   * Rewrite a user question three ways for advanced RAG:
   * step-back, retrieval-optimized rewrite, and sub-questions.
   */
  async rewritePrompt(input: RewritePromptInputModelType): Promise<RewritePromptResultModelType> {
    logger.info("course-rag rewrite prompt", { questionLength: input.question.length });
    return rewriteUserPrompt(input);
  }

  async ask(input: CourseAskInputModelType): Promise<CourseAskResultModelType> {
    logger.info("course-rag ask", {
      courseId: input.courseId,
      questionLength: input.question.length,
      topK: input.topK ?? 5,
    });

    return runCourseAsk({
      courseId: input.courseId,
      question: input.question,
      topK: input.topK,
      vectors: this.vectors,
    });
  }
}

export default CourseRagService;
