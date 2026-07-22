import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { TranscriptFormatModelType } from "./model";

export type DiscoveredTranscript = {
  absolutePath: string;
  relativePath: string;
  format: TranscriptFormatModelType;
  moduleId: string;
  lectureId: string;
  fileName: string;
};

function isIgnoredPath(fullPath: string): boolean {
  const normalized = fullPath.replace(/\\/g, "/");
  return (
    normalized.includes("/__MACOSX/") ||
    normalized.includes("/._") ||
    normalized.endsWith(".DS_Store") ||
    /\/\.[^/]+/.test(normalized)
  );
}

function walkTranscriptFiles(rootDir: string, currentDir: string, acc: string[]): void {
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = path.join(currentDir, entry.name);
    if (isIgnoredPath(fullPath)) continue;

    if (entry.isDirectory()) {
      walkTranscriptFiles(rootDir, fullPath, acc);
      continue;
    }

    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (ext === ".vtt" || ext === ".srt") {
      acc.push(fullPath);
    }
  }
}

/** Prefer VTT over SRT when both exist for the same lecture folder + basename. */
export function discoverTranscripts(subtitleRoot: string): DiscoveredTranscript[] {
  const files: string[] = [];
  walkTranscriptFiles(subtitleRoot, subtitleRoot, files);

  const byKey = new Map<string, DiscoveredTranscript>();

  for (const absolutePath of files) {
    const relativePath = path.relative(subtitleRoot, absolutePath).replace(/\\/g, "/");
    const ext = path.extname(absolutePath).toLowerCase();
    const format: TranscriptFormatModelType = ext === ".vtt" ? "vtt" : "srt";
    const dir = path.dirname(relativePath);
    const base = path.basename(absolutePath, ext);
    const key = `${dir}/${base}`;

    const candidate: DiscoveredTranscript = {
      absolutePath,
      relativePath,
      format,
      moduleId: relativePath.split("/")[0] ?? "unknown-module",
      lectureId: relativePath.replace(/\.(vtt|srt)$/i, ""),
      fileName: path.basename(absolutePath),
    };

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }

    // Prefer VTT
    if (existing.format === "srt" && format === "vtt") {
      byKey.set(key, candidate);
    }
  }

  return [...byKey.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function findDefaultSubtitleRoot(courseRagDir: string): string | null {
  for (const entry of readdirSync(courseRagDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("class_subtitle")) continue;
    const candidate = path.join(courseRagDir, entry.name, "class-subtitle");
    try {
      if (statSync(candidate).isDirectory()) return candidate;
    } catch {
      // skip
    }
  }
  return null;
}
