import { describe, expect, test } from "bun:test";
import { getServerEnv } from "../../src/lib/env";

describe("server environment", () => {
  test("uses required embedding defaults and dimension", () => {
    const env = getServerEnv({
      LLM_ENDPOINT: "https://example.test/v1",
      LLM_API_KEY: "key",
      LLM_MODEL: "model",
      REFRESH_SECRET: "secret",
    });
    expect(env.EMBEDDING_MODEL).toBe("sumo/text-embedding-3-small");
    expect(env.EMBEDDING_DIMENSIONS).toBe(1536);
    expect(env.INGESTION_CRON_TIMEZONE).toBe("UTC");
  });
});
