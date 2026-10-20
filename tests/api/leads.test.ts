import { describe, expect, test } from "vitest";
import { POST } from "../../src/app/api/leads/route";
import { createLeadStore, leadSchema } from "../../src/lib/leads/lead-store";

const post = (body: string) => POST(new Request("http://localhost/api/leads", { method: "POST", body }));

describe("POST /api/leads", () => {
  test("rejects malformed JSON and invalid leads", async () => {
    expect((await post("{")).status).toBe(400);
    expect((await post(JSON.stringify({ name: "", email: "a@b.co" }))).status).toBe(400);
    expect((await post(JSON.stringify({ name: "Ana", email: "not-an-email" }))).status).toBe(400);
    expect((await post(JSON.stringify({ name: "Ana", email: "a@b.co", sessionId: "nope" }))).status).toBe(400);
  });
});

describe("lead store", () => {
  test("normalizes and inserts a lead", async () => {
    const inserted: unknown[] = [];
    const store = createLeadStore({ from: () => ({ insert: async (row: unknown) => (inserted.push(row), { error: null }) }) });
    await store.saveLead(leadSchema.parse({ name: " Ana ", email: "ANA@Example.com", message: "  " }));
    expect(inserted).toEqual([{ name: "Ana", email: "ana@example.com", message: null, session_id: null }]);
  });
  test("throws when insert fails", async () => {
    const store = createLeadStore({ from: () => ({ insert: async () => ({ error: { message: "boom" } }) }) });
    await expect(store.saveLead({ name: "Ana", email: "a@b.co", message: undefined })).rejects.toThrow("Lead save failed");
  });
});
