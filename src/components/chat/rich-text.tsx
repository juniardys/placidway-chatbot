import type { ReactNode } from "react";

type Block = { type: "p" | "ul" | "ol"; lines: string[] };

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

// Minimal, safe markdown subset for model answers: paragraphs, bullet/numbered lists, **bold**, `code`.
export function RichText({ text, streaming }: { text: string; streaming?: boolean }) {
  return (
    <div className={`rich-text ${streaming ? "is-streaming" : ""}`}>
      {toBlocks(text).map((block, index) => {
        if (block.type === "p")
          return (
            <p key={index}>
              {block.lines.flatMap((line, lineIndex) => (lineIndex ? [<br key={`br-${lineIndex}`} />, ...inline(line)] : inline(line)))}
            </p>
          );
        const List = block.type;
        return (
          <List key={index}>
            {block.lines.map((line, lineIndex) => (
              <li key={lineIndex}>{inline(line)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let previousBlank = true;
  for (const raw of text.trim().split("\n")) {
    if (!raw.trim()) {
      previousBlank = true;
      continue;
    }
    const type = BULLET.test(raw) ? "ul" : NUMBERED.test(raw) ? "ol" : "p";
    const line = type === "p" ? raw.trim() : raw.replace(type === "ul" ? BULLET : NUMBERED, "");
    const last = blocks[blocks.length - 1];
    // Lists continue across blank lines; paragraphs break on them.
    if (last && last.type === type && (type !== "p" || !previousBlank)) last.lines.push(line);
    else blocks.push({ type, lines: [line] });
    previousBlank = false;
  }
  return blocks;
}

function inline(line: string): ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
}
