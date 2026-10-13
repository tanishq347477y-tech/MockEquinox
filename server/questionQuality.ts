import { createHash } from "node:crypto";

export function normalizeQuestionText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*([+\-*/=()])\s*/g, "$1")
    .replace(/[^a-z0-9+\-*/=().,? ]/g, "")
    .trim();
}

export function createQuestionFingerprint(stem: string, options: string[]) {
  const normalized = [normalizeQuestionText(stem), ...options.map(normalizeQuestionText).sort()].join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

export function scoreQuestionQuality(input: { stem: string; options: string[]; correctOption?: string | null; explanation?: string | null }) {
  const trimmedStem = input.stem.trim();
  const populatedOptions = input.options.filter(option => option.trim().length > 0);
  let score = 0;
  if (trimmedStem.length >= 20) score += 25;
  if (trimmedStem.endsWith("?") || /\b(find|which|what|calculate|determine)\b/i.test(trimmedStem)) score += 15;
  if (populatedOptions.length === 4) score += 25;
  if (new Set(populatedOptions.map(normalizeQuestionText)).size === populatedOptions.length) score += 15;
  if (input.correctOption && populatedOptions.includes(input.correctOption)) score += 10;
  if (input.explanation && input.explanation.trim().length >= 30) score += 10;
  return Math.min(100, score);
}
