import type { AllowedSource } from "./sources";

export type Pacer = { wait(): Promise<void> };
export type RawSourceSnapshot = {
  html: string;
  url: string;
  fetchedAt: string;
  status: number;
  headers: Record<string, string>;
  sourceId: string;
  title: string;
  pageType: string;
};
export const IDENTIFIABLE_USER_AGENT =
  "PlacidWayKnowledgeBot/1.0 (+https://placidway.com/)";
export function createPacer(
  intervalMs = 1000,
  now = () => Date.now(),
  sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
): Pacer {
  let last = -Infinity;
  return {
    async wait() {
      const delay = Math.max(0, intervalMs - (now() - last));
      if (delay) await sleep(delay);
      last = now();
    },
  };
}
const sharedPacer = createPacer();
function parseRobots(text: string, path: string): boolean {
  const groups: {
    agents: string[];
    rules: { allow: boolean; path: string }[];
  }[] = [];
  let group:
    { agents: string[]; rules: { allow: boolean; path: string }[] } | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) {
      group = undefined;
      continue;
    }
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (key.toLowerCase() === "user-agent") {
      if (!group || group.rules.length) {
        group = { agents: [], rules: [] };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase());
    } else if (
      (key.toLowerCase() === "allow" || key.toLowerCase() === "disallow") &&
      group
    )
      group.rules.push({ allow: key.toLowerCase() === "allow", path: value });
  }
  const name = IDENTIFIABLE_USER_AGENT.split("/")[0].toLowerCase();
  const applicable = groups.filter((g) => g.agents.includes(name));
  const selected = applicable.length
    ? applicable
    : groups.filter((g) => g.agents.includes("*"));
  const rules = selected
    .flatMap((g) => g.rules)
    .filter((r) => r.path && path.startsWith(r.path));
  rules.sort((a, b) => b.path.length - a.path.length);
  return rules[0]?.allow ?? true;
}
async function allowedByRobots(
  url: string,
  fetchImpl: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>,
): Promise<boolean> {
  const parsed = new URL(url);
  const response = await fetchImpl(`${parsed.origin}/robots.txt`, {
    headers: { "User-Agent": IDENTIFIABLE_USER_AGENT },
  });
  return !response.ok || parseRobots(await response.text(), parsed.pathname);
}
export async function fetchSource(
  source: AllowedSource,
  fetchImpl: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response> = fetch,
  pacer: Pacer = sharedPacer,
): Promise<RawSourceSnapshot> {
  await pacer.wait();
  if (!(await allowedByRobots(source.url, fetchImpl)))
    throw new Error("Source URL disallowed by robots.txt");
  const response = await fetchImpl(source.url, {
    headers: { "User-Agent": IDENTIFIABLE_USER_AGENT },
  });
  if (!response.ok) throw new Error(`Source fetch failed: ${response.status}`);
  return {
    html: await response.text(),
    url: source.url,
    fetchedAt: new Date().toISOString(),
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    sourceId: source.id,
    title: source.title,
    pageType: source.pageType,
  };
}
