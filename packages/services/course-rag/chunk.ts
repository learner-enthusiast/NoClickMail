import { env } from "../env";
import type { TranscriptSegmentModelType } from "./model";

export type CourseChunkModelType = {
  chunkIndex: number;
  text: string;
  startMs: number;
  endMs: number;
};

/** Group timed cues into embedding-sized chunks while preserving timestamps. */
export function chunkSegments(
  segments: TranscriptSegmentModelType[],
  opts?: { maxChars?: number; overlapSegments?: number },
): CourseChunkModelType[] {
  if (segments.length === 0) return [];

  const maxChars = opts?.maxChars ?? env.RAG_CHUNK_SIZE;
  const overlapSegments = opts?.overlapSegments ?? 2;
  const chunks: CourseChunkModelType[] = [];

  let start = 0;
  while (start < segments.length) {
    const parts: TranscriptSegmentModelType[] = [];
    let charCount = 0;
    let i = start;

    while (i < segments.length) {
      const seg = segments[i]!;
      const nextLen = charCount + (charCount > 0 ? 1 : 0) + seg.text.length;
      if (parts.length > 0 && nextLen > maxChars) break;
      parts.push(seg);
      charCount = nextLen;
      i++;
    }

    if (parts.length === 0) break;

    chunks.push({
      chunkIndex: chunks.length,
      text: parts.map((p) => p.text).join(" "),
      startMs: parts[0]!.startMs,
      endMs: parts[parts.length - 1]!.endMs,
    });

    if (i >= segments.length) break;
    start = Math.max(start + 1, i - overlapSegments);
  }

  return chunks;
}
