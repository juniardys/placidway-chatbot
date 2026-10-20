import { HumanMessage, SystemMessage, AIMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ChatMessage } from "./types";
import {
  CHATBOT_SYSTEM_PROMPT,
  GROUNDED_ANSWER_INSTRUCTION,
  NO_ANSWER_MARKER,
  NO_EVIDENCE_INSTRUCTION,
  PARTIAL_ANSWER_MARKER,
  QUOTE_OFFER_INSTRUCTION,
  QUOTE_SUGGESTION,
  SEARCH_INSTRUCTION,
  STYLE_INSTRUCTION,
  UNKNOWN_RESPONSE,
} from "../constants";
import type { AgentEvent, ToolEvidence } from "./types";
import type { StructuredTool } from "@langchain/core/tools";

/** Events a run emits between the wrapper's opening "thinking" and closing "done". */
export type AgentRunEvent = Exclude<AgentEvent, { type: "thinking" } | { type: "done" }>;
export type AgentInput = { question: string; history: ChatMessage[]; run: () => AsyncIterable<AgentRunEvent> };

export async function* streamAgentAnswer(input: AgentInput): AsyncGenerator<AgentEvent> {
  yield { type: "thinking", message: "Understood question" };
  try {
    let answered = false;
    for await (const event of input.run()) {
      if (event.type === "error") {
        yield event;
        return;
      }
      if (event.type === "delta") {
        if (!event.text) continue;
        answered ||= Boolean(event.text.trim());
      }
      yield event;
    }
    if (!answered) {
      yield { type: "error", message: "Unable to generate an answer" };
      return;
    }
    yield { type: "done" };
  } catch (error) {
    console.error("[agent] execution failed", error instanceof Error ? error.message : "unknown");
    yield { type: "error", message: "Unable to generate an answer" };
    yield { type: "done" };
  }
}

/**
 * Runs the tool-calling agent and yields each stage as it happens, so the
 * client sees the search start/finish live and the final answer token by token.
 */
export async function* decideAndAnswer(input: {
  model: BaseChatModel;
  tool: StructuredTool;
  quoteTool?: StructuredTool;
  question: string;
  history: ChatMessage[];
  signal?: AbortSignal;
}): AsyncGenerator<AgentRunEvent> {
  if (!input.model.bindTools) throw new Error("Model does not support tools");
  const tools = input.quoteTool ? [input.tool, input.quoteTool] : [input.tool];
  const modelWithTool = input.model.bindTools(tools);
  const conversation = [
    ...input.history.map((message) =>
      message.role === "assistant" ? new AIMessage(message.content) : new HumanMessage(message.content),
    ),
    new HumanMessage(input.question),
  ];
  const decision = (await modelWithTool.invoke([
    systemMessage(SEARCH_INSTRUCTION),
    ...conversation,
  ], { signal: input.signal })) as AIMessage;
  const calls = decision.tool_calls ?? [];
  if (!calls.length) {
    yield { type: "answer_start" };
    yield { type: "delta", text: textContent(decision.content) };
    return;
  }
  const call = calls[0];
  const reply = (instruction: string) =>
    streamText(input.model, [systemMessage(instruction), ...conversation], input.signal);
  if (input.quoteTool && call.name === input.quoteTool.name) {
    yield { type: "lead_offer" };
    yield { type: "answer_start" };
    // A worked example holds the tone better than instructions alone for this short reply.
    const example = [
      new HumanMessage("Can I book a consultation for next week?"),
      new AIMessage("I'm sorry, but I can't book appointments. If you leave your name and email in the form below, PlacidWay can contact you with a free quote."),
    ];
    yield* withFallback(
      streamText(input.model, [systemMessage(QUOTE_OFFER_INSTRUCTION), ...example, ...conversation], input.signal),
      QUOTE_SUGGESTION,
    );
    return;
  }
  const query = typeof call.args?.query === "string" ? call.args.query : input.question;
  yield { type: "tool_start", tool: "search_placidway_knowledge", query };
  const raw = await input.tool.invoke(call.args);
  const parsed = JSON.parse(typeof raw === "string" ? raw : String(raw)) as { evidence?: ToolEvidence[]; sources?: number; chunks?: number };
  const evidence = parsed.evidence ?? [];
  yield {
    type: "tool_result",
    sources: parsed.sources ?? new Set(evidence.map((item) => item.sourceId)).size,
    chunks: parsed.chunks ?? evidence.length,
  };
  yield { type: "answer_start" };
  if (!evidence.length) {
    yield { type: "unanswered" };
    if (input.quoteTool) yield { type: "lead_offer" };
    yield* withFallback(reply(NO_EVIDENCE_INSTRUCTION), UNKNOWN_RESPONSE);
    return;
  }
  // Keep only the call we executed so every tool_call id has a matching ToolMessage.
  const toolCallId = call.id ?? "retrieval";
  const answer = streamText(input.model, [
    systemMessage(GROUNDED_ANSWER_INSTRUCTION),
    ...conversation,
    new AIMessage({ content: "", tool_calls: [{ ...call, id: toolCallId }] }),
    new ToolMessage({
      tool_call_id: toolCallId,
      name: input.tool.name,
      content: evidence.map((item) => `[${item.title}]\n${item.content}`).join("\n\n"),
    }),
  ], input.signal);
  let gap: "none" | "partial" | "full" = "none";
  let text = "";
  for await (const event of stripGapMarker(answer)) {
    if (event.type === "unanswered") {
      gap = event.partial ? "partial" : "full";
      yield event;
      if (input.quoteTool) yield { type: "lead_offer" };
      continue;
    }
    if (event.type === "delta") text += event.text;
    yield event;
  }
  // A "not in the content" reply has nothing to cite.
  if (gap === "full") return;
  // One citation per source page the answer drew on; never send chunk text to the browser.
  for (const { sourceId, title, url, section } of selectCitedSources(text, evidence))
    yield { type: "citation", citation: { sourceId, title, url, section } };
}

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/(\d),(?=\d{3})/g, "$1")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 4 || /\d/.test(token));

