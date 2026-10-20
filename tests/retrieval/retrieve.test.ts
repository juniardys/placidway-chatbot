import { describe, expect, test } from "vitest";
import { retrieveEvidence } from "../../src/lib/retrieval/retrieve";

describe("retrieveEvidence", () => {
  test("filters low-score and malformed citation rows", async () => {
    const result = await retrieveEvidence("price", [], {
      embed: async () => Array(1536).fill(0),
      retrieve: async () => [
        { id: "good", content: "yes", sourceId: "s", title: "T", url: "https://x.test", similarity: 0.8 },
        { id: "low", content: "no", sourceId: "s", title: "T", url: "https://x.test", similarity: 0.2 },
        { id: "bad", content: "no", sourceId: "s", title: "T", url: "not-url", similarity: 0.9 },
      ],
    });
    expect(result.map((x) => x.id)).toEqual(["good"]);
  });
});
