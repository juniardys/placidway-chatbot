export type DocumentChunk = {
  content: string;
  section: string;
  index: number;
  sourceId?: string;
  title?: string;
  pageType?: string;
  fetchedAt?: string;
  contentHash?: string;
};
export type SemanticChunk = DocumentChunk;
export function chunkByHeading(
  markdown: string,
  maxChars = 1800,
  metadata: Omit<DocumentChunk, "content" | "section" | "index"> = {},
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let section = "Document";
  let buffer = "";
  const add = (content: string) => {
    if (content.trim())
      chunks.push({
        ...metadata,
        content: content.trim(),
        section,
        index: chunks.length,
      });
  };
  const flush = () => {
    add(buffer);
    buffer = "";
  };
  for (const block of markdown.split(/\n\s*\n/)) {
    const heading = block.match(/^#{1,6}\s+(.+)$/m);
    if (heading) {
      flush();
      section = heading[1].trim();
      continue;
    }
    let remaining = block;
    while (remaining.length > maxChars) {
      const at = Math.max(1, remaining.slice(0, maxChars).lastIndexOf(" "));
      add(`${section}\n${remaining.slice(0, at)}`.slice(0, maxChars));
      remaining = remaining.slice(at).trimStart();
    }
    if (remaining) {
      const candidate = `${section}\n${remaining}`;
      if (candidate.length > maxChars) flush();
      else buffer = `${buffer ? `${buffer}\n\n` : ""}${candidate}`;
    }
    if (buffer.length >= maxChars) flush();
  }
  flush();
  return chunks;
}
