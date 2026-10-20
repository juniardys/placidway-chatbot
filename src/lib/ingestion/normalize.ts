import type { RawSourceSnapshot } from "./fetcher";
export type RawSnapshot = RawSourceSnapshot;
export type NormalizedDocument = { markdown: string; title: string; sections: string[]; url: string; contentHash: string; sourceId: string; pageType: string; fetchedAt: string; status: number; headers: Record<string, string> };
function htmlToMarkdown(html: string): { title: string; markdown: string } {
  const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() ?? "";
  const markdown = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>/gi, "").replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, text) => `\n${"#".repeat(Number(level))} ${text.replace(/<[^>]+>/g, "").trim()}\n`).replace(/<br\s*\/?>(?=.)/gi, "\n").replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n").replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1").replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  return { title: title || markdown.match(/^#\s+(.+)$/m)?.[1] || "Untitled", markdown };
}
export async function normalizeSource(raw: RawSnapshot): Promise<NormalizedDocument> {
  const { title, markdown } = htmlToMarkdown(raw.html); const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(markdown)); const sections: string[] = []; let heading = title;
  for (const block of markdown.split(/\n\s*\n/)) { const h = block.match(/^#{1,6}\s+(.+)$/m); if (h) heading = h[1].trim(); if (block.trim()) sections.push(`${heading}\n${block.trim()}`); }
  return { markdown, title, sections, url: raw.url, contentHash: [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, "0")).join(""), sourceId: raw.sourceId, pageType: raw.pageType, fetchedAt: raw.fetchedAt, status: raw.status, headers: raw.headers };
}
