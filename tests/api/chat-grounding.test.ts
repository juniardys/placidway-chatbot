import { describe, expect, test } from "vitest";
import { streamGroundedAnswer } from "../../src/lib/chat/answer";

describe("grounded answer", () => {
  test("returns unknown without evidence", async () => {
    const events = [];
    for await (const event of streamGroundedAnswer({ question: "price?", evidence: [] })) events.push(event);
    expect(events[0]).toMatchObject({ type: "delta" });
    expect(events.at(-1)).toEqual({ type: "done" });
    expect(events.some((event) => event.type === "citations")).toBe(false);
  });

  test("emits only validated citation metadata", async () => {
    const events = [];
    for await (const event of streamGroundedAnswer({ question: "price?", evidence: [{ id: "1", content: "Price", sourceId: "s", title: "Source", url: "https://example.com", similarity: 0.9 }, { id: "2", content: "bad", sourceId: "", title: "", url: "bad", similarity: 0.9 }] })) events.push(event);
    const citation = events.find((event) => event.type === "citations");
    expect(citation).toMatchObject({ citations: [{ id: "1" }] });
  });
});
