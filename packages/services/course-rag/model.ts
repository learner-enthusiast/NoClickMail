import { z } from "zod";

/** Supported transcript formats from Udemy course exports. */
export const transcriptFormatModel = z.enum(["vtt", "srt"]);
export type TranscriptFormatModelType = z.infer<typeof transcriptFormatModel>;

/** One parsed cue / segment from a VTT or SRT file. */
export const transcriptSegmentModel = z.object({
  index: z.number().int().nonnegative(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  text: z.string(),
  /** Optional lecture / file label (e.g. "01-intro.vtt"). */
  sourceFile: z.string().optional(),
});

export type TranscriptSegmentModelType = z.infer<typeof transcriptSegmentModel>;

/** Input for indexing a transcript file into the course vector store. */
export const ingestTranscriptInputModel = z.object({
  courseId: z.string().min(1),
  lectureId: z.string().min(1),
  fileName: z.string().min(1),
  format: transcriptFormatModel,
  /** Raw VTT or SRT file contents. */
  content: z.string().min(1),
});

export type IngestTranscriptInputModelType = z.infer<typeof ingestTranscriptInputModel>;

export const ingestTranscriptResultModel = z.object({
  courseId: z.string(),
  lectureId: z.string(),
  segmentCount: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
  vectorIds: z.array(z.string()),
});

export type IngestTranscriptResultModelType = z.infer<typeof ingestTranscriptResultModel>;

/** Retrieved chunk shown alongside an answer. */
export const courseCitationModel = z.object({
  id: z.string(),
  score: z.number(),
  text: z.string(),
  lectureId: z.string(),
  sourceFile: z.string().optional(),
  startMs: z.number().nonnegative().optional(),
  endMs: z.number().nonnegative().optional(),
});

export type CourseCitationModelType = z.infer<typeof courseCitationModel>;

/** Single public Q&A entry point for the course RAG assistant. */
export const courseAskInputModel = z.object({
  courseId: z.string().min(1).default("udemy-course"),
  question: z.string().min(1).max(4000),
  /** Override retrieve count (default handled by service). */
  topK: z.number().int().positive().max(20).optional(),
});

export type CourseAskInputModelType = z.infer<typeof courseAskInputModel>;

/** Input for advanced prompt rewriting before retrieval. */
export const rewritePromptInputModel = z.object({
  question: z.string().min(1).max(4000),
  courseContext: z.string().max(500).optional(),
});

export type RewritePromptInputModelType = z.infer<typeof rewritePromptInputModel>;

export const rewritePromptResultModel = z.object({
  original: z.string(),
  stepBack: z.string(),
  rewritten: z.string(),
  subQuestions: z.array(z.string()).min(1).max(8),
  ranAt: z.string(),
});

export type RewritePromptResultModelType = z.infer<typeof rewritePromptResultModel>;

export const courseAskMetaModel = z.object({
  courseId: z.string(),
  topK: z.number().int().positive(),
  matchCount: z.number().int().nonnegative(),
  ranAt: z.string(),
  ragReady: z.boolean(),
  taughtInCourse: z.boolean().optional(),
  qualityRank: z.number().min(1).max(10).optional(),
  qualityReason: z.string().optional(),
  attempts: z.number().int().nonnegative().optional(),
  rewrite: rewritePromptResultModel.optional(),
});

export type CourseAskMetaModelType = z.infer<typeof courseAskMetaModel>;

export const courseAskResultModel = z.object({
  answer: z.string(),
  citations: z.array(courseCitationModel),
  meta: courseAskMetaModel,
});

export type CourseAskResultModelType = z.infer<typeof courseAskResultModel>;

/** Metadata stored on each course transcript vector in Pinecone. */
export const courseVectorMetadataModel = z.object({
  courseId: z.string(),
  moduleId: z.string(),
  lectureId: z.string(),
  sourceFile: z.string(),
  format: transcriptFormatModel,
  chunkIndex: z.number().int().nonnegative(),
  text: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  ingestedAt: z.string(),
});

export type CourseVectorMetadataModelType = z.infer<typeof courseVectorMetadataModel>;

export const ingestManifestEntryModel = z.object({
  contentHash: z.string(),
  mtimeMs: z.number(),
  segmentCount: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
  vectorIds: z.array(z.string()),
  ingestedAt: z.string(),
});

export type IngestManifestEntryModelType = z.infer<typeof ingestManifestEntryModel>;

export const ingestManifestModel = z.object({
  version: z.literal(1),
  courseId: z.string(),
  files: z.record(z.string(), ingestManifestEntryModel),
});

export type IngestManifestModelType = z.infer<typeof ingestManifestModel>;

export const ingestDirectoryResultModel = z.object({
  courseId: z.string(),
  scanned: z.number().int().nonnegative(),
  ingested: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  files: z.array(
    z.object({
      relativePath: z.string(),
      status: z.enum(["ingested", "skipped", "failed"]),
      chunkCount: z.number().int().nonnegative().optional(),
      error: z.string().optional(),
    }),
  ),
});

export type IngestDirectoryResultModelType = z.infer<typeof ingestDirectoryResultModel>;
