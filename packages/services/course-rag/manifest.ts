import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { IngestManifestModelType } from "./model";

const MANIFEST_VERSION = 1 as const;

export function hashFileContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function hashFilePath(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export function loadManifest(manifestPath: string, courseId: string): IngestManifestModelType {
  if (!existsSync(manifestPath)) {
    return { version: MANIFEST_VERSION, courseId, files: {} };
  }

  try {
    const raw = readFileSync(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as IngestManifestModelType;
    if (parsed.version !== MANIFEST_VERSION) {
      return { version: MANIFEST_VERSION, courseId, files: {} };
    }
    return { ...parsed, courseId: parsed.courseId || courseId, files: parsed.files ?? {} };
  } catch {
    return { version: MANIFEST_VERSION, courseId, files: {} };
  }
}

export function saveManifest(manifestPath: string, manifest: IngestManifestModelType): void {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function shouldIngestFile(input: {
  relativePath: string;
  contentHash: string;
  mtimeMs: number;
  manifest: IngestManifestModelType;
  force?: boolean;
}): boolean {
  if (input.force) return true;
  const existing = input.manifest.files[input.relativePath];
  if (!existing) return true;
  return existing.contentHash !== input.contentHash || existing.mtimeMs !== input.mtimeMs;
}

export function lectureIdFromRelativePath(relativePath: string): string {
  const withoutExt = relativePath.replace(/\.(vtt|srt)$/i, "");
  return withoutExt.replace(/\\/g, "/");
}

export function moduleIdFromRelativePath(relativePath: string): string {
  const parts = relativePath.replace(/\\/g, "/").split("/");
  return parts[0] ?? "unknown-module";
}

export function vectorIdForChunk(relativePath: string, chunkIndex: number): string {
  const base = createHash("sha256").update(relativePath).digest("hex").slice(0, 24);
  return `${base}:${chunkIndex}`;
}

export function defaultManifestPath(courseRagDir: string, courseId: string): string {
  return path.join(courseRagDir, `.ingest-manifest.${courseId}.json`);
}
