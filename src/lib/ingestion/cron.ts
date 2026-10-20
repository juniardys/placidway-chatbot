import cron, { type ScheduledTask } from "node-cron";

export function startIngestionCron(refresh: () => Promise<void>): ScheduledTask {
  const schedule = process.env.INGESTION_CRON_SCHEDULE ?? "0 3 * * *";
  const timezone = process.env.INGESTION_CRON_TIMEZONE ?? "UTC";
  if (!cron.validate(schedule)) throw new Error("Invalid ingestion cron schedule");
  return cron.schedule(schedule, () => {
    void refresh().catch((error) => console.error("Ingestion refresh failed", error instanceof Error ? error.message : "unknown"));
  }, { timezone, noOverlap: true });
}
