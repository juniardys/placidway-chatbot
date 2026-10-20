import { describe, expect, test } from "vitest";
import { refreshKnowledgeBase } from "../../src/lib/ingestion/refresh";
import { SOURCES } from "../../src/config/sources";
const doc = (id: string, hash: string) => ({
  sourceId: id,
  title: id,
  pageType: "content",
  fetchedAt: "now",
  contentHash: hash,
  markdown: "facts",
});
const deps = (repo: any, hashes: Record<string, string> = {}) => ({
  sources: SOURCES.map((s) => ({ ...s })),
  repository: { ...repo, getActiveHashes: async () => hashes },
  fetch: async (s: any) => ({
    sourceId: s.id,
    html: "",
    url: s.url,
    fetchedAt: "now",
    status: 200,
    headers: {},
    title: s.title,
    pageType: s.pageType,
  }),
  normalize: async (r: any) => ({
    ...doc(r.sourceId, "new"),
    sections: [],
    url: r.url,
    status: 200,
    headers: {},
  }),
  chunk: () => [
    {
      content: "facts",
      section: "x",
      index: 0,
      sourceId: "x",
      title: "x",
      pageType: "content",
      fetchedAt: "now",
      contentHash: "new",
    },
  ],
  embeddings: { embedDocuments: async () => [[...Array(1536).fill(0)]] },
});
describe("refresh", () => {
  test("rejects injected source list", async () => {
    const result = await refreshKnowledgeBase({
      sources: SOURCES.slice(0, 6) as any,
    });
    expect(result.status).toBe("failed");
  });
  test("reuses unchanged hashes and atomically writes changed sources", async () => {
    let calls = 0;
    const repository = {
      refreshAtomically: async (x: any) => {
        calls++;
        expect(x).toHaveLength(1);
      },
    };
    const result = await refreshKnowledgeBase(
      deps(
        repository,
        Object.fromEntries(
          SOURCES.map((s) => [s.id, s.id === SOURCES[0].id ? "old" : "new"]),
        ),
      ),
    );
    expect(result).toMatchObject({ status: "success" });
    expect(calls).toBe(1);
  });
  test("sanitizes failures and releases lock", async () => {
    const first = await refreshKnowledgeBase({
      sources: SOURCES as any,
      fetch: async () => {
        throw new Error("api_key=secret");
      },
    });
    expect(first.error).toBe("Source fetch failed");
    const second = await refreshKnowledgeBase({
      sources: SOURCES as any,
      fetch: async () => ({}) as any,
      normalize: async () => ({
        ...doc("x", "x"),
        sections: [],
        url: "https://x",
        status: 200,
        headers: {},
      }),
      embeddings: { embedDocuments: async () => [] },
    });
    expect(second.status).not.toBe("skipped");
  });
});
