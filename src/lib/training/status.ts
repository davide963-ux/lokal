// Pure training-state rules (no database). Used by the dashboard, dish pages and the quiz gate.

export type StudyState = "NOT_STUDIED" | "NEEDS_REVIEW" | "STUDIED";
export type QuizState = "NONE" | "LOCKED" | "AVAILABLE" | "PASSED" | "FAILED";

export type DishStatusInput = {
  revisions: { version: number; requiresRetraining: boolean }[];
  /** Versions of this dish the employee has acknowledged. */
  studiedVersions: number[];
  /** Published quiz for the dish, if any. */
  quiz: { allowRetries: boolean } | null;
  /** Submitted attempts only. */
  attempts: { score: number; passed: boolean; dishVersion: number; submittedAt: Date }[];
};

export type DishStatus = {
  latestVersion: number;
  /** Lowest dish version whose study/quiz still counts (raised by "requires retraining" updates). */
  requiredVersion: number;
  studyState: StudyState;
  studiedVersion: number | null;
  /** Studied an older version while a newer one exists (soft notice, even without mandatory retraining). */
  updatedSinceStudied: boolean;
  quizState: QuizState;
  attemptsCount: number;
  lastScore: number | null;
  bestScore: number | null;
  /** May start (another) attempt right now. */
  canStartQuiz: boolean;
  complete: boolean;
};

export function computeDishStatus(i: DishStatusInput): DishStatus {
  const latestVersion = Math.max(0, ...i.revisions.map((r) => r.version));
  const flagged = i.revisions.filter((r) => r.requiresRetraining).map((r) => r.version);
  const requiredVersion = flagged.length ? Math.max(...flagged) : Math.min(1, latestVersion);
  const studiedVersion = i.studiedVersions.length ? Math.max(...i.studiedVersions) : null;

  const studyState: StudyState =
    studiedVersion === null ? "NOT_STUDIED" : studiedVersion >= requiredVersion ? "STUDIED" : "NEEDS_REVIEW";

  const current = i.attempts.filter((a) => a.dishVersion >= requiredVersion).sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  const last = current.at(-1) ?? null;
  const best = current.length ? Math.max(...current.map((a) => a.score)) : null;

  let quizState: QuizState;
  if (!i.quiz) quizState = "NONE";
  else if (studyState !== "STUDIED") quizState = "LOCKED";
  else if (current.some((a) => a.passed)) quizState = "PASSED";
  else if (current.length > 0) quizState = "FAILED";
  else quizState = "AVAILABLE";

  // Retry rule: with retries off, a single attempt per training cycle is allowed.
  const canStartQuiz = !!i.quiz && studyState === "STUDIED" && (current.length === 0 || i.quiz.allowRetries);

  return {
    latestVersion, requiredVersion, studyState, studiedVersion,
    updatedSinceStudied: studiedVersion !== null && studiedVersion < latestVersion,
    quizState, attemptsCount: current.length, lastScore: last?.score ?? null, bestScore: best,
    canStartQuiz,
    complete: studyState === "STUDIED" && (quizState === "NONE" || quizState === "PASSED"),
  };
}
