import {
  createSessionStore,
  isSessionId,
} from "../../../../../lib/chat/session-store";
import { getServerSupabase } from "../../../../../lib/db/client";

/** Returns a session's stored messages so the UI survives a reload. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isSessionId(id))
    return Response.json({ error: "Invalid session" }, { status: 400 });
  try {
    const store = createSessionStore(getServerSupabase());
    if (!(await store.sessionExists(id)))
      return Response.json({ error: "Session not found" }, { status: 404 });
    return Response.json({ id, messages: await store.getMessages(id) });
  } catch {
    return Response.json({ error: "Unable to load session" }, { status: 500 });
  }
}
