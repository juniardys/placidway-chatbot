import type { RawSourceSnapshot } from "./fetcher";
export type RawSnapshot = RawSourceSnapshot;
export type NormalizedDocument = {
  markdown: string;
  title: string;
  sections: string[];
  url: string;
  contentHash: string;
  sourceId: string;
  pageType: string;
  fetchedAt: string;
  status: number;
  headers: Record<string, string>;
};
function htmlToMarkdown(html: string): { title: string; markdown: string } {
  const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() ?? "";
  const markdown = html
    .replace(
      /<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>/gi,
      "",
    )
    .replace(
      /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi,
      (_, level, text) =>
        `\n${"#".repeat(Number(level))} ${text.replace(/<[^>]+>/g, "").trim()}\n`,
    )
    .replace(/<br\s*\/?>(?=.)/gi, "\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
  return {
    title: title || markdown.match(/^#\s+(.+)$/m)?.[1] || "Untitled",
    markdown: extractMainContent(markdown),
  };
}

// PlacidWay pages wrap the page body in site chrome: navigation before the H1
// and randomized "related" widgets, view counters, and footer after the quote
// form. That chrome leaks other clinics' prices into chunks and changes on every
// fetch, so keep only the H1 through the first site-wide trailing section.
const TRAILING_BOILERPLATE =
  /^#{2,3}\s+(Request your Free Quote|Trusted Medical Tourism Platform|Follow PlacidWay|The PlacidWay Network)\b/im;
// Randomized cross-links inside the body; dropped up to the next heading.
const INLINE_BOILERPLATE = /^#{2,4}\s+Related Experiences:?[^\n]*\n[\s\S]*?(?=^#{1,6}\s)/gim;

export function extractMainContent(markdown: string): string {
  const start = markdown.search(/^#\s+\S/m);
  let body = start >= 0 ? markdown.slice(start) : markdown;
  const end = body.search(TRAILING_BOILERPLATE);
  if (end > 0) body = body.slice(0, end);
  return body
    .replace(INLINE_BOILERPLATE, "")
    .replace(/^\s*-->\s*$/gm, "")
    // Bare numbers on their own line are view/like counters that change per fetch.
    .replace(/^\s*\d[\d.,]*[KM]?\s*$/gm, "")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

// Bump when chunking or embedding input changes so unchanged pages are re-indexed.
const INDEX_VERSION = "2";

export async function normalizeSource(
  raw: RawSnapshot,
): Promise<NormalizedDocument> {
  const { title, markdown } = htmlToMarkdown(raw.html);
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${INDEX_VERSION}\n${markdown}`),
  );
  const sections: string[] = [];
  let heading = title;
  for (const block of markdown.split(/\n\s*\n/)) {
    const h = block.match(/^#{1,6}\s+(.+)$/m);
    if (h) heading = h[1].trim();
    if (block.trim()) sections.push(`${heading}\n${block.trim()}`);
  }
  return {
    markdown,
    title,
    sections,
    url: raw.url,
    contentHash: [...new Uint8Array(hash)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join(""),
    sourceId: raw.sourceId,
    pageType: raw.pageType,
    fetchedAt: raw.fetchedAt,
    status: raw.status,
    headers: raw.headers,
  };
}
