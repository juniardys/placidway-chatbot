import {
  APPOINTMENT_RESPONSE,
  COMPARISON_INSUFFICIENT_RESPONSE,
  MEDICAL_DISCLAIMER,
  OUT_OF_SCOPE_RESPONSE,
  UNSUPPORTED_PREMISE_RESPONSE,
  UNKNOWN_RESPONSE,
} from "../constants";

export type PolicyKind =
  | "factual"
  | "cost"
  | "comparison"
  | "package"
  | "follow-up"
  | "appointment"
  | "out-of-scope"
  | "medical"
  | "unsupported-premise";

export type PolicyDecision = {
  kind: PolicyKind;
  requireEvidence?: boolean;
  requireComparisonSides?: boolean;
  insufficientComparisonResponse?: string;
  response?: string;
  disclaimerRequired?: boolean;
};

const has = (value: string, pattern: RegExp) => pattern.test(value);

/** Classify before retrieval/model generation. Rules intentionally stay conservative. */
export function classifyQuestion(question: string): PolicyDecision {
  const s = question.trim().toLowerCase();

  if (
    has(s, /diagnos|safe for me|is it safe|should i take|am i a candidate|recommend.*treatment|what treatment.*for me/) 
  ) {
    return {
      kind: "medical",
      response: MEDICAL_DISCLAIMER,
      disclaimerRequired: true,
    };
  }

  if (has(s, /book|appointment|schedule|reserve|availability.*clinic|available.*appointment/)) {
    return { kind: "appointment", response: APPOINTMENT_RESPONSE };
  }

  if (has(s, /weather|stock price|politic|recipe|sports score|joke|write.*code|latest news/)) {
    return { kind: "out-of-scope", response: OUT_OF_SCOPE_RESPONSE };
  }

  // A stated amount is not evidence of the actual price. Refuse premise instead of guessing.
  if (
    has(s, /does .* cost|is .* \$\s*\d|is .*\b\d[\d,]*(?:\.\d+)?\s*(?:usd|dollars?|€|eur|£|gbp)\b/) &&
    has(s, /really|จริง|จริงไหม|listed|advertised|only|just|available|available for|เชื่อม/) 
  ) {
    return { kind: "unsupported-premise", requireEvidence: true, response: UNSUPPORTED_PREMISE_RESPONSE };
  }

  if (has(s, /compare|comparison|versus|\bvs\.?\b|difference between|which is (?:cheaper|better)/)) {
    return {
      kind: "comparison",
      requireEvidence: true,
      requireComparisonSides: true,
      insufficientComparisonResponse: COMPARISON_INSUFFICIENT_RESPONSE,
    };
  }

  if (has(s, /price|cost|how much|fee|starting from|expensive|budget|料金/)) {
    return { kind: "cost", requireEvidence: true };
  }

  if (has(s, /package|what(?:'s| is) included|includes|inclusions|procedure|treatment.*include/)) {
    return { kind: "package", requireEvidence: true };
  }

  if (
    has(s, /\b(it|that|this|they|there)\b|what about|how long|recovery|after (?:that|the procedure)|and what/) &&
    has(s, /\b(about|after|then|also|that|this|it|they|there)\b|\?$/)
  ) {
    return { kind: "follow-up", requireEvidence: true };
  }

  return { kind: "factual", requireEvidence: true };
}

export { UNKNOWN_RESPONSE } from "../constants";
