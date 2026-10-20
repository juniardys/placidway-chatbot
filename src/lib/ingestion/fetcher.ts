import type { AllowedSource } from "./sources";

export type Pacer = { wait(): Promise<void> };
export type RawSourceSnapshot = {
  html: string;
  url: string;
  fetchedAt: string;
  status: number;
  headers: Record<string, string>;
};

export const IDENTIFIABLE_USER_AGENT = "PlacidWayKnowledgeBot/1.0 (+https://placidway.com/)";

export function createPacer(intervalMs = 1000, now = () => Date.now(), sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))): Pacer {
  let last = 0;
  return { async wait() { const delay = Math.max(0, intervalMs - (now() - last)); if (delay) await sleep(delay); last = now(); } };
}

async function allowedByRobots(url: string, fetchImpl: typeof fetch): Promise<boolean> {
  const parsed = new URL(url);
  const response = await fetchImpl(`${parsed.origin}/robots.txt`, { headers: { "User-Agent": IDENTIFIABLE_USER_AGENT } });
  if (!response.ok) return true;
  const lines = (await response.text()).split(/\r?\n/);
  let applies = false;
  for (const raw of lines) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const [key, value = ""] = line.split(":", 2).map((part) => part.trim());
    if (key.toLowerCase() === "user-agent") applies = value === "*" || value.toLowerCase() === IDENTIFIABLE_USER_AGENT.split("/")[0].toLowerCase();
    if (applies && key.toLowerCase() === "disallow" && value && parsed.pathname.startsWith(value)) return false;
  }
  return true;
}

export async function fetchSource(source: AllowedSource, fetchImpl: typeof fetch = fetch, pacer: Pacer = createPacer()): Promise<RawSourceSnapshot> {
  await pacer.wait();
  if (!(await allowedByRobots(source.url, fetchImpl))) throw new Error("Source URL disallowed by robots.txt");
  const response = await fetchImpl(source.url, { headers: { "User-Agent": IDENTIFIABLE_USER_AGENT } });
  if (!response.ok) throw new Error(`Source fetch failed: ${response.status}`);
  return { html: await response.text(), url: source.url, fetchedAt: new Date().toISOString(), status: response.status, headers: Object.fromEntries(response.headers.entries()) };
}
