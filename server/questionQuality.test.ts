import { describe, expect, it } from "vitest";
import { createQuestionFingerprint, scoreQuestionQuality } from "./questionQuality";

describe("question-quality utilities", () => {
  it("normalizes equivalent questions into a stable duplicate fingerprint", () => {
    const first = createQuestionFingerprint("What is 2 + 2?", ["1", "2", "3", "4"]);
    const reordered = createQuestionFingerprint("  WHAT is 2+2? ", ["4", "3", "2", "1"]);
    expect(first).toBe(reordered);
  });

  it("rewards complete, distinct, answerable questions", () => {
    expect(scoreQuestionQuality({
      stem: "Which physical quantity remains constant for an object moving with uniform velocity?",
      options: ["Acceleration", "Velocity", "Momentum", "Displacement"],
      correctOption: "Velocity",
      explanation: "Uniform velocity means both speed and direction remain unchanged over the chosen interval.",
    })).toBeGreaterThanOrEqual(85);
  });
});
