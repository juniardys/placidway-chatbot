import { refreshKnowledgeBase } from "../../../../lib/ingestion/refresh";

export async function POST(request: Request) {
  const expected = process.env.REFRESH_SECRET;
  const auth = request.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await refreshKnowledgeBase());
  } catch {
    return Response.json({ status: "failed" }, { status: 500 });
  }
}
