import { describe, expect, test } from "vitest";
import { POST } from "../../src/app/api/chat/route";

describe("POST /api/chat", () => {
  test("returns 400 for malformed JSON", async () => {
    const response = await POST(new Request("http://localhost/api/chat", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
  });

  test("returns 400 for invalid question and history", async () => {
    const invalidQuestion = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ question: "" }) }));
    const invalidHistory = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ question: "hello", history: [{ role: "system", content: "x" }] }) }));
    expect(invalidQuestion.status).toBe(400);
    expect(invalidHistory.status).toBe(400);
  });

  test("returns SSE headers and ordered terminal events", async () => {
    const response = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ question: "hello" }) }));
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const text = await response.text();
    expect(text.indexOf('"type":"delta"')).toBeLessThan(text.indexOf('"type":"done"'));
  });
});
