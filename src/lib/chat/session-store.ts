export type StoredCitation = { title: string; url: string };

export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  citations: StoredCitation[];
  createdAt: string;
};

export type NewMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: StoredCitation[];
};

type QueryResult = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}>;

export type SessionStoreClient = { from: (table: string) => any };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSessionId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

async function run<T>(query: QueryResult, action: string): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(`Chat session ${action} failed: ${error.message}`);
  return data as T;
}

function mapCitations(value: unknown): StoredCitation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const citation = item as Record<string, unknown> | null;
    return citation &&
      typeof citation.title === "string" &&
      typeof citation.url === "string"
      ? [{ title: citation.title, url: citation.url }]
      : [];
  });
}

export function createSessionStore(client: SessionStoreClient) {
  return {
    async createSession(): Promise<string> {
      const row = await run<{ id?: unknown } | null>(
        client.from("chat_sessions").insert({}).select("id").single(),
        "create",
      );
      if (!isSessionId(row?.id))
        throw new Error("Chat session create returned invalid ID");
      return row.id;
    },
    async sessionExists(sessionId: string): Promise<boolean> {
      if (!isSessionId(sessionId)) return false;
      const row = await run<unknown>(
        client
          .from("chat_sessions")
          .select("id")
          .eq("id", sessionId)
          .maybeSingle(),
        "lookup",
      );
      return row !== null;
    },
    async getMessages(sessionId: string): Promise<StoredMessage[]> {
      if (!isSessionId(sessionId)) return [];
      const rows = await run<unknown[] | null>(
        client
          .from("chat_messages")
          .select("role, content, citations, created_at")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true }),
        "read",
      );
      return (rows ?? []).flatMap((value) => {
        const row = value as Record<string, unknown>;
        if (
          (row.role !== "user" && row.role !== "assistant") ||
          typeof row.content !== "string"
        )
          return [];
        return [
          {
            role: row.role,
            content: row.content,
            citations: mapCitations(row.citations),
            createdAt: typeof row.created_at === "string" ? row.created_at : "",
          },
        ];
      });
    },
    async appendMessages(sessionId: string, messages: NewMessage[]) {
      if (!isSessionId(sessionId) || !messages.length) return;
      // Explicit, increasing timestamps keep user/assistant order stable.
      const base = Date.now();
      await run(
        client.from("chat_messages").insert(
          messages.map((message, index) => ({
            session_id: sessionId,
            role: message.role,
            content: message.content,
            citations: message.citations ?? [],
            created_at: new Date(base + index).toISOString(),
          })),
        ),
        "append",
      );
      await run(
        client
          .from("chat_sessions")
          .update({ updated_at: new Date(base).toISOString() })
          .eq("id", sessionId),
        "touch",
      );
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
