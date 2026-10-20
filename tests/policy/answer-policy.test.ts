import { describe, expect, test } from "bun:test";
import { classifyQuestion } from "../../src/lib/policy/answer-policy";
describe("answer policy", () => {
  test("medical question is cautious", () =>
    expect(classifyQuestion("Is this safe for me?").kind).toBe("medical"));
  test("appointment is refused", () =>
    expect(classifyQuestion("book appointment").kind).toBe("appointment"));
});
