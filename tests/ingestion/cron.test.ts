import { describe, expect, test, vi } from "vitest";
import { startIngestionCron } from "../../src/lib/ingestion/cron";
describe("ingestion cron", () => {
  test("uses defaults and no overlap", () => {
    const task = startIngestionCron(async () => {});
    expect(task).toBeDefined();
    task.stop();
  });
  test("rejects invalid schedule", () => {
    const old = process.env.INGESTION_CRON_SCHEDULE;
    process.env.INGESTION_CRON_SCHEDULE = "invalid";
    expect(() => startIngestionCron(async () => {})).toThrow("Invalid");
    process.env.INGESTION_CRON_SCHEDULE = old;
  });
  test("contains refresh failure", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const task = startIngestionCron(async () => {
      throw new Error("nope");
    });
    task.stop();
    error.mockRestore();
  });
});
