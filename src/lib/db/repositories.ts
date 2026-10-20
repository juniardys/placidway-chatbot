import type {
  AtomicRefreshSource,
  ChatLogInput,
  ChunkInput,
  Repository,
  RepositoryClient,
  RetrievedChunk,
  SourceSnapshotInput,
} from "./types";

const DIMENSIONS = 1536;
const DEFAULT_THRESHOLD = 0.72;

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
      const createdSnapshots: string[] = [];
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
          if (sourceResult.error) throw new Error(sourceResult.error.message);
          const snapshotResult = await client.from("knowledge_snapshots").insert({
            source_id: source.sourceId,
            raw_content: source.rawContent,
            normalized_markdown: source.normalizedMarkdown,
            content_hash: source.contentHash,
            status: "active",
            active: true,
          }).select("id").single();
          if (snapshotResult.error) throw new Error(snapshotResult.error.message);
          const snapshotId = snapshotResult.data?.id;
          if (typeof snapshotId !== "string") throw new Error("Snapshot ID missing");
          createdSnapshots.push(snapshotId);
          const chunkResult = await client.from("knowledge_chunks").insert(
            source.chunks.map((chunk) => ({
              source_id: source.sourceId,
              snapshot_id: snapshotId,
              text_content: chunk.content,
              embedding: chunk.embedding,
              section: chunk.section ?? null,
              content_hash: chunk.contentHash ?? null,
              active: true,
            })),
          );
          if (chunkResult.error) throw new Error(chunkResult.error.message);
          await client.from("knowledge_snapshots").update({ active: false }).eq("source_id", source.sourceId).neq("id", snapshotId);
          await client.from("knowledge_chunks").update({ active: false }).eq("source_id", source.sourceId).neq("snapshot_id", snapshotId);
          await client.from("knowledge_sources").update({ latest_content_hash: source.contentHash }).eq("id", source.sourceId);
        }
        return;
      } catch (error) {
        for (const snapshotId of createdSnapshots) {
          await client.from("knowledge_chunks").delete().eq("snapshot_id", snapshotId);
          await client.from("knowledge_snapshots").delete().eq("id", snapshotId);
        }
        throw new Error(`Repository atomic refresh failed: ${error instanceof Error ? error.message : "unknown"}`);
      }
    },
    async getActiveChunks(
      queryEmbedding: number[],
      limit: number,
    ): Promise<RetrievedChunk[]> {
      assertEmbedding(queryEmbedding);
      if (!Number.isInteger(limit) || limit <= 0)
        throw new Error("Limit must be positive");
      if (client.from) {
        const result = await client
          .from("knowledge_chunks")
          .select(
            "id, source_id, text_content, section, content_hash, embedding, knowledge_sources!inner(title, url, page_type), knowledge_snapshots!inner(created_at, status)",
          )
          .eq("active", true)
          .eq("knowledge_sources.active", true)
          .eq("knowledge_snapshots.active", true)
          .eq("knowledge_snapshots.status", "active");
        if (result.error)
          throw new Error(`Repository retrieval failed: ${result.error.message}`);
        return (result.data ?? [])
          .map((row: any) => {
            const source = Array.isArray(row.knowledge_sources)
              ? row.knowledge_sources[0]
              : row.knowledge_sources;
            const snapshot = Array.isArray(row.knowledge_snapshots)
              ? row.knowledge_snapshots[0]
              : row.knowledge_snapshots;
            const embedding = Array.isArray(row.embedding)
              ? row.embedding
              : typeof row.embedding === "string"
                ? row.embedding
                    .replace(/^\[|\]$/g, "")
                    .split(",")
                    .map(Number)
                    .filter(Number.isFinite)
                : [];
            const magnitude = Math.sqrt(
              embedding.reduce((sum: number, value: number) => sum + value * value, 0),
            );
            const queryMagnitude = Math.sqrt(
              queryEmbedding.reduce((sum, value) => sum + value * value, 0),
            );
            const similarity =
              magnitude && queryMagnitude
                ? embedding.reduce(
                    (sum: number, value: number, index: number) =>
                      sum + value * queryEmbedding[index],
                    0,
                  ) /
                    (magnitude * queryMagnitude)
                : 0;
            return mapChunk({
              id: row.id,
              source_id: row.source_id,
              content: row.text_content,
              title: source?.title,
              url: source?.url,
              page_type: source?.page_type,
              section: row.section,
              fetched_at: snapshot?.created_at,
              content_hash: row.content_hash,
              similarity,
            });
          })
          .filter((row: RetrievedChunk | null): row is RetrievedChunk => row !== null)
          .filter((row: RetrievedChunk) => row.similarity >= DEFAULT_THRESHOLD)
          .sort((a: RetrievedChunk, b: RetrievedChunk) => b.similarity - a.similarity)
          .slice(0, limit);
      }
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
    async insertSourceSnapshot(input: SourceSnapshotInput): Promise<string> {
      const result = await client.rpc("insert_source_snapshot", {
        p_id: input.id ?? null,
        p_source_id: input.sourceId,
        p_raw_content: input.rawContent,
        p_normalized_markdown: input.normalizedMarkdown,
        p_content_hash: input.contentHash,
        p_status: input.status ?? "pending",
      });
      if (result.error)
        throw new Error(
          `Repository snapshot insert failed: ${result.error.message}`,
        );
      const id = (result.data?.[0] as { id?: unknown } | undefined)?.id;
      if (typeof id !== "string")
        throw new Error("Repository snapshot insert returned invalid ID");
      return id;
    },
    async insertChunks(input: ChunkInput[] | ChunkInput): Promise<void> {
      const chunks = Array.isArray(input) ? input : [input];
      for (const chunk of chunks) {
        assertEmbedding(chunk.embedding);
      }
      const result = await client.rpc("insert_knowledge_chunks", {
        p_chunks: chunks.map((chunk) => ({
          source_id: chunk.sourceId,
          snapshot_id: chunk.snapshotId,
          text_content: chunk.content,
          embedding: chunk.embedding,
          section: chunk.section ?? null,
          content_hash: chunk.contentHash ?? null,
        })),
      });
      if (result.error)
        throw new Error(
          `Repository chunk insert failed: ${result.error.message}`,
        );
    },
    async activateSnapshot(snapshotId: string): Promise<void> {
      const result = await client.rpc("activate_snapshot", {
        p_snapshot_id: snapshotId,
      });
      if (result.error)
        throw new Error(
          `Repository snapshot activation failed: ${result.error.message}`,
        );
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
