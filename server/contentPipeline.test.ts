import { describe, expect, it, vi } from "vitest";
import { requestStructuredLlm } from "./llm";
import {
  validateExtractedQuestion,
  validateExtractedQuestionsWithAi,
} from "./contentPipeline";

vi.mock("./llm", () => ({ requestStructuredLlm: vi.fn() }));

const mockedRequest = vi.mocked(requestStructuredLlm);

describe("validateExtractedQuestion", () => {
  it("accepts complete distinct MCQ drafts and rejects incomplete or ambiguous drafts", () => {
    expect(
      validateExtractedQuestion({
        stem: "Which quantity stays unchanged for a body in uniform velocity motion?",
        options: ["Acceleration", "Velocity", "Net force", "Displacement"],
        correctIndex: 1,
        explanation: "Uniform velocity is constant in magnitude and direction.",
        confidence: 91,
      })
    ).toBe(true);
    expect(
      validateExtractedQuestion({
        stem: "Short",
        options: ["A", "A", "C", "D"],
        correctIndex: 7,
        explanation: "",
        confidence: 101,
      })
    ).toBe(false);
  });
});

describe("validateExtractedQuestionsWithAi", () => {
  it("normalizes malformed verdict fields while preserving one result per question", async () => {
    mockedRequest.mockResolvedValueOnce(
      JSON.stringify({
        validations: [
          {
            verdict: "unknown",
            confidence: 140,
            issues: ["Ambiguous wording", 7],
            explanationQuality: -2,
            suggestedExplanation:
              "The answer follows from the stated condition.",
          },
        ],
      })
    );
    const result = await validateExtractedQuestionsWithAi([
      {
        stem: "Which quantity stays unchanged for a body in uniform velocity motion?",
        options: ["Acceleration", "Velocity", "Net force", "Displacement"],
        correctIndex: 1,
        explanation: "Uniform velocity is constant in magnitude and direction.",
        confidence: 91,
      },
    ]);
    expect(result).toEqual([
      {
        verdict: "needs_review",
        confidence: 100,
        issues: ["Ambiguous wording"],
        explanationQuality: 0,
        suggestedExplanation: "The answer follows from the stated condition.",
        questionIndex: 0,
      },
    ]);
  });

  it("rejects an incomplete validation batch instead of silently approving content", async () => {
    mockedRequest.mockResolvedValueOnce(JSON.stringify({ validations: [] }));
    await expect(
      validateExtractedQuestionsWithAi([
        {
          stem: "Which quantity stays unchanged for a body in uniform velocity motion?",
          options: ["Acceleration", "Velocity", "Net force", "Displacement"],
          correctIndex: 1,
          explanation:
            "Uniform velocity is constant in magnitude and direction.",
          confidence: 91,
        },
      ])
    ).rejects.toThrow("incomplete question validation batch");
  });
});
