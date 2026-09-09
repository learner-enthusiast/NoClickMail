export { inngest, isInngestEnabled } from "./client";

import type { InngestFunction } from "inngest";

/** Inngest functions — empty after RAG ingest moved to Mem0. */
export const inngestFunctions: InngestFunction.Any[] = [];
