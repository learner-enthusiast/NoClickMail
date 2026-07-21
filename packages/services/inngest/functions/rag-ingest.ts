import type { InngestFunction } from "inngest";
import { ingestUserMessageInputModel } from "../../rag/model";
import { embedChunks, ingestChunks, upsertIngestRecords } from "../../rag/ingest-worker";
import { inngest } from "../client";
import { RAG_MESSAGE_INGEST_EVENT } from "../events";

export const ragIngestMessage: InngestFunction.Any = inngest.createFunction(
  {
    id: "rag-ingest-message",
    triggers: [{ event: RAG_MESSAGE_INGEST_EVENT }],
    retries: 3,
  },
  async ({ event, step }) => {
    const input = ingestUserMessageInputModel.parse(event.data);

    const chunks = await step.run("chunk", () => ingestChunks(input.content));
    if (chunks.length === 0) {
      return { chunkCount: 0, vectorIds: [] as string[] };
    }

    const chunkVectors = await step.run("embed", () => embedChunks(chunks));
    return step.run("upsert", () => upsertIngestRecords(input, chunks, chunkVectors));
  },
);
