import type { RetrievedChunk } from "../db/types";
import {
  MAX_HISTORY_CONTENT_LENGTH,
  MAX_HISTORY_MESSAGES,
  MAX_QUESTION_LENGTH,
  RETRIEVAL_MIN_SCORE,
  RETRIEVAL_TOP_K,
} from "../constants";

const EMBEDDING_DIMENSIONS = 1536;

export type ChatMessage = { role: "user" | "assistant"; content: string };

type RetrievalDeps = {
  embed: (text: string) => Promise<number[]>;
  retrieve: (embedding: number[], limit: number) => Promise<RetrievedChunk[]>;
  limit?: number;
  minScore?: number;
};

function isRetrievedChunk(value: unknown): value is RetrievedChunk {
  if (!value || typeof value !== "object") return false;
  const chunk = value as Partial<RetrievedChunk>;
  let validUrl = false;
  if (typeof chunk.url === "string") {
    try {
      const url = new URL(chunk.url);
      validUrl = url.protocol === "http:" || url.protocol === "https:";
    } catch { /* malformed URL */ }
  }
  return typeof chunk.id === "string" && chunk.id.trim().length > 0 &&
    typeof chunk.sourceId === "string" && chunk.sourceId.trim().length > 0 &&
    typeof chunk.title === "string" && chunk.title.trim().length > 0 &&
    validUrl && typeof chunk.content === "string" && chunk.content.trim().length > 0 &&
    typeof chunk.similarity === "number" && Number.isFinite(chunk.similarity) &&
    chunk.similarity >= 0 && chunk.similarity <= 1;
}

export async function retrieveEvidence(
  question: string,
  history: ChatMessage[],
  deps: RetrievalDeps,
): Promise<RetrievedChunk[]> {
  try {
    const limit = deps.limit ?? RETRIEVAL_TOP_K;
    if (!Number.isInteger(limit) || limit <= 0) return [];
    const boundedQuestion = question.slice(0, MAX_QUESTION_LENGTH);
    const context = history.slice(-MAX_HISTORY_MESSAGES)
      .map((message) => `${message.role}: ${message.content.slice(0, MAX_HISTORY_CONTENT_LENGTH)}`)
      .join("\n");
    const embedding = await deps.embed(`${context}\nuser: ${boundedQuestion}`);
    if (embedding.length !== EMBEDDING_DIMENSIONS || embedding.some((value) => !Number.isFinite(value))) return [];

    const chunks = await deps.retrieve(embedding, limit);
    const threshold = deps.minScore ?? RETRIEVAL_MIN_SCORE;
    return chunks.filter((chunk) => isRetrievedChunk(chunk) && chunk.similarity >= threshold)
      .sort((left, right) => right.similarity - left.similarity || left.id.localeCompare(right.id));
  } catch {
    return [];
  }
}
