import { describe, expect, test } from "vitest";
import { retrieveEvidence } from "../../src/lib/retrieval/retrieve";

const chunk = (
  id: string,
  similarity: number,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  sourceId: "source",
  title: "Title",
  url: "https://example.com/page",
  content: "Evidence",
  similarity,
  ...overrides,
});
const embedding = () => Array.from({ length: 1536 }, () => 0.1);

describe("evidence retrieval gate", () => {
  test("bounds question and history to 10 messages and 4000 characters", async () => {
    let prompt = "";
    await retrieveEvidence(
      "q".repeat(2000),
      Array.from({ length: 11 }, (_, i) => ({
        role: "user" as const,
        content: `${i}:${"h".repeat(5000)}`,
      })),
      {
        embed: async (value) => {
          prompt = value;
          return embedding();
        },
        retrieve: async () => [],
      },
    );
    expect(prompt).not.toMatch(/(?:^|\n)user: 0:/);
    expect(prompt).toContain("1:" + "h".repeat(3998));
    expect(prompt).not.toContain("h".repeat(4001));
    expect(prompt).toContain("q".repeat(1000));
    expect(prompt).not.toContain("q".repeat(1001));
  });

  test("requires finite 1536-dimensional embedding", async () => {
    let called = false;
    expect(
      await retrieveEvidence("q", [], {
        embed: async () => [NaN],
        retrieve: async () => {
          called = true;
          return [];
        },
      }),
    ).toEqual([]);
    expect(called).toBe(false);
  });

  test("uses configured positive integer top-k and threshold", async () => {
    let limit = 0;
    const result = await retrieveEvidence("q", [], {
      embed: async () => embedding(),
      limit: 3,
      minScore: 0.8,
      retrieve: async (_, value) => {
        limit = value;
        return [chunk("high", 0.8), chunk("low", 0.79)];
      },
    });
    expect(limit).toBe(3);
    expect(result.map((item) => item.id)).toEqual(["high"]);
  });

  test("rejects invalid limit and malformed metadata", async () => {
    let called = false;
    expect(
      await retrieveEvidence("q", [], {
        embed: async () => embedding(),
        limit: 0,
        retrieve: async () => {
          called = true;
          return [];
        },
      }),
    ).toEqual([]);
    expect(called).toBe(false);
    const result = await retrieveEvidence("q", [], {
      embed: async () => embedding(),
      retrieve: async () => [
        chunk("space", 0.9, { title: " " }),
        chunk("url", 0.9, { url: "ftp://example.com" }),
        chunk("bad", 0.9, { url: "not url" }),
      ],
    });
    expect(result).toEqual([]);
  });

  test("rejects scores outside range and keeps stable ordering", async () => {
    const result = await retrieveEvidence("q", [], {
      embed: async () => embedding(),
      retrieve: async () => [
        chunk("z", 0.9),
        chunk("a", 0.9),
        chunk("negative", -0.1),
        chunk("over", 1.1),
        chunk("nan", NaN),
      ],
    });
    expect(result.map((item) => item.id)).toEqual(["a", "z"]);
  });

  test("returns empty evidence for provider and repository errors", async () => {
    await expect(
      retrieveEvidence("q", [], {
        embed: async () => {
          throw new Error("provider secret");
        },
        retrieve: async () => [],
      }),
    ).resolves.toEqual([]);
    await expect(
      retrieveEvidence("q", [], {
        embed: async () => embedding(),
        retrieve: async () => {
          throw new Error("repository secret");
        },
      }),
    ).resolves.toEqual([]);
  });
});
