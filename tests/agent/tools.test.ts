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

test("retrieval tool adds a few chunks for the user's original wording", async () => {
  const chunk = (id: string, similarity: number) => ({
    id, sourceId: id, title: id, url: `https://www.placidway.com/${id}`, content: id, section: "x", similarity,
  });
  const queries: string[] = [];
  const tool = createPlacidWaySearchTool({
    embed: async (text) => (queries.push(text), Array(1536).fill(queries.length)),
    retrieve: async (vector) =>
      vector[0] === 1 ? [chunk("a", 0.9), chunk("b", 0.8)] : [chunk("b", 0.85), chunk("c", 0.7), chunk("d", 0.6), chunk("e", 0.5)],
    originalQuestion: "Is cancer treatment cheaper in Mexico or Turkey?",
  });
  const result = JSON.parse(await tool.invoke({ query: "Adenocarcinoma price Mexico Turkey" }));
  expect(queries).toHaveLength(2);
  expect(result.evidence.map((item: { sourceId: string }) => item.sourceId)).toEqual(["a", "b", "c", "d"]);
});

test("retrieval tool searches once when the query is the original question", async () => {
  let calls = 0;
  const tool = createPlacidWaySearchTool({
    embed: async () => (calls++, Array(1536).fill(1)),
    retrieve: async () => [],
    originalQuestion: "What treatments?",
  });
  await tool.invoke({ query: "what treatments" });
  expect(calls).toBe(1);
});
