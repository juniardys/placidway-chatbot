import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

test("migration defines pgvector active search RPC", () => {
  const sql = readFileSync(
    "supabase/migrations/001_knowledge_base.sql",
    "utf8",
  );
  expect(sql).toContain("vector(1536)");
  expect(sql).toContain("match_knowledge_chunks");
  expect(sql).toContain("sn.status = 'active'");
  expect(sql).toContain("sn.active = true");
  expect(sql).toContain("c.active = true");
  expect(sql).toContain("s.active = true");
  expect(sql).toContain("set search_path = public, pg_temp");
  expect(sql).toContain("match_threshold > 0");
  expect(sql).toContain("match_count > 0");
});

test("migration does not define removed write RPCs", () => {
  const sql = readFileSync("supabase/migrations/001_knowledge_base.sql", "utf8");
  for (const removed of ["refresh_knowledge_base", "insert_source_snapshot", "insert_knowledge_chunks", "activate_snapshot", "get_active_source_hashes"])
    expect(sql).not.toContain(removed);
});