/**
 * Picks the source pages an answer actually used: a page is cited when the
 * answer contains a word or number found in that page's title, or in its
 * evidence, but not in any other retrieved page's. Falls back to every
 * retrieved page when nothing is distinctive (e.g. a translated answer).
 */
export function selectCitedSources(answer: string, evidence: ToolEvidence[]): ToolEvidence[] {
  const pages = new Map<string, { first: ToolEvidence; title: Set<string>; content: Set<string> }>();
  for (const item of evidence) {
    const page = pages.get(item.url) ?? { first: item, title: new Set(tokenize(item.title)), content: new Set<string>() };
    for (const token of tokenize(`${item.title} ${item.content}`)) page.content.add(token);
    pages.set(item.url, page);
  }
  const all = [...pages.values()];
  if (all.length <= 1) return all.map((page) => page.first);
  const answerTokens = new Set(tokenize(answer));
  const distinctiveMatch = (page: (typeof all)[number], key: "title" | "content") =>
    [...page[key]].some(
      (token) => answerTokens.has(token) && all.every((other) => other === page || !other[key].has(token)),
    );
  const used = all.filter((page) => distinctiveMatch(page, "title") || distinctiveMatch(page, "content"));
  return (used.length ? used : all).map((page) => page.first);
}

/** Base prompt, then the step's instruction, then style last so it is not diluted. */
function systemMessage(instruction: string) {
  return new SystemMessage(`${CHATBOT_SYSTEM_PROMPT}\n${instruction}\n${STYLE_INSTRUCTION}`);
}

async function* streamText(
  model: BaseChatModel,
  messages: BaseMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const stream = await model.stream(messages, { signal });
  for await (const chunk of stream) yield textContent(chunk.content as AIMessage["content"]);
}

async function* withFallback(text: AsyncIterable<string>, fallback: string): AsyncGenerator<AgentRunEvent> {
  let produced = false;
  for await (const part of text) {
    if (!part) continue;
    produced ||= Boolean(part.trim());
    yield { type: "delta", text: part };
  }
  if (!produced) yield { type: "delta", text: fallback };
}

const GAP_MARKERS = [
  { marker: NO_ANSWER_MARKER, partial: false },
  { marker: PARTIAL_ANSWER_MARKER, partial: true },
];

/**
 * Holds back the opening tokens until they either spell a gap marker (emits
 * "unanswered" and drops the marker) or diverge from every marker (flushes as text).
 */
export async function* stripGapMarker(text: AsyncIterable<string>): AsyncGenerator<AgentRunEvent> {
  let head = "";
  let decided = false;
  // After a stripped marker, drop whitespace until the reply's first real text.
  let trimLead = false;
  for await (const part of text) {
    if (decided) {
      const value = trimLead ? part.trimStart() : part;
      if (value) {
        trimLead = false;
        yield { type: "delta", text: value };
      }
      continue;
    }
    head += part;
    const trimmed = head.trimStart();
    const found = GAP_MARKERS.find(({ marker }) => trimmed.startsWith(marker));
    if (found) {
      decided = true;
      yield found.partial ? { type: "unanswered", partial: true } : { type: "unanswered" };
      const rest = trimmed.slice(found.marker.length).trimStart();
      if (rest) yield { type: "delta", text: rest };
      else trimLead = true;
    } else if (!GAP_MARKERS.some(({ marker }) => marker.startsWith(trimmed))) {
      decided = true;
      yield { type: "delta", text: head };
    }
  }
  if (!decided && head.trim()) yield { type: "delta", text: head };
}

function textContent(content: AIMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => (typeof part === "object" && part && "text" in part && typeof part.text === "string" ? part.text : ""))
    .join("");
}
