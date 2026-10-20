import { chunkByHeading, type DocumentChunk } from "./chunk";
import { fetchSource, type Pacer } from "./fetcher";
import { normalizeSource, type NormalizedDocument } from "./normalize";
import { validateProductionSources, validateSourceFixture } from "./sources";
import type { RefreshRepository, AtomicRefreshSource } from "../db/types";
import { SOURCES } from "../../config/sources";
import { getEmbeddings } from "../llm/client";
import { getServerSupabase } from "../db/client";
import { createRepository } from "../db/repositories";

export type RefreshResult = { status: "success" | "unchanged" | "failed" | "skipped"; sources: number; chunks: number; error?: string };
export type RefreshDeps = { sources?: typeof SOURCES; fetch?: typeof fetchSource; normalize?: typeof normalizeSource; chunk?: (markdown: string, maxChars?: number, metadata?: Omit<DocumentChunk, "content" | "section" | "index">) => DocumentChunk[]; embeddings?: { embedDocuments(texts: string[]): Promise<number[][]> }; repository?: RefreshRepository; pacer?: Pacer };
let running = false;
function safeFailure(error: unknown): string { const message = error instanceof Error ? error.message : "Refresh failed"; if (/secret|key|token|password|authorization|bearer|api[_ -]?key/i.test(message)) return "Refresh failed"; if (/robots/i.test(message)) return "Source disallowed by robots policy"; if (/embedding/i.test(message)) return "Embedding failed"; if (/repository|snapshot|chunk|refresh/i.test(message)) return "Knowledge-base write failed"; if (/fetch|http|source/i.test(message)) return "Source fetch failed"; return "Refresh failed"; }
export async function refreshKnowledgeBase(deps: RefreshDeps = {}): Promise<RefreshResult> {
  if (running) return { status: "skipped", sources: 0, chunks: 0 }; running = true; let sources = 0; let chunks = 0;
  try {
    const list = deps.sources ?? SOURCES; if (list === SOURCES) validateProductionSources(list); else validateSourceFixture(list); const fetcher = deps.fetch ?? fetchSource; const normalizer = deps.normalize ?? normalizeSource; const chunker = deps.chunk ?? chunkByHeading; const repository = deps.repository ?? createRepository(getServerSupabase()); const embedding = deps.embeddings ?? getEmbeddings(); const activeHashes = await repository.getActiveHashes();
    const documents: { doc: NormalizedDocument; parts: DocumentChunk[] }[] = [];
    for (const source of list) { const raw = await fetcher(source, fetch, deps.pacer); const doc = await normalizer(raw); sources++; if (activeHashes[source.id] === doc.contentHash) continue; documents.push({ doc, parts: chunker(doc.markdown, 1800, { sourceId: doc.sourceId, title: doc.title, pageType: doc.pageType, fetchedAt: doc.fetchedAt, contentHash: doc.contentHash }) }); }
    if (!documents.length) return { status: "unchanged", sources, chunks: 0 };
    const atomicSources: AtomicRefreshSource[] = [];
    for (const { doc, parts } of documents) { const vectors = await embedding.embedDocuments(parts.map((part) => part.content)); if (vectors.length !== parts.length) throw new Error("Embedding failed"); atomicSources.push({ sourceId: doc.sourceId, rawContent: doc.markdown, normalizedMarkdown: doc.markdown, contentHash: doc.contentHash, chunks: parts.map((part, i) => ({ sourceId: doc.sourceId, content: part.content, embedding: vectors[i], section: part.section, contentHash: doc.contentHash })) }); chunks += parts.length; }
    await repository.refreshAtomically(atomicSources); return { status: "success", sources, chunks };
  } catch (error) { return { status: "failed", sources, chunks, error: safeFailure(error) }; } finally { running = false; }
}
