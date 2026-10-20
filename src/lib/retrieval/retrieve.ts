import type { RetrievedChunk } from "../db/types";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function retrieveEvidence(
  question: string,
  history: ChatMessage[],
  deps: {
    embed: (text: string) => Promise<number[]>;
    retrieve: (v: number[], limit: number) => Promise<RetrievedChunk[]>;
    limit?: number;
    minScore?: number;
  },
): Promise<RetrievedChunk[]> {
  const context = history.slice(-10).map((x) => `${x.role}: ${x.content.slice(0, 4000)}`).join("\n");
  const chunks = await deps.retrieve(await deps.embed(`${context}\nuser: ${question}`), deps.limit ?? 6);
  const threshold = deps.minScore ?? 0.72;
  return chunks.filter((chunk) => Number.isFinite(chunk.score) && chunk.score >= threshold &&
    /^https?:\/\//.test(chunk.url) && chunk.sourceId.length > 0 && chunk.title.length > 0 && chunk.text.length > 0);
}
