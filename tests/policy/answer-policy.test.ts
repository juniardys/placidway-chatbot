import { describe, expect, test } from "bun:test";
import { classifyQuestion } from "../../src/lib/policy/answer-policy";
import { UNSUPPORTED_PREMISE_RESPONSE } from "../../src/lib/constants";

describe("answer policy", () => {
  test.each([
    ["What is the price?", "cost"],
    ["Compare Turkey and Thailand", "comparison"],
    ["What does the package include?", "package"],
    ["What about recovery time?", "follow-up"],
    ["book appointment", "appointment"],
    ["What is the weather?", "out-of-scope"],
    ["Is this safe for me?", "medical"],
    ["Is it really only $50?", "unsupported-premise"],
  ] as const)("classifies %s as %s", (question, kind) => {
    expect(classifyQuestion(question).kind).toBe(kind);
  });

  test("comparison requires evidence for both sides", () => {
    const decision = classifyQuestion("Compare Turkey and Thailand");
    expect(decision.requireEvidence).toBe(true);
    expect(decision.requireComparisonSides).toBe(true);
  });

  test("cost, package, and follow-up require evidence", () => {
    for (const question of ["What is the price?", "What is included?", "What about recovery?"]) {
      expect(classifyQuestion(question).requireEvidence).toBe(true);
    }
  });

  test("unsupported premise has explicit controlled response", () => {
    expect(classifyQuestion("Is it really only $50?").response).toBe(UNSUPPORTED_PREMISE_RESPONSE);
  });

  test("ordinary numeric price question remains cost", () => {
    expect(classifyQuestion("How much does the package cost in USD 2,000?").kind).toBe("cost");
  });
});
