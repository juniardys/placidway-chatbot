import { validateProductionSources } from "./sources";
let running = false;
export async function refreshKnowledgeBase(): Promise<{ status: string }> {
  if (running) return { status: "skipped" };
  running = true;
  try {
    validateProductionSources();
    return { status: "unchanged" };
  } finally {
    running = false;
  }
}
