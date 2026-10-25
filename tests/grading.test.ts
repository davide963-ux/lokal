import { describe, expect, it } from "vitest";
import { gradeAttempt, InvalidSubmission, issueQuestions, shuffle, toPlayQuestions } from "@/lib/quiz/grading";
import { questionInput } from "@/lib/validation/quiz";
import type { QuizSettings, QuizSnapshot } from "@/lib/quiz/types";

const mc = (n: number) => ({
  id: `q${n}`, text: `Question ${n}`, type: "MULTIPLE_CHOICE" as const, explanation: `Because ${n}`,
  options: [
    { id: `q${n}a`, text: "A", isCorrect: false },
    { id: `q${n}b`, text: "B", isCorrect: true },
    { id: `q${n}c`, text: "C", isCorrect: false },
    { id: `q${n}d`, text: "D", isCorrect: false },
  ],
});
const tf = {
  id: "qtf", text: "Carbonara contains eggs.", type: "TRUE_FALSE" as const, explanation: null,
  options: [{ id: "qtf-t", text: "True", isCorrect: true }, { id: "qtf-f", text: "False", isCorrect: false }],
};
const settings: QuizSettings = { passingScore: 80, allowRetries: true, questionCount: null, randomizeQuestions: false, randomizeAnswers: false, showCorrectAnswers: true };
const snap = (over: Partial<QuizSettings> = {}, n = 5): QuizSnapshot => ({
  title: "T", settings: { ...settings, ...over }, questions: [...Array.from({ length: n - 1 }, (_, i) => mc(i + 1)), tf],
});
const seqRng = (...vals: number[]) => { let i = 0; return (max: number) => vals[i++ % vals.length]! % max; };

describe("grading", () => {
  it("scores correct answers and applies the pass threshold exactly", () => {
    const s = snap();
    const issued = issueQuestions(s);
    const allCorrect = { q1: "q1b", q2: "q2b", q3: "q3b", q4: "q4b", qtf: "qtf-t" };
    expect(gradeAttempt(s, issued, allCorrect, 80)).toMatchObject({ correct: 5, total: 5, score: 100, passed: true });
    const fourOfFive = { ...allCorrect, q4: "q4a" };
    expect(gradeAttempt(s, issued, fourOfFive, 80)).toMatchObject({ correct: 4, score: 80, passed: true }); // boundary: 80 passes 80
    expect(gradeAttempt(s, issued, fourOfFive, 81)).toMatchObject({ score: 80, passed: false });
    expect(gradeAttempt(s, issued, { ...fourOfFive, q3: "q3c" }, 80)).toMatchObject({ correct: 3, score: 60, passed: false });
  });
  it("unanswered questions are incorrect; an empty submission scores 0", () => {
    const s = snap();
    const res = gradeAttempt(s, issueQuestions(s), {}, 80);
    expect(res).toMatchObject({ correct: 0, score: 0, passed: false });
    expect(res.questions.every((q) => q.selectedOptionId === null)).toBe(true);
  });
  it("true/false grades like any other question", () => {
    const s = snap({}, 1);
    expect(gradeAttempt(s, issueQuestions(s), { qtf: "qtf-f" }, 50)).toMatchObject({ score: 0, passed: false });
    expect(gradeAttempt(s, issueQuestions(s), { qtf: "qtf-t" }, 50)).toMatchObject({ score: 100, passed: true });
  });
  it("rejects tampered submissions: foreign questions, options never offered, options from other questions", () => {
    const s = snap();
    const issued = issueQuestions(s);
    expect(() => gradeAttempt(s, issued, { nope: "q1b" }, 80)).toThrow(InvalidSubmission);
    expect(() => gradeAttempt(s, issued, { q1: "made-up" }, 80)).toThrow(InvalidSubmission);
    expect(() => gradeAttempt(s, issued, { q1: "q2b" }, 80)).toThrow(InvalidSubmission);
  });
  it("only questions issued to the attempt count (subset quizzes)", () => {
    const s = snap({ questionCount: 2 });
    const issued = issueQuestions(s);
    expect(issued).toHaveLength(2);
    expect(() => gradeAttempt(s, issued, { [s.questions.find((q) => !issued.some((i) => i.questionId === q.id))!.id]: "x" }, 80)).toThrow(InvalidSubmission);
    expect(gradeAttempt(s, issued, {}, 80).total).toBe(2);
  });
  it("grades against the snapshot, so later edits to the live quiz cannot change a result", () => {
    const s = snap();
    const issued = issueQuestions(s);
    const before = gradeAttempt(s, issued, { q1: "q1b" }, 80);
    const edited = structuredClone(s); // manager later changes the correct answer in a *new* revision
    edited.questions[0]!.options.forEach((o) => (o.isCorrect = o.id === "q1a"));
    expect(gradeAttempt(s, issued, { q1: "q1b" }, 80).questions[0]!.isCorrect).toBe(before.questions[0]!.isCorrect);
    expect(gradeAttempt(edited, issued, { q1: "q1b" }, 80).questions[0]!.isCorrect).toBe(false);
  });
});

