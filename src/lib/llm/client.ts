import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { getServerEnv } from "../env";

function endpoint(): string {
  return getServerEnv().LLM_ENDPOINT.replace(/\/+$/, "");
}

export function getChatModel(): ChatOpenAI {
  const env = getServerEnv();
  return new ChatOpenAI({
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
    configuration: { baseURL: endpoint() },
  });
}

export function getEmbeddings(): OpenAIEmbeddings {
  const env = getServerEnv();
  const embeddings = new OpenAIEmbeddings({
    apiKey: env.LLM_API_KEY,
    model: env.EMBEDDING_MODEL || "sumo/text-embedding-3-small",
    dimensions: env.EMBEDDING_DIMENSIONS,
    configuration: { baseURL: endpoint() },
  });
  Object.defineProperty(embeddings, "model", { value: env.EMBEDDING_MODEL || "sumo/text-embedding-3-small", writable: true, configurable: true });
  return embeddings;
}
