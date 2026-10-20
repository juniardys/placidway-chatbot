import { expect, test } from "vitest";
import { streamAgentAnswer, type AgentRunEvent } from "../../src/lib/agent/chat-agent";

async function collect(run: () => AsyncIterable<AgentRunEvent>) {
  const events = [];
  for await (const event of streamAgentAnswer({ question: "What treatments are available?", history: [], run })) events.push(event);
  return events;
}

test("streams grounded answer after one retrieval call", async () => {
  const events = await collect(async function* () {
    yield { type: "tool_start", tool: "search_placidway_knowledge", query: "treatments" };
    yield { type: "tool_result", sources: 1, chunks: 2 };
    yield { type: "answer_start" };
    yield { type: "delta", text: "Treatment " };
    yield { type: "delta", text: "facts" };
  });
  expect(events.map((event) => event.type)).toEqual(["thinking", "tool_start", "tool_result", "answer_start", "delta", "delta", "done"]);
});

test("streams answer without retrieval when model decides tool is unnecessary", async () => {
  const events = await collect(async function* () {
    yield { type: "answer_start" };
    yield { type: "delta", text: "Hello" };
  });
  expect(events.map((event) => event.type)).toEqual(["thinking", "answer_start", "delta", "done"]);
});

test("forwards stage events before the run finishes", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const iterator = streamAgentAnswer({
    question: "What treatments?",
    history: [],
    run: async function* () {
      yield { type: "tool_start", tool: "search_placidway_knowledge", query: "treatments" };
      await gate;
      yield { type: "answer_start" };
      yield { type: "delta", text: "Done" };
    },
  });
  expect((await iterator.next()).value?.type).toBe("thinking");
  expect((await iterator.next()).value?.type).toBe("tool_start");
  release();
  const rest = [];
  for await (const event of iterator) rest.push(event.type);
  expect(rest).toEqual(["answer_start", "delta", "done"]);
});

test("reports an error when the run produces no answer text", async () => {
  const events = await collect(async function* () {
    yield { type: "answer_start" };
    yield { type: "delta", text: "   " };
  });
  expect(events.at(-1)).toEqual({ type: "error", message: "Unable to generate an answer" });
});

test("emits done after agent failure so UI stops loading", async () => {
  const events = await collect(async function* () {
    throw new Error("provider failed");
  });
  expect(events.at(-1)?.type).toBe("done");
});
