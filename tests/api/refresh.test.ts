import { afterEach, describe, expect, test, vi, beforeEach } from "vitest";
import * as refreshModule from "../../src/lib/ingestion/refresh";
import { POST } from "../../src/app/api/refresh/route";

const refresh = vi.spyOn(refreshModule, "refreshKnowledgeBase");

describe("POST /api/refresh", () => {
  beforeEach(() => {
    refresh.mockReset();
  });
  afterEach(() => {
    refresh.mockRestore();
  });
  test("maps refresh statuses", async () => {
    refresh.mockResolvedValueOnce({ status: "skipped", sources: 0, chunks: 0 });
    expect((await POST()).status).toBe(409);
    refresh.mockResolvedValueOnce({ status: "success", sources: 7, chunks: 1 });
    expect((await POST()).status).toBe(200);
    refresh.mockResolvedValueOnce({ status: "unchanged", sources: 7, chunks: 0 });
    expect((await POST()).status).toBe(200);
    refresh.mockResolvedValueOnce({ status: "failed", sources: 1, chunks: 0 });
    const failed = await POST();
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ status: "failed" });
  });
});
