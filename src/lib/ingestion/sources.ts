import { SOURCES } from "../../config/sources";
export type AllowedSource = (typeof SOURCES)[number];
export function assertAllowedSource(url: string): AllowedSource {
  const source = SOURCES.find((s) => s.url === url);
  if (!source) throw new Error("Source URL is not allowlisted");
  return source;
}
export function validateProductionSources() {
  if (SOURCES.some((s) => s.url.includes("placeholder.invalid")))
    throw new Error("Production source URLs are placeholders");
}
