import type { ChatLogInput, ChunkInput, Repository, RepositoryClient, RetrievedChunk, SourceSnapshotInput } from "./types";

const DIMENSIONS = 1536;
const DEFAULT_THRESHOLD = 0.72;
type RawChunk = Record<string, unknown>;

function mapChunk(row: RawChunk): RetrievedChunk | null {
  const id = typeof row.id === "string" ? row.id : null;
  const sourceId = typeof row.source_id === "string" ? row.source_id : null;
  const title = typeof row.title === "string" ? row.title : null;
  const url = typeof row.url === "string" ? row.url : null;
  const content = typeof row.content === "string" ? row.content : null;
  const similarity = typeof row.similarity === "number" && Number.isFinite(row.similarity) ? row.similarity : null;
  if (!id || !sourceId || !title || !url || !content || similarity === null) return null;
  return { id, content, sourceId, title, url, pageType: typeof row.page_type === "string" ? row.page_type : undefined, section: typeof row.section === "string" ? row.section : undefined, fetchedAt: typeof row.fetched_at === "string" ? row.fetched_at : undefined, contentHash: typeof row.content_hash === "string" ? row.content_hash : undefined, similarity };
}

export function createRepository(client: RepositoryClient): Repository {
  return {
    async getActiveChunks(queryEmbedding: number[], limit: number): Promise<RetrievedChunk[]> {
      if (queryEmbedding.length !== DIMENSIONS) throw new Error("Embedding must contain 1536 dimensions");
      if (!Number.isInteger(limit) || limit <= 0) throw new Error("Limit must be positive");
      const { data, error } = await client.rpc("match_knowledge_chunks", { query_embedding: queryEmbedding, match_threshold: DEFAULT_THRESHOLD, match_count: limit });
      if (error) throw new Error(`Repository retrieval failed: ${error.message}`);
      return (data ?? []).map((row) => mapChunk(row as RawChunk)).filter((row): row is RetrievedChunk => row !== null);
    },
    async insertSourceSnapshot(input: SourceSnapshotInput): Promise<string> {
      const result = await client.rpc("insert_source_snapshot", { p_id: input.id ?? null, p_source_id: input.sourceId, p_raw_content: input.rawContent, p_normalized_markdown: input.normalizedMarkdown, p_content_hash: input.contentHash, p_status: input.status ?? "pending" });
      if (result.error) throw new Error(`Repository snapshot insert failed: ${result.error.message}`);
      const id = (result.data?.[0] as { id?: unknown } | undefined)?.id;
      if (typeof id !== "string") throw new Error("Repository snapshot insert returned invalid ID");
      return id;
    },
    async insertChunks(input: ChunkInput[] | ChunkInput): Promise<void> {
      const chunks = Array.isArray(input) ? input : [input];
      for (const chunk of chunks) {
        if (chunk.embedding.length !== DIMENSIONS) throw new Error("Embedding must contain 1536 dimensions");
      }
      const result = await client.rpc("insert_knowledge_chunks", { p_chunks: chunks.map((chunk) => ({ source_id: chunk.sourceId, snapshot_id: chunk.snapshotId, text_content: chunk.content, embedding: chunk.embedding, section: chunk.section ?? null, content_hash: chunk.contentHash ?? null })) });
      if (result.error) throw new Error(`Repository chunk insert failed: ${result.error.message}`);
    },
    async activateSnapshot(snapshotId: string): Promise<void> {
      const result = await client.rpc("activate_snapshot", { p_snapshot_id: snapshotId });
      if (result.error) throw new Error(`Repository snapshot activation failed: ${result.error.message}`);
    },
    async logChatOutcome(input: ChatLogInput): Promise<void> {
      const result = await client.rpc("log_chat_outcome", { p_question: input.question, p_status: input.status, p_confidence: input.confidence ?? null });
      if (result.error) throw new Error(`Repository logging failed: ${result.error.message}`);
    },
  };
}
