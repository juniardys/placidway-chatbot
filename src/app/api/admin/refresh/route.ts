import { refreshKnowledgeBase } from "../../../../lib/ingestion/refresh";

export async function POST(request: Request) {
  const expected = process.env.REFRESH_SECRET;
  const auth = request.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await refreshKnowledgeBase();
    if (result.status === "skipped") return Response.json(result, { status: 409 });
    if (result.status === "failed") return Response.json({ status: "failed" }, { status: 500 });
    return Response.json(result, { status: 200 });
  } catch {
    return Response.json({ status: "failed" }, { status: 500 });
  }
}
