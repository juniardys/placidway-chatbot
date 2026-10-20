import { chunkByHeading, type DocumentChunk } from "./chunk";
import { fetchSource, type Pacer } from "./fetcher";
import { normalizeSource, type NormalizedDocument } from "./normalize";
import { validateProductionSources } from "./sources";
import { SOURCES } from "../../config/sources";
import { getEmbeddings } from "../llm/client";
import { getServerSupabase } from "../db/client";
import { createRepository } from "../db/repositories";
import type { Repository } from "../db/types";

export type RefreshResult = { status: "success" | "unchanged" | "failed" | "skipped"; sources: number; chunks: number; error?: string };
export type RefreshDeps = {
  sources?: typeof SOURCES;
  fetch?: typeof fetchSource;
  normalize?: typeof normalizeSource;
  chunk?: (markdown: string, maxChars?: number, metadata?: Omit<DocumentChunk, "content" | "section" | "index">) => DocumentChunk[];
  embeddings?: { embedDocuments(texts: string[]): Promise<number[][]> };
  repository?: Repository & { getActiveHashes?: () => Promise<Record<string, string>> };
  pacer?: Pacer;
};
let running = false;

export async function refreshKnowledgeBase(deps: RefreshDeps = {}): Promise<RefreshResult> {
  if (running) return { status: "skipped", sources: 0, chunks: 0 };
  running = true;
  let sources = 0; let chunks = 0;
  try {
    validateProductionSources();
    const list = deps.sources ?? SOURCES;
    const fetcher = deps.fetch ?? fetchSource;
    const normalizer = deps.normalize ?? normalizeSource;
    const chunker = deps.chunk ?? chunkByHeading;
    const repository = deps.repository ?? createRepository(getServerSupabase());
    const embedding = deps.embeddings ?? getEmbeddings();
    const activeHashes = await (repository as Repository & { getActiveHashes?: () => Promise<Record<string, string>> }).getActiveHashes?.() ?? {};
    const documents: { doc: NormalizedDocument; parts: DocumentChunk[] }[] = [];
    for (const source of list) {
      const raw = await fetcher(source, fetch, deps.pacer);
      const doc = await normalizer(raw);
      sources++;
      if (activeHashes[source.id] === doc.contentHash) continue;
      const parts = chunker(doc.markdown, 1800, { sourceId: doc.sourceId, title: doc.title, pageType: doc.pageType, fetchedAt: doc.fetchedAt, contentHash: doc.contentHash });
      documents.push({ doc, parts });
    }
    if (!documents.length) return { status: "unchanged", sources, chunks: 0 };
    const snapshotIds: string[] = [];
    for (const { doc, parts } of documents) {
      const snapshotId = await repository.insertSourceSnapshot({ sourceId: doc.sourceId, rawContent: doc.markdown, normalizedMarkdown: doc.markdown, contentHash: doc.contentHash });
      const vectors = await embedding.embedDocuments(parts.map((part) => part.content));
      await repository.insertChunks(parts.map((part, i) => ({ sourceId: doc.sourceId, snapshotId, content: part.content, embedding: vectors[i], section: part.section, contentHash: doc.contentHash })));
      snapshotIds.push(snapshotId); chunks += parts.length;
    }
    for (const id of snapshotIds) await repository.activateSnapshot(id);
    return { status: "success", sources, chunks };
  } catch (error) {
    return { status: "failed", sources, chunks, error: error instanceof Error ? error.message : "Refresh failed" };
  } finally { running = false; }
}
