import { describe, expect, test } from "vitest";
import { createRepository } from "../../src/lib/db/repositories";

describe("repository", () => {
  test("retrieves active chunks through vector RPC with threshold", async () => {
    const calls: unknown[] = [];
    const client = {
      rpc: async (name: string, args: unknown) => {
        calls.push([name, args]);
        return { data: [{ id: "c1", content: "facts", source_id: "s1", title: "Title", url: "https://example.com", page_type: "content", section: "Intro", fetched_at: "2026-01-01", content_hash: "h", similarity: 0.9 }], error: null };
      },
    };
    const result = await createRepository(client).getActiveChunks(Array(1536).fill(0.1), 6);
    expect(result[0]).toMatchObject({ id: "c1", content: "facts", similarity: 0.9, sourceId: "s1" });
    expect(calls[0]).toEqual(["match_knowledge_chunks", expect.objectContaining({ match_count: 6, match_threshold: 0.72 })]);
  });

  test("rejects embeddings with wrong dimension", async () => {
    const client = { rpc: async () => ({ data: [], error: null }) };
    await expect(createRepository(client).getActiveChunks([1], 6)).rejects.toThrow("1536");
  });
});
