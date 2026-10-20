import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

test("migration defines pgvector active search RPC", () => {
  const sql = readFileSync("supabase/migrations/001_knowledge_base.sql", "utf8");
  expect(sql).toContain("vector(1536)");
  expect(sql).toContain("match_knowledge_chunks");
  expect(sql).toContain("sn.status = 'active'");
  expect(sql).toContain("sn.active = true");
  expect(sql).toContain("c.active = true");
});
