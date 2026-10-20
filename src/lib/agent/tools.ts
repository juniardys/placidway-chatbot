import { RETRIEVAL_TOP_K } from "../constants";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { RetrievedChunk } from "../db/types";
import type { ToolEvidence } from "./types";

export type SearchToolDeps = {
  embed: (query: string) => Promise<number[]>;
  retrieve: (embedding: number[], limit: number) => Promise<RetrievedChunk[]>;
  /**
   * The user's own wording. The model's rewritten query can over-narrow a
   * question (e.g. to a treatment named earlier), so a few extra chunks are
   * also retrieved for the original question.
   */
  originalQuestion?: string;
};

const MAX_QUERY_LENGTH = 500;
const MAX_RESULTS = RETRIEVAL_TOP_K;
const MAX_EXTRA_RESULTS = 2;

function sameQuery(a: string, b: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return normalize(a) === normalize(b);
}

export function createPlacidWaySearchTool(deps: SearchToolDeps) {
  return new DynamicStructuredTool({
    name: "search_placidway_knowledge",
    description: "Search approved PlacidWay content for factual treatment, clinic, package, pricing, and appointment information. Use this tool before answering PlacidWay factual questions.",
    schema: z.object({
      query: z
        .string()
        .trim()
        .min(1)
        .max(MAX_QUERY_LENGTH)
        .describe("Standalone English search query with follow-up references resolved from the conversation"),
    }),
    func: async ({ query }) => {
      const search = async (text: string) => {
        const embedding = await deps.embed(text);
        if (embedding.length !== 1536 || embedding.some((value) => !Number.isFinite(value)))
          throw new Error("Invalid query embedding");
        return deps.retrieve(embedding, MAX_RESULTS);
      };
      const original = deps.originalQuestion?.trim().slice(0, MAX_QUERY_LENGTH);
      const [primary, secondary] = await Promise.all([
        search(query),
        original && !sameQuery(original, query) ? search(original) : Promise.resolve([]),
      ]);
      const chunks = primary.slice(0, MAX_RESULTS);
      const seen = new Set(chunks.map((chunk) => chunk.id));
      const extras = secondary.filter((chunk) => !seen.has(chunk.id)).slice(0, MAX_EXTRA_RESULTS);
      chunks.push(...extras);
      const evidence: ToolEvidence[] = chunks.map((chunk) => ({
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

/** Signals the UI to show the lead form; the tool itself does nothing server-side. */
export function createQuoteRequestTool() {
  return new DynamicStructuredTool({
    name: "request_free_quote",
    description: "Offer the user a form to leave their name and email so PlacidWay can prepare a free quote. Use when the user asks for a quote, a personal price estimate, to be contacted, or to book.",
    schema: z.object({}),
    func: async () => "Quote form shown to the user.",
  });
}
