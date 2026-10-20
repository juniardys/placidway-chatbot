import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ChatMessage } from "./types";
import { CHATBOT_SYSTEM_PROMPT, UNKNOWN_RESPONSE } from "../constants";
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
  question: string;
  history: ChatMessage[];
  signal?: AbortSignal;
}): AsyncGenerator<AgentRunEvent> {
  if (!input.model.bindTools) throw new Error("Model does not support tools");
  const modelWithTool = input.model.bindTools([input.tool]);
  const conversation = [
    ...input.history.map((message) =>
      message.role === "assistant" ? new AIMessage(message.content) : new HumanMessage(message.content),
    ),
    new HumanMessage(input.question),
  ];
  const decision = (await modelWithTool.invoke([
    new SystemMessage(`${CHATBOT_SYSTEM_PROMPT}\nUse search_placidway_knowledge for PlacidWay factual questions. Use at most one tool call.`),
    ...conversation,
  ], { signal: input.signal })) as AIMessage;
  const calls = decision.tool_calls ?? [];
  if (!calls.length) {
    yield { type: "answer_start" };
    yield { type: "delta", text: textContent(decision.content) };
    return;
  }
  const call = calls[0];
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
    yield { type: "delta", text: UNKNOWN_RESPONSE };
    return;
  }
  // Keep only the call we executed so every tool_call id has a matching ToolMessage.
  const toolCallId = call.id ?? "retrieval";
  const stream = await input.model.stream([
    new SystemMessage(`${CHATBOT_SYSTEM_PROMPT}\nAnswer only from the approved evidence returned by the tool.`),
    ...conversation,
    new AIMessage({ content: "", tool_calls: [{ ...call, id: toolCallId }] }),
    new ToolMessage({
      tool_call_id: toolCallId,
      name: input.tool.name,
      content: evidence.map((item) => `[${item.title}]\n${item.content}`).join("\n\n"),
    }),
  ], { signal: input.signal });
  for await (const chunk of stream) yield { type: "delta", text: textContent(chunk.content as AIMessage["content"]) };
  // One citation per source page; never send retrieved chunk text to the browser.
  const cited = new Set<string>();
  for (const { sourceId, title, url, section } of evidence) {
    if (cited.has(url)) continue;
    cited.add(url);
    yield { type: "citation", citation: { sourceId, title, url, section } };
  }
}

function textContent(content: AIMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => (typeof part === "object" && part && "text" in part && typeof part.text === "string" ? part.text : ""))
    .join("");
}
