import type { RetrievedChunk } from "../db/types";
export async function retrieveEvidence(
  question: string,
  history: { role: string; content: string }[],
  deps: {
    embed: (text: string) => Promise<number[]>;
    retrieve: (v: number[], limit: number) => Promise<RetrievedChunk[]>;
    limit?: number;
  },
) {
  const context = history
    .slice(-10)
    .map((x) => x.content)
    .join("\n");
  return deps.retrieve(
    await deps.embed(`${context}\n${question}`),
    deps.limit ?? 6,
  );
}
