import { describe, expect, test, vi, beforeEach } from "vitest";
import * as refreshModule from "../../src/lib/ingestion/refresh";
import { POST } from "../../src/app/api/admin/refresh/route";

const refresh = vi.spyOn(refreshModule, "refreshKnowledgeBase");

describe("POST /api/admin/refresh", () => {
  beforeEach(() => { process.env.REFRESH_SECRET = "test-secret"; refresh.mockReset(); });
  test("maps auth and refresh statuses", async () => {
    expect((await POST(new Request("http://x", { method: "POST" }))).status).toBe(401);
    refresh.mockResolvedValueOnce({ status: "skipped", sources: 0, chunks: 0 });
    expect((await POST(new Request("http://x", { method: "POST", headers: { authorization: "Bearer test-secret" } }))).status).toBe(409);
    refresh.mockResolvedValueOnce({ status: "success", sources: 7, chunks: 1 });
    expect((await POST(new Request("http://x", { method: "POST", headers: { authorization: "Bearer test-secret" } }))).status).toBe(200);
    refresh.mockResolvedValueOnce({ status: "failed", sources: 1, chunks: 0 });
    const failed = await POST(new Request("http://x", { method: "POST", headers: { authorization: "Bearer test-secret" } }));
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ status: "failed" });
  });
});
