import type { TranscriptFormatModelType, TranscriptSegmentModelType } from "./model";

function parseTimestampToMs(raw: string): number {
  const normalized = raw.trim().replace(",", ".");
  const [h, m, rest] = normalized.split(":");
  if (!h || !m || !rest) return 0;
  const [sec, ms = "0"] = rest.split(".");
  return (
    Number(h) * 3_600_000 +
    Number(m) * 60_000 +
    Number(sec) * 1_000 +
    Number(ms.padEnd(3, "0").slice(0, 3))
  );
}

function parseVtt(content: string, sourceFile?: string): TranscriptSegmentModelType[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const segments: TranscriptSegmentModelType[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]?.trim() ?? "";
    if (!line || line === "WEBVTT" || line.startsWith("NOTE") || /^\d+$/.test(line)) {
      i++;
      continue;
    }

    const timing = line.match(
      /^(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)\s*-->\s*(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)/,
    );
    if (!timing) {
      i++;
      continue;
    }

    const startMs = parseTimestampToMs(timing[1]!);
    const endMs = parseTimestampToMs(timing[2]!);
    i++;

    const textLines: string[] = [];
    while (i < lines.length && lines[i]?.trim()) {
      textLines.push(lines[i]!.trim());
      i++;
    }

    const text = textLines.join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      segments.push({
        index: segments.length,
        startMs,
        endMs,
        text,
        sourceFile,
      });
    }
    i++;
  }

  return segments;
}

function parseSrt(content: string, sourceFile?: string): TranscriptSegmentModelType[] {
  const blocks = content.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  const segments: TranscriptSegmentModelType[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim());
    if (lines.length < 2) continue;

    const timingLine = lines.find((l) => l.includes("-->"));
    if (!timingLine) continue;

    const timing = timingLine.match(
      /^(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)\s*-->\s*(\d{2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)/,
    );
    if (!timing) continue;

    const timingIndex = lines.indexOf(timingLine);
    const text = lines
      .slice(timingIndex + 1)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    segments.push({
      index: segments.length,
      startMs: parseTimestampToMs(timing[1]!),
      endMs: parseTimestampToMs(timing[2]!),
      text,
      sourceFile,
    });
  }

  return segments;
}

export function parseTranscriptFile(
  content: string,
  format: TranscriptFormatModelType,
  sourceFile?: string,
): TranscriptSegmentModelType[] {
  return format === "vtt" ? parseVtt(content, sourceFile) : parseSrt(content, sourceFile);
}