describe("question issuing", () => {
  it("keeps authored order by default and never shuffles True/False", () => {
    const s = snap({ randomizeAnswers: true });
    const issued = issueQuestions(s, seqRng(1, 2, 3, 0));
    expect(issued.map((i) => i.questionId)).toEqual(s.questions.map((q) => q.id));
    expect(issued.find((i) => i.questionId === "qtf")!.optionIds).toEqual(["qtf-t", "qtf-f"]);
  });
  it("randomizes questions and answers while keeping the same members", () => {
    const s = snap({ randomizeQuestions: true, randomizeAnswers: true });
    let moved = false;
    for (let i = 0; i < 20; i++) {
      const issued = issueQuestions(s);
      expect([...issued.map((x) => x.questionId)].sort()).toEqual(s.questions.map((q) => q.id).sort());
      for (const iq of issued) expect([...iq.optionIds].sort()).toEqual(s.questions.find((q) => q.id === iq.questionId)!.options.map((o) => o.id).sort());
      if (issued.map((x) => x.questionId).join() !== s.questions.map((q) => q.id).join()) moved = true;
    }
    expect(moved).toBe(true);
  });
  it("draws a random subset of the requested size", () => {
    const seen = new Set<string>();
    const s = snap({ questionCount: 2 }, 6);
    for (let i = 0; i < 40; i++) { const iq = issueQuestions(s); expect(new Set(iq.map((x) => x.questionId)).size).toBe(2); iq.forEach((x) => seen.add(x.questionId)); }
    expect(seen.size).toBeGreaterThan(2);
  });
  it("shuffle is a permutation", () => {
    expect(shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("the browser view never contains correctness or explanations", () => {
    const s = snap();
    const play = toPlayQuestions(s, issueQuestions(s));
    const json = JSON.stringify(play);
    expect(json).not.toContain("isCorrect");
    expect(json).not.toContain("Because");
    expect(play[0]!.options[0]).toEqual({ id: "q1a", text: "A" });
  });
});

describe("question validation", () => {
  const ok = { questionText: "Q?", questionType: "MULTIPLE_CHOICE" as const, options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }] };
  it("accepts a valid multiple choice and true/false question", () => {
    expect(questionInput.safeParse(ok).success).toBe(true);
    expect(questionInput.safeParse({ questionText: "Q", questionType: "TRUE_FALSE", trueFalseAnswer: false }).success).toBe(true);
  });
  it("rejects: <2 answers, zero/multiple correct, duplicates, >6, empty text, missing T/F answer", () => {
    expect(questionInput.safeParse({ ...ok, options: [{ text: "A", isCorrect: true }] }).success).toBe(false);
    expect(questionInput.safeParse({ ...ok, options: [{ text: "A", isCorrect: false }, { text: "B", isCorrect: false }] }).success).toBe(false);
    expect(questionInput.safeParse({ ...ok, options: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: true }] }).success).toBe(false);
    expect(questionInput.safeParse({ ...ok, options: [{ text: "A", isCorrect: true }, { text: " a ", isCorrect: false }] }).success).toBe(false);
    expect(questionInput.safeParse({ ...ok, options: Array.from({ length: 7 }, (_, i) => ({ text: `o${i}`, isCorrect: i === 0 })) }).success).toBe(false);
    expect(questionInput.safeParse({ ...ok, questionText: "  " }).success).toBe(false);
    expect(questionInput.safeParse({ questionText: "Q", questionType: "TRUE_FALSE" }).success).toBe(false);
  });
});
