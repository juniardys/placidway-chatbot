import { describe, expect, test } from "vitest";
import { getChatModel, getEmbeddings } from "../../src/lib/llm/client";

describe("provider configuration", () => {
  test("configures chat and embeddings without network at import time", () => {
    process.env.LLM_ENDPOINT = "https://provider.example/v1/"; process.env.LLM_API_KEY = "test-key"; process.env.LLM_MODEL = "chat-model"; process.env.EMBEDDING_MODEL = "sumo/text-embedding-3-small"; process.env.EMBEDDING_DIMENSIONS = "1536"; process.env.REFRESH_SECRET = "secret";
    const chat = getChatModel() as unknown as { model: string; clientConfig: { baseURL?: string } };
    const embeddings = getEmbeddings() as unknown as { model: string; dimensions: number; clientConfig: { baseURL?: string } };
    expect(chat.model).toBe("chat-model"); expect(chat.clientConfig.baseURL).toBe("https://provider.example/v1"); expect(embeddings.model).toBe("sumo/text-embedding-3-small"); expect(embeddings.dimensions).toBe(1536); expect(embeddings.clientConfig.baseURL).toBe("https://provider.example/v1");
  });
});
