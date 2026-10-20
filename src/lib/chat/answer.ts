import type { RetrievedChunk } from "../db/types";
import { classifyQuestion, UNKNOWN_RESPONSE } from "../policy/answer-policy";
export type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "citations"; citations: RetrievedChunk[] }
  | { type: "done" }
  | { type: "error"; message: string };
export async function* streamGroundedAnswer(input: {
  question: string;
  evidence: RetrievedChunk[];
}): AsyncIterable<ChatEvent> {
  const policy = classifyQuestion(input.question);
  if (policy.response) {
    yield { type: "delta", text: policy.response };
    yield { type: "done" };
    return;
  }
  if (!input.evidence.length) {
    yield { type: "delta", text: UNKNOWN_RESPONSE };
    yield { type: "done" };
    return;
  }
  yield { type: "delta", text: input.evidence[0].text };
  yield {
    type: "citations",
    citations: input.evidence.filter((x) => x.url && x.title && x.sourceId),
  };
  yield { type: "done" };
}
