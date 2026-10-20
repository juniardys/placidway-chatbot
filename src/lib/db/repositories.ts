import { RETRIEVAL_MIN_SCORE } from "../constants";
import type {
  AtomicRefreshSource,
  ChatLogInput,
  Repository,
  RepositoryClient,
  RetrievedChunk,
} from "./types";

const DIMENSIONS = 1536;
const CHUNK_INSERT_BATCH = 50;
const DEFAULT_THRESHOLD = RETRIEVAL_MIN_SCORE;

function assertEmbedding(embedding: number[]): void {
  if (
    embedding.length !== DIMENSIONS ||
    embedding.some(
      (value) => typeof value !== "number" || !Number.isFinite(value),
    )
  )
    throw new Error("Embedding must contain 1536 finite dimensions");
}
type RawChunk = Record<string, unknown>;

function mapChunk(row: RawChunk): RetrievedChunk | null {
  const id = typeof row.id === "string" ? row.id : null;
  const sourceId = typeof row.source_id === "string" ? row.source_id : null;
  const title = typeof row.title === "string" ? row.title : null;
  const url = typeof row.url === "string" ? row.url : null;
  const content = typeof row.content === "string" ? row.content : null;
  const similarity =
    typeof row.similarity === "number" && Number.isFinite(row.similarity)
      ? row.similarity
      : null;
  if (!id || !sourceId || !title || !url || !content || similarity === null)
    return null;
  return {
    id,
    content,
    sourceId,
    title,
    url,
    pageType: typeof row.page_type === "string" ? row.page_type : undefined,
    section: typeof row.section === "string" ? row.section : undefined,
    fetchedAt: typeof row.fetched_at === "string" ? row.fetched_at : undefined,
    contentHash:
      typeof row.content_hash === "string" ? row.content_hash : undefined,
    similarity,
  };
}

