export type ToolEvidence = {
  sourceId: string;
  title: string;
  url: string;
  section?: string;
  content: string;
  similarity: number;
};

/** Public citation metadata; chunk text and scores stay server-side. */
export type Citation = Pick<ToolEvidence, "sourceId" | "title" | "url" | "section">;

export type AgentEvent =
  | { type: "thinking"; message: string }
  | { type: "tool_start"; tool: "search_placidway_knowledge"; query: string }
  | { type: "tool_result"; sources: number; chunks: number }
  | { type: "answer_start" }
  | { type: "delta"; text: string }
  | { type: "citation"; citation: Citation }
  | { type: "done" }
  | { type: "error"; message: string };

export function isAgentEvent(value: unknown): value is AgentEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  if (typeof event.type !== "string") return false;
  if (event.type === "thinking" || event.type === "delta")
    return typeof event.message === "string" || typeof event.text === "string";
  if (event.type === "tool_result")
    return Number.isInteger(event.sources) && Number(event.sources) >= 0 && Number.isInteger(event.chunks) && Number(event.chunks) >= 0;
  return ["tool_start", "answer_start", "citation", "done", "error"].includes(event.type);
}

export type ChatMessage = { role: "user" | "assistant"; content: string };
