import { streamGroundedAnswer } from "../../../lib/chat/answer";
import { MAX_HISTORY_CONTENT_LENGTH, MAX_HISTORY_MESSAGES, MAX_QUESTION_LENGTH } from "../../../lib/constants";
import { getServerSupabase } from "../../../lib/db/client";
import { createRepository } from "../../../lib/db/repositories";
import { getEmbeddings } from "../../../lib/llm/client";
import { retrieveEvidence, type ChatMessage } from "../../../lib/retrieval/retrieve";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { question?: string; history?: ChatMessage[] };
    const question = body.question?.trim();
    if (!question || question.length > MAX_QUESTION_LENGTH) return Response.json({ error: "Invalid question" }, { status: 400 });
    const history = Array.isArray(body.history)
      ? body.history.filter((item): item is ChatMessage => (item.role === "user" || item.role === "assistant") && typeof item.content === "string").map((item) => ({ ...item, content: item.content.slice(0, MAX_HISTORY_CONTENT_LENGTH) })).slice(-MAX_HISTORY_MESSAGES)
      : [];
    const embeddings = getEmbeddings();
    const supabase = getServerSupabase();
    const repository = createRepository({ rpc: async (name, args) => supabase.rpc(name, args) });
    const evidence = await retrieveEvidence(question, history, {
      embed: async (text) => (await embeddings.embedQuery(text)),
      retrieve: (vector, limit) => repository.getActiveChunks(vector, limit),
    });
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of streamGroundedAnswer({ question, history, evidence })) controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
        } catch {
          controller.enqueue(`data: ${JSON.stringify({ type: "error", message: "Unable to generate an answer" })}\n\n`);
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
  } catch {
    return Response.json({ error: "Unable to process request" }, { status: 500 });
  }
}
