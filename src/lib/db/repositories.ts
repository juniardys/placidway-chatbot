import type { ChatLogInput, RepositoryClient, RetrievedChunk } from "./types";

const DIMENSIONS = 1536;
const DEFAULT_THRESHOLD = 0.72;
type RawChunk = Record<string, unknown>;

function mapChunk(row: RawChunk): RetrievedChunk | null {
  const id = typeof row.id === "string" ? row.id : null;
  const sourceId = typeof row.source_id === "string" ? row.source_id : null;
  const title = typeof row.title === "string" ? row.title : null;
  const url = typeof row.url === "string" ? row.url : null;
  const text = typeof row.content === "string" ? row.content : typeof row.text_content === "string" ? row.text_content : null;
  const score = typeof row.similarity === "number" && Number.isFinite(row.similarity) ? row.similarity : null;
  if (!id || !sourceId || !title || !url || !text || score === null) return null;
  return { id, text, sourceId, title, url, pageType: typeof row.page_type === "string" ? row.page_type : undefined, section: typeof row.section === "string" ? row.section : undefined, fetchedAt: typeof row.fetched_at === "string" ? row.fetched_at : undefined, contentHash: typeof row.content_hash === "string" ? row.content_hash : undefined, score };
}

export function createRepository(client: RepositoryClient) {
  return {
    async getActiveChunks(queryEmbedding: number[], limit: number): Promise<RetrievedChunk[]> {
      if (queryEmbedding.length !== DIMENSIONS) throw new Error("Embedding must contain 1536 dimensions");
      if (!Number.isInteger(limit) || limit <= 0) throw new Error("Limit must be positive");
      const { data, error } = await client.rpc("match_knowledge_chunks", { query_embedding: queryEmbedding, match_threshold: DEFAULT_THRESHOLD, match_count: limit });
      if (error) throw new Error(`Repository retrieval failed: ${error.message}`);
      return (data ?? []).map((row) => mapChunk(row as RawChunk)).filter((row): row is RetrievedChunk => row !== null);
    },
    async logChatOutcome(input: ChatLogInput): Promise<void> {
      const result = await client.rpc("log_chat_outcome", { p_question: input.question, p_status: input.status, p_confidence: input.confidence ?? null });
      if (result.error) throw new Error(`Repository logging failed: ${result.error.message}`);
    },
  };
}
