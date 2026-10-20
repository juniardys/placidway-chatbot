import { streamAgentAnswer, decideAndAnswer } from "../../../lib/agent/chat-agent";
import { createPlacidWaySearchTool } from "../../../lib/agent/tools";
import {
  MAX_HISTORY_CONTENT_LENGTH,
  MAX_HISTORY_MESSAGES,
  MAX_QUESTION_LENGTH,
} from "../../../lib/constants";
import { getServerSupabase } from "../../../lib/db/client";
import { createRepository } from "../../../lib/db/repositories";
import { getChatModel, getEmbeddings } from "../../../lib/llm/client";
import type { ChatMessage } from "../../../lib/agent/types";
import {
  createSessionStore,
  isSessionId,
  type StoredCitation,
} from "../../../lib/chat/session-store";

export async function POST(request: Request) {
  try {
    let body: { question?: unknown; history?: unknown; sessionId?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (typeof body.question !== "string")
      return Response.json({ error: "Invalid question" }, { status: 400 });
    const question = body.question.trim();
    if (!question || question.length > MAX_QUESTION_LENGTH)
      return Response.json({ error: "Invalid question" }, { status: 400 });
    if (body.sessionId !== undefined && !isSessionId(body.sessionId))
      return Response.json({ error: "Invalid session" }, { status: 400 });
    const sessionId = body.sessionId as string | undefined;
    if (body.history !== undefined && !Array.isArray(body.history))
      return Response.json({ error: "Invalid history" }, { status: 400 });
    const rawHistory = (body.history ?? []) as unknown[];
    if (
      rawHistory.some(
        (item) =>
          !item ||
          typeof item !== "object" ||
          !(
            (item as Record<string, unknown>).role === "user" ||
            (item as Record<string, unknown>).role === "assistant"
          ) ||
          typeof (item as Record<string, unknown>).content !== "string",
      )
    ) {
      return Response.json({ error: "Invalid history" }, { status: 400 });
    }
    const history = rawHistory
      .map((item) => {
        const value = item as ChatMessage;
        return {
          role: value.role,
          content: value.content.slice(0, MAX_HISTORY_CONTENT_LENGTH),
        };
      })
      .slice(-MAX_HISTORY_MESSAGES);
    const embeddings = getEmbeddings();
    const supabase = getServerSupabase();
    const repository = createRepository({
      from: (table) => supabase.from(table),
      rpc: async (name, args) => supabase.rpc(name, args),
    });
    const tool = createPlacidWaySearchTool({
      embed: (text) => embeddings.embedQuery(text),
      retrieve: (vector, limit) => repository.getActiveChunks(vector, limit),
    });
    const sessions = createSessionStore(supabase);
    const stream = new ReadableStream({
      async start(controller) {
        let status = "completed";
        let answer = "";
        const citations: StoredCitation[] = [];
        try {
          for await (const event of streamAgentAnswer({
            question,
            history,
            run: () => decideAndAnswer({
              model: getChatModel(),
              tool,
              question,
              history,
              signal: request.signal,
            }),
          })) {
            if (request.signal.aborted) {
              status = "aborted";
              break;
            }
            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
            if (event.type === "error") status = "error";
            if (event.type === "delta") answer += event.text;
            if (
              event.type === "citation" &&
              !citations.some((item) => item.url === event.citation.url)
            )
              citations.push({
                title: event.citation.title,
                url: event.citation.url,
              });
          }
        } catch {
          status = request.signal.aborted ? "aborted" : "error";
          if (!request.signal.aborted)
            controller.enqueue(
              `data: ${JSON.stringify({ type: "error", message: "Unable to generate an answer" })}\n\n`,
            );
        } finally {
          void repository.logChatOutcome({ question, status }).catch(() => {
            /* logging must not break stream */
          });
          // Only completed turns are stored, matching what the UI keeps.
          if (sessionId && status === "completed" && answer)
            void sessions
              .appendMessages(sessionId, [
                { role: "user", content: question },
                { role: "assistant", content: answer, citations },
              ])
              .catch(() => {
                /* persistence must not break stream */
              });
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return Response.json(
      { error: "Unable to process request" },
      { status: 500 },
    );
  }
}
