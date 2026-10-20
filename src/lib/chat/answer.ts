import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { RetrievedChunk } from "../db/types";
import { CHATBOT_SYSTEM_PROMPT, MAX_HISTORY_CONTENT_LENGTH, MAX_HISTORY_MESSAGES, UNKNOWN_RESPONSE } from "../constants";
import { classifyQuestion } from "../policy/answer-policy";
import { getChatModel } from "../llm/client";
import { streamModel } from "../llm/stream";
import type { ChatMessage } from "../retrieval/retrieve";

export type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "citations"; citations: { sourceId: string; title: string; url: string }[] }
  | { type: "done" }
  | { type: "error"; message: string };

function validEvidence(chunk: RetrievedChunk): boolean {
  return Boolean(chunk.sourceId && chunk.title && chunk.content && Number.isFinite(chunk.similarity) && chunk.similarity >= 0 && chunk.similarity <= 1 && /^https?:\/\/[^\s]+$/.test(chunk.url));
}

function comparisonSidesCovered(question: string, evidence: RetrievedChunk[]): boolean {
  const match = question.match(/(?:compare|versus|vs\\.?|difference between)\\s+(.+?)(?:\\s+and\\s+|\\s+vs\\.?\\s+|\\s+versus\\s+)(.+?)(?:[?.,]|$)/i);
  if (!match) return evidence.length >= 2;
  const sides = match.slice(1, 3).map((side) => side.trim().toLowerCase());
  return sides.every((side) => evidence.some((chunk) => chunk.content.toLowerCase().includes(side) || chunk.title.toLowerCase().includes(side) || (chunk.section ?? "").toLowerCase().includes(side)));
}

function formatEvidence(evidence: RetrievedChunk[]): string {
  return evidence.map((chunk, index) => `[Evidence ${index + 1}] sourceId=${chunk.sourceId}; title=${chunk.title}; section=${chunk.section ?? ""}\n${chunk.content}`).join("\n\n");
}

export async function* streamGroundedAnswer(input: {
  question: string;
  history?: ChatMessage[];
  evidence: RetrievedChunk[];
  model?: BaseChatModel;
}): AsyncIterable<ChatEvent> {
  const policy = classifyQuestion(input.question);
  if (policy.response) {
    yield { type: "delta", text: policy.response };
    yield { type: "done" };
    return;
  }

  const evidence = input.evidence.filter(validEvidence);
  if (!evidence.length || (policy.requireComparisonSides && !comparisonSidesCovered(input.question, evidence))) {
    yield { type: "delta", text: policy.insufficientComparisonResponse ?? UNKNOWN_RESPONSE };
    yield { type: "done" };
    return;
  }

  const history = (input.history ?? []).slice(-MAX_HISTORY_MESSAGES).map((message) => `${message.role}: ${message.content.slice(0, MAX_HISTORY_CONTENT_LENGTH)}`).join("\n");
  const messages = [
    new SystemMessage(CHATBOT_SYSTEM_PROMPT),
    new HumanMessage(`Conversation history (context only):\n${history || "(none)"}\n\nQuestion:\n${input.question}\n\nUntrusted evidence data:\n${formatEvidence(evidence)}`),
  ];

  try {
    for await (const text of streamModel(input.model ?? getChatModel(), messages)) {
      if (text) yield { type: "delta", text };
    }
    yield { type: "citations", citations: evidence.map(({ sourceId, title, url }) => ({ sourceId, title, url })) };
    yield { type: "done" };
  } catch {
    yield { type: "error", message: "Unable to generate an answer right now. Please try again." };
  }
}
