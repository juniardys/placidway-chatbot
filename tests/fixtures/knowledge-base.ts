import type { RetrievedChunk } from "../../src/lib/db/types";

const base = { sourceId: "fixture-source", title: "PlacidWay fixture", url: "https://example.com/placidway", pageType: "fixture", fetchedAt: "2026-01-01T00:00:00.000Z", contentHash: "fixture-hash" };
export const KNOWLEDGE_FIXTURES: Record<string, RetrievedChunk> = {
  price: { ...base, id: "price", content: "Dental package: starting from USD 2,000, including consultation and hotel.", similarity: 0.95 },
  package: { ...base, id: "package", content: "Package includes consultation, treatment, hotel, and airport transfer.", similarity: 0.94 },
  recovery: { ...base, id: "recovery", content: "Recovery information is provided on the procedure page.", similarity: 0.93 },
  comparison: { ...base, id: "comparison", content: "Turkey offers the listed dental package.", similarity: 0.92 },
  unsupportedPrice: { ...base, id: "unsupported-price", content: "The available content does not list a USD 50 price.", similarity: 0.91 },
};
export const knowledgeFixtures = Object.values(KNOWLEDGE_FIXTURES);
