import type { RetrievedChunk } from "../db/types";
import { classifyQuestion, UNKNOWN_RESPONSE } from "../policy/answer-policy";
export type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "citations"; citations: RetrievedChunk[] }
  | { type: "done" }
  | { type: "error"; message: string };
function validCitation(chunk: RetrievedChunk) { return chunk.sourceId.length > 0 && chunk.title.length > 0 && chunk.content.length > 0 && /^https?:\/\/[^\s]+$/.test(chunk.url); }
export async function* streamGroundedAnswer(input: { question: string; evidence: RetrievedChunk[] }): AsyncIterable<ChatEvent> {
  const policy = classifyQuestion(input.question);
  if (policy.response) { yield { type: "delta", text: policy.response }; yield { type: "done" }; return; }
  const evidence = input.evidence.filter(validCitation);
  if (!evidence.length || (policy.requireComparisonSides && evidence.length < 2)) {
    yield { type: "delta", text: UNKNOWN_RESPONSE }; yield { type: "done" }; return;
  }
  yield { type: "delta", text: evidence.map((chunk) => chunk.content).join("\n\n") };
  yield { type: "citations", citations: evidence };
  yield { type: "done" };
}
