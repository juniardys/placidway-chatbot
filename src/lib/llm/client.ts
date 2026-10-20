import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { getServerEnv } from "../env";
export function getChatModel() {
  const e = getServerEnv();
  return new ChatOpenAI({
    apiKey: e.LLM_API_KEY,
    model: e.LLM_MODEL,
    configuration: { baseURL: e.LLM_ENDPOINT },
  });
}
export function getEmbeddings() {
  const e = getServerEnv();
  return new OpenAIEmbeddings({
    apiKey: e.LLM_API_KEY,
    model: e.EMBEDDING_MODEL,
    dimensions: e.EMBEDDING_DIMENSIONS,
    configuration: { baseURL: e.LLM_ENDPOINT },
  });
}
