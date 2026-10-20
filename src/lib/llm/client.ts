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
  return new OpenAIEmbeddings({
    apiKey: env.LLM_API_KEY,
    model: env.EMBEDDING_MODEL,
    dimensions: 1536,
    configuration: { baseURL: endpoint() },
  });
}
