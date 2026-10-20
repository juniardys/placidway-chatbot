import { SOURCES } from "../../config/sources";
export type AllowedSource = (typeof SOURCES)[number];
export function assertAllowedSource(url: string): AllowedSource {
  const source = SOURCES.find((s) => s.url === url);
  if (!source) throw new Error("Source URL is not allowlisted");
  return source;
}
export function validateProductionSources(list: typeof SOURCES = SOURCES) {
  if (list.length !== 7) throw new Error("Production requires exactly seven sources");
  const ids = new Set(list.map((source) => source.id));
  const urls = new Set(list.map((source) => source.url));
  const expected = new Map(SOURCES.map((source) => [source.id, source.url]));
  if (ids.size !== 7 || urls.size !== 7 || list.some((source) => expected.get(source.id) !== source.url)) throw new Error("Production sources must match exact seven-source allowlist");
  if (list.some((source) => !source.id || !source.title || !source.pageType || !/^https?:\/\//.test(source.url))) throw new Error("Production sources are incomplete");
  if (list === SOURCES && list.some((s) => s.url.includes("placeholder.invalid"))) throw new Error("Production source URLs are placeholders");
}
