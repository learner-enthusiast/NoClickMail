#!/usr/bin/env tsx
import path from "node:path";
import CourseRagService from "../index";

function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const courseIdIdx = argv.indexOf("--course-id");
  const courseId = courseIdIdx >= 0 ? argv[courseIdIdx + 1] : undefined;
  const rootIdx = argv.indexOf("--root");
  const subtitleRoot = rootIdx >= 0 ? argv[rootIdx + 1] : undefined;
  return { force, courseId, subtitleRoot };
}

async function main() {
  const { force, courseId, subtitleRoot } = parseArgs(process.argv.slice(2));
  const service = new CourseRagService();

  if (!service.isConfigured()) {
    console.error(
      "Missing COURSE_PINECONE_API_KEY or COURSE_PINECONE_INDEX in .env",
    );
    process.exit(1);
  }

  console.log("Scanning subtitles and ingesting into Pinecone…");
  if (force) console.log("(force mode — re-ingesting all files)");

  const result = await service.ingestSubtitleDirectory({
    courseId,
    subtitleRoot,
    force,
  });

  console.log("\n--- Course RAG ingest summary ---");
  console.log(`Course ID:  ${result.courseId}`);
  console.log(`Scanned:    ${result.scanned}`);
  console.log(`Ingested:   ${result.ingested}`);
  console.log(`Skipped:    ${result.skipped} (unchanged)`);
  console.log(`Failed:     ${result.failed}`);
  console.log(
    `Manifest:   ${path.join(service.getCourseRagDir(), `.ingest-manifest.${result.courseId}.json`)}`,
  );

  if (result.failed > 0) {
    console.log("\nFailed files:");
    for (const f of result.files.filter((x) => x.status === "failed")) {
      console.log(`  - ${f.relativePath}: ${f.error}`);
    }
    process.exit(1);
  }

  if (result.ingested === 0 && result.skipped === result.scanned) {
    console.log("\nAll files already indexed. Add new VTT/SRT files and re-run to ingest them.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
