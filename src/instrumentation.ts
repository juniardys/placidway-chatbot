declare global {
  // Keep cron task alive across module reloads in Next.js development mode.
  // eslint-disable-next-line no-var
  var __placidwayIngestionCron: import("node-cron").ScheduledTask | undefined;
}

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (globalThis.__placidwayIngestionCron) {
    console.info(
      "[ingestion] cron already running; skipping duplicate registration",
    );
    return;
  }

  const { startIngestionCron } = await import("./lib/ingestion/cron");
  const { refreshKnowledgeBase } = await import("./lib/ingestion/refresh");
  const task = startIngestionCron(() => refreshKnowledgeBase());
  task.start();
  globalThis.__placidwayIngestionCron = task;
  console.info("[ingestion] cron task started");
}
