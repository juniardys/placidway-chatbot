import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { getServerEnv } from "../env";

// Fail fast: upstream 5xx (e.g. a broken 9router combo) must surface as an
// error event instead of LangChain's default 6 backoff retries with no timeout.
const LLM_TIMEOUT_MS = 30_000;
const LLM_MAX_RETRIES = 1;

function endpoint(): string {
  return getServerEnv().LLM_ENDPOINT.replace(/\/+$/, "");
}

export function getChatModel(): ChatOpenAI {
  const env = getServerEnv();
  return new ChatOpenAI({
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
    timeout: LLM_TIMEOUT_MS,
    maxRetries: LLM_MAX_RETRIES,
    configuration: { baseURL: endpoint() },
  });
}

export function getEmbeddings(): OpenAIEmbeddings {
  const env = getServerEnv();
  const embeddings = new OpenAIEmbeddings({
    apiKey: env.LLM_API_KEY,
    model: env.EMBEDDING_MODEL || "sumo/text-embedding-3-small",
    dimensions: env.EMBEDDING_DIMENSIONS,
    timeout: LLM_TIMEOUT_MS,
    maxRetries: LLM_MAX_RETRIES,
    configuration: { baseURL: endpoint() },
  });
  Object.defineProperty(embeddings, "model", {
    value: env.EMBEDDING_MODEL || "sumo/text-embedding-3-small",
    writable: true,
    configurable: true,
  });
  return embeddings;
}
