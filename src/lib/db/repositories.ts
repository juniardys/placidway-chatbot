import type { ChatLogInput, RetrievedChunk } from "./types";
export interface DbClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export function createRepository(db: DbClient) {
  return {
    async getActiveChunks(
      queryEmbedding: number[],
      limit: number,
    ): Promise<RetrievedChunk[]> {
      const r = await db.query<RetrievedChunk>(
        "select * from match_knowledge_chunks($1,$2)",
        [queryEmbedding, limit],
      );
      return r.rows.filter((x) => x.active !== false);
    },
    async logChatOutcome(input: ChatLogInput) {
      await db.query(
        "insert into chat_logs(question,status,confidence) values ($1,$2,$3)",
        [input.question, input.status, input.confidence ?? null],
      );
    },
  };
}
