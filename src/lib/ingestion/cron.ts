import cron, { type ScheduledTask } from "node-cron";

export function startIngestionCron(
  refresh: () => Promise<unknown>,
): ScheduledTask {
  const schedule = process.env.INGESTION_CRON_SCHEDULE ?? "0 3 * * *";
  const timezone = process.env.INGESTION_CRON_TIMEZONE ?? "UTC";
  if (!cron.validate(schedule))
    throw new Error("Invalid ingestion cron schedule");

  console.info(
    `[ingestion] cron scheduled: ${schedule} (${timezone}), noOverlap=true`,
  );
  return cron.schedule(
    schedule,
    () => {
      console.info(
        `[ingestion] cron refresh started: ${new Date().toISOString()}`,
      );
      void refresh()
        .then((result) => {
          const status =
            result && typeof result === "object" && "status" in result
              ? String(result.status)
              : "completed";
          const detail =
            result && typeof result === "object" && "error" in result
              ? ` error=${String(result.error)}`
              : "";
          console.info(
            `[ingestion] cron refresh finished: status=${status}${detail} at ${new Date().toISOString()}`,
          );
        })
        .catch((error) =>
          console.error(
            "[ingestion] cron refresh failed",
            error instanceof Error ? error.message : "unknown",
          ),
        );
    },
    { timezone, noOverlap: true },
  );
}
