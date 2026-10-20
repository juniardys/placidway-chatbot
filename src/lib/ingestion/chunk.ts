export type DocumentChunk = { content: string; section: string; index: number; sourceId?: string; title?: string; pageType?: string; fetchedAt?: string; contentHash?: string };
export type SemanticChunk = DocumentChunk;
export function chunkByHeading(markdown: string, maxChars = 1800, metadata: Omit<DocumentChunk, "content" | "section" | "index"> = {}): DocumentChunk[] {
  const chunks: DocumentChunk[] = []; let section = "Document"; let buffer = "";
  const add = (content: string) => { if (content.trim()) chunks.push({ ...metadata, content: content.trim(), section, index: chunks.length }); };
  const flush = () => { add(buffer); buffer = ""; };
  for (const block of markdown.split(/\n\s*\n/)) {
    const heading = block.match(/^#{1,6}\s+(.+)$/m); if (heading) { flush(); section = heading[1].trim(); }
    let remaining = block;
    while (remaining.length > maxChars) { const cut = remaining.slice(0, maxChars); const split = cut.lastIndexOf(" "); const at = split > 0 ? split : maxChars; add(`${buffer}${buffer ? "\n\n" : ""}${remaining.slice(0, at)}`); buffer = ""; remaining = remaining.slice(at).trimStart(); }
    buffer += `${buffer ? "\n\n" : ""}${remaining}`;
    if (buffer.length >= maxChars) flush();
  }
  flush(); return chunks;
}
