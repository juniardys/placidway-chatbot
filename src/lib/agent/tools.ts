import { RETRIEVAL_TOP_K } from "../constants";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { RetrievedChunk } from "../db/types";
import type { ToolEvidence } from "./types";

export type SearchToolDeps = {
  embed: (query: string) => Promise<number[]>;
  retrieve: (embedding: number[], limit: number) => Promise<RetrievedChunk[]>;
};

const MAX_QUERY_LENGTH = 500;
const MAX_RESULTS = RETRIEVAL_TOP_K;

export function createPlacidWaySearchTool(deps: SearchToolDeps) {
  return new DynamicStructuredTool({
    name: "search_placidway_knowledge",
    description: "Search approved PlacidWay content for factual treatment, clinic, package, pricing, and appointment information. Use this tool before answering PlacidWay factual questions.",
    schema: z.object({ query: z.string().trim().min(1).max(MAX_QUERY_LENGTH) }),
    func: async ({ query }) => {
      const embedding = await deps.embed(query);
      if (embedding.length !== 1536 || embedding.some((value) => !Number.isFinite(value)))
        throw new Error("Invalid query embedding");
      const chunks = await deps.retrieve(embedding, MAX_RESULTS);
      const evidence: ToolEvidence[] = chunks.slice(0, MAX_RESULTS).map((chunk) => ({
        sourceId: chunk.sourceId,
        title: chunk.title,
        url: chunk.url,
        section: chunk.section,
        content: chunk.content.slice(0, 4000),
        similarity: chunk.similarity,
      }));
      return JSON.stringify({ sources: new Set(evidence.map((item) => item.sourceId)).size, chunks: evidence.length, evidence });
    },
  });
}
