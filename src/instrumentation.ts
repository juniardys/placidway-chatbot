export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startIngestionCron } = await import("./lib/ingestion/cron");
  const { refreshKnowledgeBase } = await import("./lib/ingestion/refresh");
  startIngestionCron(async () => { await refreshKnowledgeBase(); });
}
