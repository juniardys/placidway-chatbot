import { describe, expect, test } from "vitest";
import { retrieveEvidence } from "../../src/lib/retrieval/retrieve";

describe("retrieveEvidence", () => {
  test("filters low-score and malformed citation rows", async () => {
    const result = await retrieveEvidence("price", [], {
      embed: async () => Array(1536).fill(0),
      retrieve: async () => [
        { id: "good", text: "yes", sourceId: "s", title: "T", url: "https://x.test", score: 0.8 },
        { id: "low", text: "no", sourceId: "s", title: "T", url: "https://x.test", score: 0.2 },
        { id: "bad", text: "no", sourceId: "s", title: "T", url: "not-url", score: 0.9 },
      ],
    });
    expect(result.map((x) => x.id)).toEqual(["good"]);
  });
});
