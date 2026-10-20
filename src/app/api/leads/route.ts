import { getServerSupabase } from "../../../lib/db/client";
import { createLeadStore, leadSchema } from "../../../lib/leads/lead-store";

/** Stores a free-quote request (name + email) offered by the chat assistant. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: "Invalid lead" }, { status: 400 });
  try {
    await createLeadStore(getServerSupabase()).saveLead(parsed.data);
    return Response.json({ status: "saved" }, { status: 201 });
  } catch {
    return Response.json({ error: "Unable to save lead" }, { status: 500 });
  }
}
