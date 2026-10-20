import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

test("migration defines pgvector active search RPC", () => {
  const sql = readFileSync("supabase/migrations/001_knowledge_base.sql", "utf8");
  expect(sql).toContain("vector(1536)");
  expect(sql).toContain("match_knowledge_chunks");
  expect(sql).toContain("sn.status = 'active'");
  expect(sql).toContain("sn.active = true");
  expect(sql).toContain("c.active = true");
  expect(sql).toContain("s.active = true");
  expect(sql).toContain("set search_path = public, pg_temp");
  expect(sql).toContain("revoke all on function insert_knowledge_chunks(jsonb) from public, anon, authenticated");
  expect(sql).toContain("grant execute on function insert_knowledge_chunks(jsonb) to service_role");
  expect(sql).toContain("match_threshold > 0");
  expect(sql).toContain("match_count > 0");
  expect(sql).toContain("p_status not in ('pending', 'active', 'failed')");
  expect(sql).toContain("create temporary table batch_snapshots");
  expect(sql).toContain("from batch_snapshots b where k.id = b.snapshot_id");
  expect(sql).toContain("where c.snapshot_id = b.snapshot_id");
  expect(sql).toContain("from batch_snapshots b where s.id = b.source_id");
  expect(sql).toContain("pg_advisory_xact_lock");
});
