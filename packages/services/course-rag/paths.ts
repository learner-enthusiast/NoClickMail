import { existsSync } from "node:fs";
import path from "node:path";
import { env } from "../env";

let cachedCourseRagDir: string | undefined;

/**
 * Resolve course-rag package directory without import.meta.url (breaks when tsup
 * bundles @repo/services into apps/api/dist/index.js as CJS).
 */
export function resolveCourseRagDir(): string {
  if (cachedCourseRagDir) return cachedCourseRagDir;

  if (env.COURSE_RAG_DIR) {
    cachedCourseRagDir = path.resolve(env.COURSE_RAG_DIR);
    return cachedCourseRagDir;
  }

  const candidates = [
    path.resolve(process.cwd(), "course-rag"),
    path.resolve(process.cwd(), "../../packages/services/course-rag"),
    path.resolve(process.cwd(), "packages/services/course-rag"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      cachedCourseRagDir = candidate;
      return cachedCourseRagDir;
    }
  }

  cachedCourseRagDir = candidates[1]!;
  return cachedCourseRagDir;
}
