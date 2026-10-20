export type SemanticChunk = { content: string; section: string; index: number };

export function chunkByHeading(markdown: string, maxChars = 1800): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];
  let section = "Document";
  let buffer = "";
  const flush = () => { if (buffer.trim()) { chunks.push({ content: buffer.trim(), section, index: chunks.length }); buffer = ""; } };
  for (const block of markdown.split(/\n\s*\n/)) {
    const heading = block.match(/^#{1,6}\s+(.+)$/m);
    if (heading) { flush(); section = heading[1].trim(); }
    if ((buffer.length + block.length + 2) > maxChars) flush();
    buffer += `${buffer ? "\n\n" : ""}${block}`;
  }
  flush();
  return chunks;
}