export function createRepository(client: RepositoryClient): Repository {
  return {
    async getActiveHashes(): Promise<Record<string, string>> {
      if (!client.from) throw new Error("Repository client is not configured");
      const result = await client
        .from("knowledge_snapshots")
        .select("source_id, content_hash")
        .eq("active", true)
        .eq("status", "active");
      if (result.error)
        throw new Error(`Repository hash lookup failed: ${result.error.message}`);
      return Object.fromEntries(
        (result.data ?? []).flatMap((row: unknown) => {
          const value = row as { source_id?: unknown; content_hash?: unknown };
          return typeof value.source_id === "string" &&
            typeof value.content_hash === "string"
            ? [[value.source_id, value.content_hash]]
            : [];
        }),
      );
    },
    async refreshAtomically(sources: AtomicRefreshSource[]) {
      if (!sources.length)
        throw new Error("Atomic refresh payload must be non-empty");
      const seen = new Set<string>();
      for (const source of sources) {
        if (
          !source.sourceId ||
          seen.has(source.sourceId) ||
          !source.contentHash ||
          !source.chunks.length
        )
          throw new Error("Invalid atomic refresh payload");
        seen.add(source.sourceId);
        for (const chunk of source.chunks) assertEmbedding(chunk.embedding);
      }
      if (!client.from) throw new Error("Repository client is not configured");
      const fail = (step: string, error: { message: string } | null | undefined) => {
        if (error) throw new Error(`Repository atomic refresh failed (${step}): ${error.message}`);
      };
      // Phase 1: stage every source as an inactive "pending" snapshot. Nothing
      // is visible to retrieval yet, so a failure here only needs cleanup.
      const staged: { source: AtomicRefreshSource; snapshotId: string }[] = [];
      try {
        for (const source of sources) {
          const sourceResult = await client.from("knowledge_sources").upsert({
            id: source.sourceId,
            url: source.url,
            title: source.title,
            page_type: source.pageType,
            active: true,
            updated_at: new Date().toISOString(),
          });
          fail("source upsert", sourceResult.error);
          const snapshotResult = await client
            .from("knowledge_snapshots")
            .insert({
              source_id: source.sourceId,
              raw_content: source.rawContent,
              normalized_markdown: source.normalizedMarkdown,
              content_hash: source.contentHash,
              status: "pending",
              active: false,
            })
            .select("id")
            .single();
          fail("snapshot insert", snapshotResult.error);
          const snapshotId = snapshotResult.data?.id;
          if (typeof snapshotId !== "string") throw new Error("Snapshot ID missing");
          staged.push({ source, snapshotId });
          for (let start = 0; start < source.chunks.length; start += CHUNK_INSERT_BATCH) {
            const chunkResult = await client.from("knowledge_chunks").insert(
              source.chunks.slice(start, start + CHUNK_INSERT_BATCH).map((chunk) => ({
                source_id: source.sourceId,
                snapshot_id: snapshotId,
                text_content: chunk.content,
                embedding: chunk.embedding,
                section: chunk.section ?? null,
                content_hash: chunk.contentHash ?? null,
                active: false,
              })),
            );
            fail("chunk insert", chunkResult.error);
          }
        }
      } catch (error) {
        for (const { snapshotId } of staged) {
          await client.from("knowledge_chunks").delete().eq("snapshot_id", snapshotId);
          await client.from("knowledge_snapshots").delete().eq("id", snapshotId);
        }
        throw error;
      }
      // Phase 2: per source, activate the new snapshot before retiring the old
      // one, so retrieval never sees a source with zero active chunks.
      for (const { source, snapshotId } of staged) {
        fail(
          "chunk activation",
          (await client.from("knowledge_chunks").update({ active: true }).eq("snapshot_id", snapshotId)).error,
        );
        fail(
          "snapshot activation",
          (await client.from("knowledge_snapshots").update({ active: true, status: "active" }).eq("id", snapshotId)).error,
        );
        fail(
          "old chunk retirement",
          (await client.from("knowledge_chunks").update({ active: false }).eq("source_id", source.sourceId).neq("snapshot_id", snapshotId)).error,
        );
        fail(
          "old snapshot retirement",
          (await client.from("knowledge_snapshots").update({ active: false }).eq("source_id", source.sourceId).neq("id", snapshotId)).error,
        );
        fail(
          "source hash update",
          (await client.from("knowledge_sources").update({ latest_content_hash: source.contentHash }).eq("id", source.sourceId)).error,
        );
        // Best-effort pruning of retired rows; the refresh already succeeded,
        // so leftovers are only cleaned up again on the next change.
        const pruned = await client.from("knowledge_chunks").delete().eq("source_id", source.sourceId).eq("active", false);
        if (!pruned.error)
          await client.from("knowledge_snapshots").delete().eq("source_id", source.sourceId).eq("active", false);
      }
    },
    async getActiveChunks(
      queryEmbedding: number[],
      limit: number,
    ): Promise<RetrievedChunk[]> {
      assertEmbedding(queryEmbedding);
      if (!Number.isInteger(limit) || limit <= 0)
        throw new Error("Limit must be positive");
      if (!client.rpc) throw new Error("Repository client is not configured");
      const { data, error } = await client.rpc("match_knowledge_chunks", {
        query_embedding: queryEmbedding,
        match_threshold: DEFAULT_THRESHOLD,
        match_count: limit,
      });
      if (error)
        throw new Error(`Repository retrieval failed: ${error.message}`);
      return (data ?? [])
        .map((row) => mapChunk(row as RawChunk))
        .filter((row): row is RetrievedChunk => row !== null);
    },
    async logChatOutcome(input: ChatLogInput): Promise<void> {
      const result = await client.rpc("log_chat_outcome", {
        p_question: input.question,
        p_status: input.status,
        p_confidence: input.confidence ?? null,
      });
      if (result.error)
        throw new Error(`Repository logging failed: ${result.error.message}`);
    },
  };
}
