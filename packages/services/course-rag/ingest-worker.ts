import type { RecordMetadata } from "@pinecone-database/pinecone";
import { readFileSync, statSync } from "node:fs";
import { logger } from "@repo/logger";
import EmbeddingService from "../embeddings";
import PineconeVectorStore from "../pinecone";
import { chunkSegments } from "./chunk";
import {
  defaultManifestPath,
  hashFileContent,
  loadManifest,
  saveManifest,
  shouldIngestFile,
  vectorIdForChunk,
} from "./manifest";
import type {
  CourseVectorMetadataModelType,
  IngestDirectoryResultModelType,
  IngestTranscriptInputModelType,
  IngestTranscriptResultModelType,
} from "./model";
import { parseTranscriptFile } from "./parse";
import type { DiscoveredTranscript } from "./scan";
import { discoverTranscripts, findDefaultSubtitleRoot } from "./scan";

const embeddings = new EmbeddingService();

export type IngestOneFileInput = {
  courseId: string;
  vectors: PineconeVectorStore;
  file: DiscoveredTranscript;
  force?: boolean;
  manifestPath: string;
};

export async function ingestOneTranscriptFile(
  input: IngestOneFileInput,
): Promise<IngestTranscriptResultModelType & { relativePath: string; skipped?: boolean }> {
  const content = readFileSync(input.file.absolutePath, "utf8");
  const contentHash = hashFileContent(content);
  const mtimeMs = statSync(input.file.absolutePath).mtimeMs;

  const manifest = loadManifest(input.manifestPath, input.courseId);

  if (
    !shouldIngestFile({
      relativePath: input.file.relativePath,
      contentHash,
      mtimeMs,
      manifest,
      force: input.force,
    })
  ) {
    const existing = manifest.files[input.file.relativePath]!;
    return {
      relativePath: input.file.relativePath,
      skipped: true,
      courseId: input.courseId,
      lectureId: input.file.lectureId,
      segmentCount: existing.segmentCount,
      chunkCount: existing.chunkCount,
      vectorIds: existing.vectorIds,
    };
  }

  const result = await ingestTranscriptContent({
    courseId: input.courseId,
    vectors: input.vectors,
    file: input.file,
    content,
  });

  const previous = manifest.files[input.file.relativePath];
  if (previous) {
    const staleIds = previous.vectorIds.filter((id) => !result.vectorIds.includes(id));
    if (staleIds.length > 0) {
      await input.vectors.deleteByIds(input.courseId, staleIds);
    }
  }

  manifest.files[input.file.relativePath] = {
    contentHash,
    mtimeMs,
    segmentCount: result.segmentCount,
    chunkCount: result.chunkCount,
    vectorIds: result.vectorIds,
    ingestedAt: new Date().toISOString(),
  };
  saveManifest(input.manifestPath, manifest);

  return { ...result, relativePath: input.file.relativePath };
}

export async function ingestTranscriptContent(input: {
  courseId: string;
  vectors: PineconeVectorStore;
  file: DiscoveredTranscript;
  content: string;
}): Promise<IngestTranscriptResultModelType> {
  const segments = parseTranscriptFile(input.content, input.file.format, input.file.fileName);
  const chunks = chunkSegments(segments);

  if (chunks.length === 0) {
    return {
      courseId: input.courseId,
      lectureId: input.file.lectureId,
      segmentCount: segments.length,
      chunkCount: 0,
      vectorIds: [],
    };
  }

  const ingestedAt = new Date().toISOString();
  const vectors = await embeddings.embed(chunks.map((c) => c.text));

  const records = chunks.map((chunk, i) => {
    const metadata: CourseVectorMetadataModelType = {
      courseId: input.courseId,
      moduleId: input.file.moduleId,
      lectureId: input.file.lectureId,
      sourceFile: input.file.fileName,
      format: input.file.format,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      startMs: chunk.startMs,
      endMs: chunk.endMs,
      ingestedAt,
    };

    return {
      id: vectorIdForChunk(input.file.relativePath, chunk.chunkIndex),
      values: vectors[i]!,
      metadata: metadata as unknown as RecordMetadata,
    };
  });

  await input.vectors.upsertRecords(
    input.courseId,
    records.map((r) => ({
      id: r.id,
      values: r.values,
      metadata: r.metadata,
    })),
  );

  logger.info("course-rag file ingested", {
    courseId: input.courseId,
    lectureId: input.file.lectureId,
    segments: segments.length,
    chunks: chunks.length,
  });

  return {
    courseId: input.courseId,
    lectureId: input.file.lectureId,
    segmentCount: segments.length,
    chunkCount: chunks.length,
    vectorIds: records.map((r) => r.id),
  };
}

/** Legacy API — ingest from raw string content. */
export async function ingestFromInput(
  vectors: PineconeVectorStore,
  input: IngestTranscriptInputModelType,
): Promise<IngestTranscriptResultModelType> {
  const file: DiscoveredTranscript = {
    absolutePath: input.fileName,
    relativePath: `${input.lectureId}/${input.fileName}`,
    format: input.format,
    moduleId: input.lectureId.split("/")[0] ?? "unknown-module",
    lectureId: input.lectureId,
    fileName: input.fileName,
  };

  return ingestTranscriptContent({
    courseId: input.courseId,
    vectors,
    file,
    content: input.content,
  });
}

export async function ingestSubtitleDirectory(input: {
  courseId: string;
  vectors: PineconeVectorStore;
  subtitleRoot?: string;
  courseRagDir: string;
  force?: boolean;
}): Promise<IngestDirectoryResultModelType> {
  if (!input.vectors.isConfigured()) {
    throw new Error("Course Pinecone is not configured (COURSE_PINECONE_API_KEY / COURSE_PINECONE_INDEX)");
  }

  const subtitleRoot =
    input.subtitleRoot ?? findDefaultSubtitleRoot(input.courseRagDir) ?? undefined;

  if (!subtitleRoot) {
    throw new Error(
      "No subtitle directory found. Add class_subtitle_*/class-subtitle or set COURSE_RAG_SUBTITLE_ROOT",
    );
  }

  const manifestPath = defaultManifestPath(input.courseRagDir, input.courseId);
  const files = discoverTranscripts(subtitleRoot);

  logger.info("course-rag scan complete", {
    subtitleRoot,
    fileCount: files.length,
    courseId: input.courseId,
  });

  const results: IngestDirectoryResultModelType["files"] = [];
  let ingested = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const result = await ingestOneTranscriptFile({
        courseId: input.courseId,
        vectors: input.vectors,
        file,
        force: input.force,
        manifestPath,
      });

      if (result.skipped) {
        skipped++;
        results.push({ relativePath: result.relativePath, status: "skipped", chunkCount: result.chunkCount });
      } else {
        ingested++;
        results.push({
          relativePath: result.relativePath,
          status: "ingested",
          chunkCount: result.chunkCount,
        });
      }
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.error("course-rag ingest failed", { file: file.relativePath, error: message });
      results.push({ relativePath: file.relativePath, status: "failed", error: message });
    }
  }

  return {
    courseId: input.courseId,
    scanned: files.length,
    ingested,
    skipped,
    failed,
    files: results,
  };
}
