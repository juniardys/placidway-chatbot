import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import {
  createSessionStore,
  isSessionId,
} from "../../src/lib/chat/session-store";
import { POST } from "../../src/app/api/chat/route";

const SESSION_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

type Call = { table: string; op: string; args: unknown[] };

function fakeClient(results: Record<string, unknown>) {
  const calls: Call[] = [];
  const from = (table: string) => {
    let op = "";
    const builder: Record<string, unknown> = {};
    for (const name of ["insert", "select", "update", "eq", "order", "single", "maybeSingle"]) {
      builder[name] = (...args: unknown[]) => {
        if (["insert", "select", "update"].includes(name) && !op) op = name;
        calls.push({ table, op: name, args });
        return builder;
      };
    }
    builder.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data: results[`${table}.${op}`] ?? null, error: null });
    return builder;
  };
  return { client: { from }, calls };
}

describe("chat session store", () => {
  test("validates session ids", () => {
    expect(isSessionId(SESSION_ID)).toBe(true);
    expect(isSessionId("abc")).toBe(false);
    expect(isSessionId(42)).toBe(false);
  });

  test("creates a session and returns its id", async () => {
    const { client } = fakeClient({ "chat_sessions.insert": { id: SESSION_ID } });
    expect(await createSessionStore(client).createSession()).toBe(SESSION_ID);
  });

  test("maps stored messages and drops malformed rows", async () => {
    const { client } = fakeClient({
      "chat_messages.select": [
        { role: "user", content: "Hi", citations: [], created_at: "t1" },
        {
          role: "assistant",
          content: "Hello",
          citations: [{ title: "A", url: "https://a" }, { bad: true }],
          created_at: "t2",
        },
        { role: "system", content: "nope" },
      ],
    });
    expect(await createSessionStore(client).getMessages(SESSION_ID)).toEqual([
      { role: "user", content: "Hi", citations: [], createdAt: "t1" },
      {
        role: "assistant",
        content: "Hello",
        citations: [{ title: "A", url: "https://a" }],
        createdAt: "t2",
      },
    ]);
  });

  test("appends messages in order and touches the session", async () => {
    const { client, calls } = fakeClient({});
    await createSessionStore(client).appendMessages(SESSION_ID, [
      { role: "user", content: "Q" },
      { role: "assistant", content: "A", citations: [{ title: "T", url: "https://t" }] },
    ]);
    const insert = calls.find((call) => call.table === "chat_messages" && call.op === "insert");
    const rows = insert?.args[0] as { role: string; created_at: string; session_id: string }[];
    expect(rows.map((row) => row.role)).toEqual(["user", "assistant"]);
    expect(rows.every((row) => row.session_id === SESSION_ID)).toBe(true);
    expect(rows[0].created_at < rows[1].created_at).toBe(true);
    expect(calls.some((call) => call.table === "chat_sessions" && call.op === "update")).toBe(true);
  });

  test("ignores invalid ids without querying", async () => {
    const { client, calls } = fakeClient({});
    const store = createSessionStore(client);
    expect(await store.getMessages("nope")).toEqual([]);
    expect(await store.sessionExists("nope")).toBe(false);
    await store.appendMessages("nope", [{ role: "user", content: "x" }]);
    expect(calls).toEqual([]);
  });
});

test("chat API rejects a malformed session id", async () => {
  const response = await POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ question: "hello", sessionId: "not-a-uuid" }),
    }),
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Invalid session" });
});

test("chat sessions migration keeps data server-only", () => {
  // Read every migration so the check survives migrations being merged or renamed.
  const dir = "supabase/migrations";
  const sql = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => readFileSync(`${dir}/${name}`, "utf8"))
    .join("\n");
  expect(sql).toContain("create table if not exists chat_sessions");
  expect(sql).toContain("references chat_sessions(id)");
  expect(sql).toContain("alter table chat_messages enable row level security");
  expect(sql).toContain("revoke all on table chat_messages from public, anon, authenticated");
});
