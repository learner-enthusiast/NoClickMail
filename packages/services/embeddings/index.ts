import { env } from "../env";
import { internal } from "../error";

type OpenAIEmbeddingResponse = {
  data: { embedding: number[]; index: number }[];
};

/** OpenAI text embeddings for RAG indexing and retrieval. */
class EmbeddingService {
  private readonly model = env.OPENAI_EMBEDDING_MODEL;

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: env.OPENAI_EMBEDDING_DIMENSIONS,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw internal(`Embedding request failed: ${res.status} ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as OpenAIEmbeddingResponse;
    return json.data.sort((a, b) => a.index - b.index).map((row) => row.embedding);
  }

  async embedOne(text: string): Promise<number[]> {
    const [vector] = await this.embed([text]);
    if (!vector) throw internal("Embedding returned empty vector");
    return vector;
  }
}

export default EmbeddingService;
