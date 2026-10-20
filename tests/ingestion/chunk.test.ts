import { expect, test } from "vitest";
import { chunkByHeading } from "../../src/lib/ingestion/chunk";
test("chunks retain heading context and split oversized blocks", () => {
  const chunks = chunkByHeading("# Price\n\n" + "x ".repeat(30), 20, {
    sourceId: "s",
    title: "T",
    pageType: "price",
    fetchedAt: "now",
    contentHash: "h",
  });
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every((chunk) => chunk.content.length <= 20)).toBe(true);
  expect(chunks.every((chunk) => chunk.section === "Price")).toBe(true);
  expect(chunks[0].sourceId).toBe("s");
});
