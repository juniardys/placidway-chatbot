import { createSessionStore } from "../../../../lib/chat/session-store";
import { getServerSupabase } from "../../../../lib/db/client";

/** Starts a new chat session. Previous sessions stay in the database. */
export async function POST() {
  try {
    const store = createSessionStore(getServerSupabase());
    const id = await store.createSession();
    return Response.json({ id }, { status: 201 });
  } catch {
    return Response.json({ error: "Unable to create session" }, { status: 500 });
  }
}
