export type PolicyDecision = {
  kind: "answer" | "unknown" | "medical" | "appointment" | "out-of-scope";
  response?: string;
};
export function classifyQuestion(q: string): PolicyDecision {
  const s = q.toLowerCase();
  if (/diagnos|safe for me|should i take|am i a candidate/.test(s))
    return {
      kind: "medical",
      response:
        "I can provide information from PlacidWay pages, but cannot diagnose or determine whether treatment is safe for you. Please consult a qualified doctor.",
    };
  if (/book|appointment|schedule/.test(s))
    return {
      kind: "appointment",
      response:
        "I cannot book appointments. Please contact PlacidWay for assistance or a free quote.",
    };
  if (/weather|stock price|politics|recipe/.test(s))
    return {
      kind: "out-of-scope",
      response:
        "I can only answer questions about information in the approved PlacidWay content.",
    };
  return { kind: "answer" };
}
export const UNKNOWN_RESPONSE =
  "I could not find that information in the approved PlacidWay content. Please contact PlacidWay for a free quote.";
