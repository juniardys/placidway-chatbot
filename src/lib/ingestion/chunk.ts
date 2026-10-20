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
// Sections shorter than this are merged with the following ones so pages made of
// many tiny headed cards (videos, testimonials) do not explode into hundreds of
// low-signal chunks.
const MIN_CHUNK_CHARS = 400;

export function chunkByHeading(
  markdown: string,
  maxChars = 1800,
  metadata: Omit<DocumentChunk, "content" | "section" | "index"> = {},
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let section = "Document";
  let buffer = "";
  let bufferSection = section;
  let lastSection = "";
  const add = (content: string, chunkSection: string) => {
    if (content.trim())
      chunks.push({
        ...metadata,
        content: content.trim(),
        section: chunkSection,
        index: chunks.length,
      });
  };
  const flush = () => {
    add(buffer, bufferSection);
    buffer = "";
  };
  // Write the heading once per run of blocks under it, not once per block.
  const append = (text: string) => {
    const labelled = () => (buffer && lastSection === section ? text : `${section}\n${text}`);
    if (buffer && buffer.length + labelled().length + 2 > maxChars) flush();
    if (!buffer) bufferSection = section;
    buffer = buffer ? `${buffer}\n\n${labelled()}` : labelled();
    lastSection = section;
  };
  for (const block of markdown.split(/\n\s*\n/)) {
    const heading = block.match(/^#{1,6}\s+(.+)$/m);
    if (heading) {
      if (buffer.length >= MIN_CHUNK_CHARS) flush();
      section = heading[1].trim();
      continue;
    }
    let remaining = block.trim();
    if (!remaining) continue;
    while (`${section}\n${remaining}`.length > maxChars) {
      flush();
      const room = Math.max(1, maxChars - section.length - 1);
      const at = Math.max(1, remaining.slice(0, room).lastIndexOf(" "));
      add(`${section}\n${remaining.slice(0, at)}`.slice(0, maxChars), section);
      remaining = remaining.slice(at).trimStart();
    }
    if (remaining) append(remaining);
  }
  flush();
  return chunks;
}
