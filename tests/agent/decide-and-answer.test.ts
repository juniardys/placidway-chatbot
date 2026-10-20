import { describe, expect, test } from "vitest";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { decideAndAnswer, selectCitedSources, stripGapMarker, type AgentRunEvent } from "../../src/lib/agent/chat-agent";
import { createQuoteRequestTool } from "../../src/lib/agent/tools";
import { NO_ANSWER_MARKER, PARTIAL_ANSWER_MARKER } from "../../src/lib/constants";

function fakeModel(decision: AIMessage, streamed: string[]) {
  const model = {
    bindTools: () => ({ invoke: async () => decision }),
    stream: async () =>
      (async function* () {
        for (const text of streamed) yield new AIMessageChunk(text);
      })(),
  };
  return model as unknown as BaseChatModel;
}

function searchTool(evidence: unknown[]) {
  return new DynamicStructuredTool({
    name: "search_placidway_knowledge",
    description: "test",
    schema: z.object({ query: z.string() }),
    func: async () => JSON.stringify({ sources: evidence.length, chunks: evidence.length, evidence }),
  });
}

const evidence = [{ sourceId: "s1", title: "Page", url: "https://www.placidway.com/a", content: "Price USD 100", similarity: 0.9 }];
const searchCall = (query: string) =>
  new AIMessage({ content: "", tool_calls: [{ name: "search_placidway_knowledge", args: { query }, id: "c1" }] });

async function collect(run: AsyncIterable<AgentRunEvent>) {
  const events: AgentRunEvent[] = [];
  for await (const event of run) events.push(event);
  return events;
}
const text = (events: AgentRunEvent[]) => events.flatMap((event) => (event.type === "delta" ? [event.text] : [])).join("");

describe("decideAndAnswer", () => {
  test("streams grounded answer with citations", async () => {
    const events = await collect(decideAndAnswer({
      model: fakeModel(searchCall("price"), ["Starting from ", "USD 100"]),
      tool: searchTool(evidence),
      quoteTool: createQuoteRequestTool(),
      question: "price?",
      history: [],
    }));
    expect(text(events)).toBe("Starting from USD 100");
    expect(events.some((event) => event.type === "citation")).toBe(true);
    expect(events.some((event) => event.type === "unanswered")).toBe(false);
  });

  test("flags unanswered, offers quote, and drops citations when evidence lacks the answer", async () => {
    const events = await collect(decideAndAnswer({
      model: fakeModel(searchCall("visa"), ["[[NO_", "ANSWER]] Not in ", "the content."]),
      tool: searchTool(evidence),
      quoteTool: createQuoteRequestTool(),
      question: "visa?",
      history: [],
    }));
    expect(text(events)).toBe("Not in the content.");
    expect(events.map((event) => event.type)).toContain("unanswered");
    expect(events.map((event) => event.type)).toContain("lead_offer");
    expect(events.some((event) => event.type === "citation")).toBe(false);
  });

  test("flags unanswered and answers in model language when search finds nothing", async () => {
    const events = await collect(decideAndAnswer({
      model: fakeModel(searchCall("x"), ["No encontré esa información."]),
      tool: searchTool([]),
      quoteTool: createQuoteRequestTool(),
      question: "¿x?",
      history: [],
    }));
    expect(events.map((event) => event.type)).toEqual(["tool_start", "tool_result", "answer_start", "unanswered", "lead_offer", "delta"]);
    expect(text(events)).toBe("No encontré esa información.");
  });

  test("offers the lead form when the model requests a quote", async () => {
    const decision = new AIMessage({ content: "", tool_calls: [{ name: "request_free_quote", args: {}, id: "q1" }] });
    const events = await collect(decideAndAnswer({
      model: fakeModel(decision, []),
      tool: searchTool(evidence),
      quoteTool: createQuoteRequestTool(),
      question: "I want a quote",
      history: [],
    }));
    expect(events[0]).toEqual({ type: "lead_offer" });
    expect(events.some((event) => event.type === "tool_start")).toBe(false);
    expect(text(events)).not.toBe("");
  });
});

test("flags partial answers but keeps their citations", async () => {
  const events = await collect(decideAndAnswer({
    model: fakeModel(searchCall("mexico turkey"), [PARTIAL_ANSWER_MARKER, " Mexico costs USD 100. Turkey is not covered."]),
    tool: searchTool(evidence),
    quoteTool: createQuoteRequestTool(),
    question: "Mexico or Turkey?",
    history: [],
  }));
  expect(events).toContainEqual({ type: "unanswered", partial: true });
  expect(text(events)).toBe("Mexico costs USD 100. Turkey is not covered.");
  expect(events.some((event) => event.type === "citation")).toBe(true);
});

describe("selectCitedSources", () => {
  const page = (url: string, title: string, content: string) => ({ sourceId: url, title, url, content, similarity: 0.8 });
  const adeno = page("https://p/adeno", "Adenocarcinoma Package", "Out-patient $18,995 USD. In-patient $30,000 USD.");
  const adrenal = page("https://p/adrenal", "Adrenal Package", "Out-patient $18,995 USD. In-patient $30,000 USD.");
  const ozone = page("https://p/pricing", "Pricing", "Ozone Therapy, Konya, Turkey from $110.");
  test("cites only pages with words or numbers distinctive to them", () => {
    expect(selectCitedSources("The Adenocarcinoma package costs $18,995 USD.", [adeno, adrenal]).map((item) => item.url)).toEqual(["https://p/adeno"]);
    expect(selectCitedSources("Adenocarcinoma: $18,995. Ozone in Konya: $110.", [adeno, adrenal, ozone]).map((item) => item.url)).toEqual(["https://p/adeno", "https://p/pricing"]);
  });
  test("uses distinctive title words when page bodies cross-link each other", () => {
    const linked = [adeno, adrenal].map((item) => ({ ...item, content: `${item.content} See Adenocarcinoma and Adrenal packages.` }));
    expect(selectCitedSources("Adenocarcinoma: programa ambulatorio $18,995 USD.", linked).map((item) => item.url)).toEqual(["https://p/adeno"]);
  });
  test("falls back to every page when nothing is distinctive", () => {
    expect(selectCitedSources("السعر 18,995 دولار", [adeno, adrenal])).toHaveLength(2);
  });
  test("collapses chunks from the same page", () => {
    expect(selectCitedSources("anything", [adeno, { ...adeno, content: "More" }])).toHaveLength(1);
  });
});

describe("stripGapMarker", () => {
  async function* parts(...values: string[]) {
    yield* values;
  }
  test("passes normal text through unchanged", async () => {
    expect(text(await collect(stripGapMarker(parts("[Clinic] ", "info"))))).toBe("[Clinic] info");
  });
  test("passes short text that is a marker prefix", async () => {
    expect(text(await collect(stripGapMarker(parts("[["))))).toBe("[[");
  });
  test("strips the marker split across chunks", async () => {
    const events = await collect(stripGapMarker(parts(" ", NO_ANSWER_MARKER.slice(0, 4), NO_ANSWER_MARKER.slice(4), " Sorry")));
    expect(events).toEqual([{ type: "unanswered" }, { type: "delta", text: "Sorry" }]);
  });
});
