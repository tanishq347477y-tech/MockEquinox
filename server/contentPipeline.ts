import { ENV } from "./_core/env";
import { requestStructuredLlm } from "./llm";

export type ExtractedQuestion = {
  stem: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  confidence: number;
};

export type AiQuestionValidation = {
  verdict: "pass" | "needs_review" | "reject";
  confidence: number;
  issues: string[];
  explanationQuality: number;
  suggestedExplanation: string;
};

export function validateExtractedQuestion(value: ExtractedQuestion) {
  return (
    value.stem.trim().length >= 20 &&
    value.options.every(option => option.trim().length > 0) &&
    new Set(value.options.map(option => option.trim().toLowerCase())).size ===
      4 &&
    Number.isInteger(value.correctIndex) &&
    value.correctIndex >= 0 &&
    value.correctIndex < 4 &&
    Number.isInteger(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 100
  );
}

const validationSchema = {
  type: "object",
  properties: {
    validations: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          verdict: { type: "string", enum: ["pass", "needs_review", "reject"] },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          issues: { type: "array", maxItems: 8, items: { type: "string" } },
          explanationQuality: { type: "integer", minimum: 0, maximum: 100 },
          suggestedExplanation: { type: "string", maxLength: 1200 },
        },
        required: [
          "verdict",
          "confidence",
          "issues",
          "explanationQuality",
          "suggestedExplanation",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["validations"],
  additionalProperties: false,
};

export async function validateExtractedQuestionsWithAi(
  questions: ExtractedQuestion[]
): Promise<Array<AiQuestionValidation & { questionIndex: number }>> {
  if (questions.length === 0) return [];
  const content = await requestStructuredLlm({
    model: ENV.llmModel,
    messages: [
      {
        role: "system",
        content:
          "Audit each extracted question without rewriting it. Check whether exactly one answer is defensible from the provided wording, whether any option is duplicated or ambiguous, whether the explanation supports the answer, and whether the question is self-contained. Do not infer missing source facts. Use reject only for clearly unusable material; use needs_review whenever human judgment is required. If the explanation is missing or weak, provide a concise suggestedExplanation using only the question and options; otherwise repeat the supplied explanation. This is a reviewer aid, never an authoritative answer.",
      },
      {
        role: "user",
        content: JSON.stringify({
          questions: questions.map((question, index) => ({
            index,
            ...question,
          })),
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "question_validation_batch",
        strict: true,
        schema: validationSchema,
      },
    },
  });
  const parsed = JSON.parse(content) as { validations?: unknown[] };
  if (
    !Array.isArray(parsed.validations) ||
    parsed.validations.length !== questions.length
  )
    throw new Error(
      "The AI provider returned an incomplete question validation batch."
    );
  return parsed.validations.map((value, index) => {
    const candidate = value as Partial<AiQuestionValidation>;
    const verdict =
      candidate.verdict === "pass" ||
      candidate.verdict === "reject" ||
      candidate.verdict === "needs_review"
        ? candidate.verdict
        : "needs_review";
    const confidence = Number.isInteger(candidate.confidence)
      ? Math.max(0, Math.min(100, candidate.confidence as number))
      : 0;
    const explanationQuality = Number.isInteger(candidate.explanationQuality)
      ? Math.max(0, Math.min(100, candidate.explanationQuality as number))
      : 0;
    const issues = Array.isArray(candidate.issues)
      ? candidate.issues.filter(item => typeof item === "string").slice(0, 8)
      : ["AI returned no structured issue list."];
    const suggestedExplanation =
      typeof candidate.suggestedExplanation === "string"
        ? candidate.suggestedExplanation.trim().slice(0, 1200)
        : "";
    return {
      verdict,
      confidence,
      explanationQuality,
      issues: issues.length ? issues : ["No issues reported."],
      suggestedExplanation,
      questionIndex: index,
    };
  });
}

const extractionSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          stem: { type: "string" },
          options: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "string" },
          },
          correctIndex: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string" },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: [
          "stem",
          "options",
          "correctIndex",
          "explanation",
          "confidence",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

export async function extractQuestionsFromText(
  sourceText: string
): Promise<ExtractedQuestion[]> {
  const content = await requestStructuredLlm({
    model: ENV.llmModel,
    messages: [
      {
        role: "system",
        content:
          "Extract only self-contained single-correct multiple-choice questions. Never invent missing facts. Return an empty list for ambiguous or incomplete material. The output is a reviewer draft, not publishable content.",
      },
      { role: "user", content: sourceText },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "extracted_question_batch",
        strict: true,
        schema: extractionSchema,
      },
    },
  });
  const parsed = JSON.parse(content) as { questions: ExtractedQuestion[] };
  return parsed.questions.filter(validateExtractedQuestion);
}

export async function extractQuestionsFromPdf(
  pdfUrl: string
): Promise<ExtractedQuestion[]> {
  const content = await requestStructuredLlm({
    model: ENV.llmPdfModel,
    messages: [
      {
        role: "system",
        content:
          "Extract only self-contained, single-correct multiple-choice questions from this PDF. Preserve the source wording when it is readable. Never invent missing questions, answer options, or answer keys. Return an empty list for incomplete or ambiguous material. Every result is a reviewer draft and must not be treated as publishable content.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Create at most 20 validated MCQ drafts from this source PDF.",
          },
          {
            type: "file_url",
            file_url: { url: pdfUrl, mime_type: "application/pdf" },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "pdf_question_batch",
        strict: true,
        schema: extractionSchema,
      },
    },
  });
  const parsed = JSON.parse(content) as { questions: ExtractedQuestion[] };
  return parsed.questions.filter(validateExtractedQuestion);
}
