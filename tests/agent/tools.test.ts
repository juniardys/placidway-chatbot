import { expect, test } from "vitest";
import { createPlacidWaySearchTool } from "../../src/lib/agent/tools";

test("retrieval tool returns bounded approved evidence", async () => {
  const tool = createPlacidWaySearchTool({
    embed: async () => Array(1536).fill(1),
    retrieve: async () => [{
      id: "c1", sourceId: "s1", title: "Clinic", url: "https://www.placidway.com/profile/5/x",
      content: "Treatment facts", section: "Overview", similarity: 0.9,
    }],
  });
  const result = JSON.parse(await tool.invoke({ query: "What treatment?" }));
  expect(result).toMatchObject({ sources: 1, chunks: 1 });
  expect(result.evidence[0]).toMatchObject({ sourceId: "s1", title: "Clinic" });
});

test("retrieval tool rejects empty query", async () => {
  const tool = createPlacidWaySearchTool({ embed: async () => [], retrieve: async () => [] });
  await expect(tool.invoke({ query: "" })).rejects.toThrow("query");
});
