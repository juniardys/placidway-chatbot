import { SOURCES } from "../../config/sources";
export type AllowedSource = (typeof SOURCES)[number];
export function assertAllowedSource(url: string): AllowedSource {
  const source = SOURCES.find((s) => s.url === url);
  if (!source) throw new Error("Source URL is not allowlisted");
  return source;
}
export function validateProductionSources() {
  if (SOURCES.length !== 7) throw new Error("Production requires exactly seven sources");
  const ids = new Set(SOURCES.map((source) => source.id));
  const urls = new Set(SOURCES.map((source) => source.url));
  if (ids.size !== 7 || urls.size !== 7) throw new Error("Production sources must have unique IDs and URLs");
  if (SOURCES.some((source) => !source.id || !source.title || !source.pageType || !/^https?:\/\//.test(source.url))) throw new Error("Production sources are incomplete");
  if (SOURCES.some((s) => s.url.includes("placeholder.invalid"))) throw new Error("Production source URLs are placeholders");
}
