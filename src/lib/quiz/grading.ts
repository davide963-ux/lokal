import { randomInt } from "node:crypto";
import type { IssuedQuestion, PlayQuestion, QuizSnapshot } from "./types";

export type Rng = (maxExclusive: number) => number;
const secureRng: Rng = (n) => randomInt(n);

/** Fisher–Yates; returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng = secureRng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Decides which questions an attempt contains and in what order, per the quiz settings.
 * - questionCount < pool size: a random subset is drawn (kept in authored order unless randomizing).
 * - randomizeAnswers shuffles multiple-choice options; True/False always stays True, False.
 */
export function issueQuestions(snapshot: QuizSnapshot, rng: Rng = secureRng): IssuedQuestion[] {
  const { settings, questions } = snapshot;
  let chosen = questions;
  if (settings.questionCount && settings.questionCount < questions.length) {
    const keep = new Set(shuffle(questions.map((q) => q.id), rng).slice(0, settings.questionCount));
    chosen = questions.filter((q) => keep.has(q.id));
  }
  if (settings.randomizeQuestions) chosen = shuffle(chosen, rng);
  return chosen.map((q) => {
    const ids = q.options.map((o) => o.id);
    return { questionId: q.id, optionIds: settings.randomizeAnswers && q.type === "MULTIPLE_CHOICE" ? shuffle(ids, rng) : ids };
  });
}

/** Rebuilds the answer-free view the browser may see from the locked-in issue. */
export function toPlayQuestions(snapshot: QuizSnapshot, issued: IssuedQuestion[]): PlayQuestion[] {
  const byId = new Map(snapshot.questions.map((q) => [q.id, q]));
  return issued.flatMap((iq) => {
    const q = byId.get(iq.questionId);
    if (!q) return [];
    const opts = new Map(q.options.map((o) => [o.id, o]));
    return [{
      id: q.id,
      text: q.text,
      type: q.type,
      options: iq.optionIds.flatMap((id) => (opts.has(id) ? [{ id, text: opts.get(id)!.text }] : [])),
    }];
  });
}

export type GradedQuestion = {
  questionId: string;
  questionText: string;
  selectedOptionId: string | null;
  selectedText: string | null;
  correctOptionId: string;
  correctText: string;
  explanation: string | null;
  isCorrect: boolean;
};
export type GradeResult = { questions: GradedQuestion[]; correct: number; total: number; score: number; passed: boolean };

export class InvalidSubmission extends Error {}

/**
 * Server-side grading. `answers` maps questionId → optionId and is treated as hostile input:
 * unknown questions or options that were not issued for that question are rejected outright.
 * Unanswered questions count as incorrect.
 * score = round(correct / total × 100); a pass requires score >= passingScore (what the learner sees is what counts).
 */
export function gradeAttempt(
  snapshot: QuizSnapshot,
  issued: IssuedQuestion[],
  answers: Record<string, string | undefined>,
  passingScore: number,
): GradeResult {
  const issuedById = new Map(issued.map((i) => [i.questionId, i]));
  for (const [qid, oid] of Object.entries(answers)) {
    if (oid === undefined) continue;
    const iq = issuedById.get(qid);
    if (!iq) throw new InvalidSubmission("Answer for a question that is not part of this attempt.");
    if (!iq.optionIds.includes(oid)) throw new InvalidSubmission("Answer is not one of the options offered.");
  }
  const qById = new Map(snapshot.questions.map((q) => [q.id, q]));
  const questions: GradedQuestion[] = issued.map((iq) => {
    const q = qById.get(iq.questionId);
    const correct = q?.options.find((o) => o.isCorrect);
    if (!q || !correct) throw new InvalidSubmission("Quiz data is inconsistent.");
    const selectedId = answers[iq.questionId] ?? null;
    const selected = q.options.find((o) => o.id === selectedId);
    return {
      questionId: q.id, questionText: q.text,
      selectedOptionId: selected?.id ?? null, selectedText: selected?.text ?? null,
      correctOptionId: correct.id, correctText: correct.text, explanation: q.explanation,
      isCorrect: selected?.id === correct.id,
    };
  });
  const total = questions.length;
  const correctCount = questions.filter((q) => q.isCorrect).length;
  const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  return { questions, correct: correctCount, total, score, passed: total > 0 && score >= passingScore };
}
