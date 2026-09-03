import { createEmbedding, createEmbeddings } from "../../open-ai_SDK";

/**
 * OpenAI embedding client for RAG retrieval.
 *
 * Model and dimensions come from OPENAI_EMBEDDING_MODEL / OPENAI_EMBEDDING_DIMENSIONS env vars.
 */
class EmbeddingService {
  /** Batch embed up to 96 texts in a single OpenAI API call. */
  async embed(texts: string[]): Promise<number[][]> {
    return createEmbeddings(texts);
  }

  /** Convenience wrapper for single-query retrieval embedding. */
  async embedOne(text: string): Promise<number[]> {
    return createEmbedding(text);
  }
}

export default EmbeddingService;
