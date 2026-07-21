export { inngest, isInngestEnabled } from "./client";
export { RAG_MESSAGE_INGEST_EVENT, type RagMessageIngestEvent } from "./events";
export { ragIngestMessage } from "./functions/rag-ingest";

import type { InngestFunction } from "inngest";
import { ragIngestMessage } from "./functions/rag-ingest";

/** All Inngest functions registered with the serve handler. */
export const inngestFunctions: InngestFunction.Any[] = [ragIngestMessage];
