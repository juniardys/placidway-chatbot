export type RawSnapshot = { html: string; url: string; fetchedAt?: string };
export type NormalizedDocument = {
  markdown: string;
  title: string;
  sections: string[];
  url: string;
  contentHash: string;
};
export async function normalizeSource(
  raw: RawSnapshot,
): Promise<NormalizedDocument> {
  const title =
    raw.html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.trim() ?? raw.url;
  const markdown = raw.html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(markdown),
  );
  return {
    markdown,
    title,
    sections: markdown.split(
      /(?=\b(?:price|package|procedure|recovery|clinic|disclaimer)\b)/i,
    ),
    url: raw.url,
    contentHash: [...new Uint8Array(hash)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join(""),
  };
}
