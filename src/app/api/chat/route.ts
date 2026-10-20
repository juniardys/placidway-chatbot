import { streamGroundedAnswer } from "../../../lib/chat/answer";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { question?: string };
    if (!body.question?.trim() || body.question.length > 2000)
      return Response.json({ error: "Invalid question" }, { status: 400 });
    const stream = new ReadableStream({
      async start(controller) {
        for await (const event of streamGroundedAnswer({
          question: body.question!,
          evidence: [],
        })) {
          controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
        }
        controller.close();
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
