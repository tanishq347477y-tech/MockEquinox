import { describe, expect, it } from "vitest";
import { canTransitionAttempt, scoreAttempt } from "./testEngine";

describe("scoreAttempt", () => {
  it("uses deterministic negative marking and preserves skipped answers", () => {
    const result = scoreAttempt([
      { questionId: 1, selectedOption: "A", correctOption: "A", positiveMarks: 4, negativeMarks: 1, subject: "Physics", topic: "Mechanics", elapsedSeconds: 40 },
      { questionId: 2, selectedOption: "C", correctOption: "B", positiveMarks: 4, negativeMarks: 1, subject: "Physics", topic: "Mechanics", elapsedSeconds: 58 },
      { questionId: 3, selectedOption: null, correctOption: "D", positiveMarks: 4, negativeMarks: 1, subject: "Chemistry", topic: "Atomic structure", elapsedSeconds: 0 },
    ]);

    expect(result).toMatchObject({ correct: 1, incorrect: 1, skipped: 1, score: 3, maximumScore: 12, accuracy: 50 });
    expect(result.subjectBreakdown.Physics).toMatchObject({ correct: 1, incorrect: 1, score: 3 });
    expect(result.topicBreakdown["Atomic structure"]).toMatchObject({ skipped: 1, score: 0 });
    expect(result.questionBreakdown).toEqual([
      { questionId: 1, status: "correct", score: 4, elapsedSeconds: 40 },
      { questionId: 2, status: "incorrect", score: -1, elapsedSeconds: 58 },
      { questionId: 3, status: "skipped", score: 0, elapsedSeconds: 0 },
    ]);
  });
});

describe("canTransitionAttempt", () => {
  it("allows only explicit test-state transitions", () => {
    expect(canTransitionAttempt("IN_PROGRESS", "SUBMITTED")).toBe(true);
    expect(canTransitionAttempt("SUBMITTED", "IN_PROGRESS")).toBe(false);
    expect(canTransitionAttempt("INVALIDATED", "SUBMITTED")).toBe(false);
  });
});
