import { expect, test } from "vitest";
import { isAgentEvent, type ToolEvidence } from "../../src/lib/agent/types";

test("accepts safe agent activity events", () => {
  expect(isAgentEvent({ type: "thinking", message: "Searching" })).toBe(true);
  expect(isAgentEvent({ type: "tool_result", sources: 2, chunks: 4 })).toBe(true);
  expect(isAgentEvent({ type: "delta", text: "Answer" })).toBe(true);
});

test("rejects unsafe or malformed events", () => {
  expect(isAgentEvent({ type: "chain_of_thought", text: "secret" })).toBe(false);
  expect(isAgentEvent({ type: "tool_result", sources: -1, chunks: 1 })).toBe(false);
});

const evidence: ToolEvidence = {
  sourceId: "source",
  title: "Title",
  url: "https://example.com",
  section: "Intro",
  content: "Facts",
  similarity: 0.9,
};
expect(evidence.sourceId).toBe("source");
