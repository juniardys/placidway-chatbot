import { describe, expect, test } from "vitest";
import { createRepository } from "../../src/lib/db/repositories";

describe("repository", () => {
  test("retrieves through vector RPC instead of scanning the chunk table", async () => {
    const calls: unknown[] = [];
    const client = {
      from: (table: string) => {
        calls.push(["from", table]);
        throw new Error("table scan not expected");
      },
      rpc: async (name: string) => {
        calls.push(["rpc", name]);
        return { data: [], error: null };
      },
    };
    await createRepository(client as any).getActiveChunks(Array(1536).fill(0.1), 6);
    expect(calls).toEqual([["rpc", "match_knowledge_chunks"]]);
  });

  test("stages new snapshot inactive, then activates it before retiring the old one", async () => {
    const calls: string[] = [];
    const builder = (table: string, op: string, result: unknown = { data: null, error: null }) => {
      calls.push(`${op} ${table}`);
      const chain: any = {
        select: () => chain,
        single: () => chain,
        eq: () => chain,
        neq: () => chain,
        then: (resolve: (value: unknown) => void) => resolve(result),
      };
      return chain;
    };
    const client = {
      rpc: async () => ({ data: null, error: null }),
      from: (table: string) => ({
        upsert: () => builder(table, "upsert"),
        insert: (row: any) =>
          builder(table, Array.isArray(row) ? `insert(active=${row[0].active})` : `insert(active=${row.active})`, {
            data: { id: "snap-1" },
            error: null,
          }),
        update: (values: any) => builder(table, `update(active=${values.active})`),
        delete: () => builder(table, "delete"),
      }),
    };
    await createRepository(client as any).refreshAtomically([
      {
        sourceId: "s1",
        title: "T",
        url: "https://example.com",
        pageType: "content",
        rawContent: "raw",
        normalizedMarkdown: "md",
        contentHash: "h",
        chunks: [{ content: "c", embedding: Array(1536).fill(0.1), section: "S", contentHash: "h" }],
      },
    ]);
    expect(calls).toEqual([
      "upsert knowledge_sources",
      "insert(active=false) knowledge_snapshots",
      "insert(active=false) knowledge_chunks",
      "update(active=true) knowledge_chunks",
      "update(active=true) knowledge_snapshots",
      "update(active=false) knowledge_chunks",
      "update(active=false) knowledge_snapshots",
      "update(active=undefined) knowledge_sources",
      "delete knowledge_chunks",
      "delete knowledge_snapshots",
    ]);
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
      expect.objectContaining({ match_count: 6, match_threshold: 0.5 }),
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
});
