import { describe, expect, test } from "vitest";
import { POST } from "../../src/app/api/chat/route";

describe("POST /api/chat", () => {
  test("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", { method: "POST", body: "{" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
  });

  test("returns 400 for invalid question and history", async () => {
    const invalidQuestion = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ question: "" }),
      }),
    );
    const invalidHistory = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          question: "hello",
          history: [{ role: "system", content: "x" }],
        }),
      }),
    );
    expect(invalidQuestion.status).toBe(400);
    expect(invalidHistory.status).toBe(400);
  });

  test("rejects unavailable backend with 500", async () => {
    // bun test auto-loads .env; remove the server key so the backend is truly unavailable.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ question: "hello" }),
      }),
    );
    if (serviceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to process request",
    });
  });
});
