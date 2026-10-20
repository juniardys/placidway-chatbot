import { z } from "zod";

const schema = z.object({
  LLM_ENDPOINT: z.string().url(),
  LLM_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().min(1),
  EMBEDDING_MODEL: z.string().default("sumo/text-embedding-3-small"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().default(1536),
  INGESTION_CRON_SCHEDULE: z.string().default("0 3 * * *"),
  INGESTION_CRON_TIMEZONE: z.string().default("UTC"),
  INGESTION_USER_AGENT: z.string().default("PlacidWayKnowledgeBot/1.0"),
  RETRIEVAL_TOP_K: z.coerce.number().int().default(6),
  RETRIEVAL_MIN_SCORE: z.coerce.number().default(0.5),
  MAX_HISTORY_MESSAGES: z.coerce.number().int().default(10),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
});
export type ServerEnv = z.infer<typeof schema>;
export function getServerEnv(
  input: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Invalid server environment: ${result.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  if (result.data.EMBEDDING_DIMENSIONS !== 1536)
    throw new Error("EMBEDDING_DIMENSIONS must equal 1536");
  return result.data;
}
