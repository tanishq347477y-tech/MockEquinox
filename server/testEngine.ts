export type AttemptAnswer = {
  questionId: number;
  selectedOption: string | null;
  correctOption: string;
  positiveMarks: number;
  negativeMarks: number;
  subject: string;
  topic: string;
  elapsedSeconds: number;
};

export type ScoreSummary = {
  correct: number;
  incorrect: number;
  skipped: number;
  score: number;
  maximumScore: number;
  accuracy: number;
  timeSpentSeconds: number;
  questionBreakdown: Array<{ questionId: number; status: "correct" | "incorrect" | "skipped"; score: number; elapsedSeconds: number }>;
  subjectBreakdown: Record<string, { correct: number; incorrect: number; skipped: number; score: number }>;
  topicBreakdown: Record<string, { correct: number; incorrect: number; skipped: number; score: number }>;
};

type Bucket = { correct: number; incorrect: number; skipped: number; score: number };

function updateBucket(bucket: Bucket, answer: AttemptAnswer, mark: number) {
  if (!answer.selectedOption) bucket.skipped += 1;
  else if (answer.selectedOption === answer.correctOption) bucket.correct += 1;
  else bucket.incorrect += 1;
  bucket.score += mark;
}

export function scoreAttempt(answers: AttemptAnswer[]): ScoreSummary {
  const summary: ScoreSummary = {
    correct: 0,
    incorrect: 0,
    skipped: 0,
    score: 0,
    maximumScore: 0,
    accuracy: 0,
    timeSpentSeconds: 0,
    questionBreakdown: [],
    subjectBreakdown: {},
    topicBreakdown: {},
  };

  for (const answer of answers) {
    const mark = !answer.selectedOption
      ? 0
      : answer.selectedOption === answer.correctOption
        ? answer.positiveMarks
        : -answer.negativeMarks;
    const subjectBucket = summary.subjectBreakdown[answer.subject] ?? { correct: 0, incorrect: 0, skipped: 0, score: 0 };
    const topicBucket = summary.topicBreakdown[answer.topic] ?? { correct: 0, incorrect: 0, skipped: 0, score: 0 };

    updateBucket(subjectBucket, answer, mark);
    updateBucket(topicBucket, answer, mark);
    summary.subjectBreakdown[answer.subject] = subjectBucket;
    summary.topicBreakdown[answer.topic] = topicBucket;
    summary.maximumScore += answer.positiveMarks;
    summary.timeSpentSeconds += Math.max(0, answer.elapsedSeconds);
    summary.score += mark;

    summary.questionBreakdown.push({
      questionId: answer.questionId,
      status: !answer.selectedOption ? "skipped" : answer.selectedOption === answer.correctOption ? "correct" : "incorrect",
      score: mark,
      elapsedSeconds: Math.max(0, answer.elapsedSeconds),
    });

    if (!answer.selectedOption) summary.skipped += 1;
    else if (answer.selectedOption === answer.correctOption) summary.correct += 1;
    else summary.incorrect += 1;
  }

  const attempted = summary.correct + summary.incorrect;
  summary.accuracy = attempted === 0 ? 0 : Math.round((summary.correct / attempted) * 1000) / 10;
  summary.score = Math.round(summary.score * 100) / 100;
  return summary;
}

export function canTransitionAttempt(current: string, next: string) {
  const validTransitions: Record<string, string[]> = {
    CREATED: ["STARTED", "INVALIDATED"],
    STARTED: ["IN_PROGRESS", "EXPIRED", "FORCE_SUBMITTED", "INVALIDATED"],
    IN_PROGRESS: ["SUBMITTED", "ABANDONED", "EXPIRED", "FORCE_SUBMITTED", "INVALIDATED"],
    SUBMITTED: ["EVALUATED", "INVALIDATED"],
    EVALUATED: ["ANALYTICS_GENERATED"],
    ANALYTICS_GENERATED: [],
    ABANDONED: ["IN_PROGRESS", "EXPIRED", "FORCE_SUBMITTED"],
    EXPIRED: ["FORCE_SUBMITTED"],
    FORCE_SUBMITTED: ["EVALUATED"],
    INVALIDATED: [],
  };
  return validTransitions[current]?.includes(next) ?? false;
}
