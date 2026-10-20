import type { AllowedSource } from "./sources";
export async function fetchSource(
  source: AllowedSource,
  fetchImpl = fetch,
): Promise<{ html: string; url: string; fetchedAt: string }> {
  const response = await fetchImpl(source.url, {
    headers: { "User-Agent": "PlacidWayKnowledgeBot/1.0" },
  });
  if (!response.ok) throw new Error(`Source fetch failed: ${response.status}`);
  return {
    html: await response.text(),
    url: source.url,
    fetchedAt: new Date().toISOString(),
  };
}
