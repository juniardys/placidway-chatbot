import { describe, expect, test } from "vitest";
import { createRepository } from "../../src/lib/db/repositories";

describe("repository", () => {
  test("retrieves active chunks through direct table queries", async () => {
    const calls: unknown[] = [];
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      },
    };
    await createRepository(client as any).getActiveChunks(Array(1536).fill(0.1), 6);
    expect(calls).toContainEqual(["from", "knowledge_chunks"]);
  });

  test("retrieves active chunks through vector RPC with threshold", async () => {
    const calls: unknown[] = [];
    const client = {
      rpc: async (name: string, args: unknown) => {
        calls.push([name, args]);
        return {
          data: [
            {
              id: "c1",
              content: "facts",
              source_id: "s1",
              title: "Title",
              url: "https://example.com",
              page_type: "content",
              section: "Intro",
              fetched_at: "2026-01-01",
              content_hash: "h",
              similarity: 0.9,
            },
          ],
          error: null,
        };
      },
    };
    const result = await createRepository(client).getActiveChunks(
      Array(1536).fill(0.1),
      6,
    );
    expect(result[0]).toMatchObject({
      id: "c1",
      content: "facts",
      similarity: 0.9,
      sourceId: "s1",
    });
    expect(calls[0]).toEqual([
      "match_knowledge_chunks",
      expect.objectContaining({ match_count: 6, match_threshold: 0.72 }),
    ]);
  });

  test("rejects embeddings with wrong dimension", async () => {
    const client = { rpc: async () => ({ data: [], error: null }) };
    await expect(
      createRepository(client).getActiveChunks([1], 6),
    ).rejects.toThrow("1536");
  });

  test("rejects non-finite retrieval embeddings and non-positive limits", async () => {
    const client = { rpc: async () => ({ data: [], error: null }) };
    await expect(
      createRepository(client).getActiveChunks(
        [...Array(1535).fill(0), Number.NaN],
        6,
      ),
    ).rejects.toThrow("finite");
    await expect(
      createRepository(client).getActiveChunks(Array(1536).fill(0), 0),
    ).rejects.toThrow("positive");
  });

  test("validates write payloads before RPC", async () => {
    const calls: unknown[] = [];
    const client = {
      rpc: async (name: string, args: unknown) => {
        calls.push([name, args]);
        return { data: [{ id: "s1" }], error: null };
      },
    };
    const repository = createRepository(client);
    await expect(
      repository.insertChunks({
        sourceId: "s",
        snapshotId: "x",
        content: "c",
        embedding: [Number.POSITIVE_INFINITY],
      }),
    ).rejects.toThrow("finite");
    await expect(
      repository.activateSnapshot("missing"),
    ).resolves.toBeUndefined();
    expect(calls).toEqual([
      ["activate_snapshot", { p_snapshot_id: "missing" }],
    ]);
  });
});
