import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createDish, publishDish, updateDish, archiveDish, unpublishDish } from "@/lib/services/dishes";
import {
  deleteQuestion, getOrCreateQuiz, hasUnpublishedChanges, moveQuestion, publishQuiz, saveQuestion, unpublishQuiz, updateQuizSettings,
} from "@/lib/services/quizzes";
import { acknowledgeStudy, getDishForEmployee, getEmployeeDashboard, listDishesForEmployee } from "@/lib/services/training";
import { getAttemptResult, getPlayAttempt, listAttempts, startAttempt, submitAttempt } from "@/lib/services/attempts";
import { makeCategory, makeUser, resetDb } from "./helpers";

let adminId: string, empId: string, dishId: string, quizId: string, categoryId: string;

const dishInput = (over = {}) => ({ name: "Carbonara", categoryId, allergensVerified: true, ...over });
const mcq = (text: string, correct = 1) => ({
  questionText: text, questionType: "MULTIPLE_CHOICE" as const, explanation: `Why: ${text}`,
  options: ["Cream", "Guanciale", "Chicken", "Tomato"].map((t, i) => ({ text: t, isCorrect: i === correct })),
});

async function buildQuiz(settings: Partial<Parameters<typeof updateQuizSettings>[1]> = {}) {
  quizId = (await getOrCreateQuiz(dishId)).id;
  await saveQuestion(quizId, null, mcq("Which ingredient is traditional?"));
  await saveQuestion(quizId, null, mcq("Which is NOT used?", 0));
  await saveQuestion(quizId, null, { questionText: "Carbonara contains eggs.", questionType: "TRUE_FALSE", trueFalseAnswer: true });
  await updateQuizSettings(quizId, { title: "Carbonara quiz", passingScore: 80, allowRetries: true, randomizeQuestions: false, randomizeAnswers: false, showCorrectAnswers: true, ...settings });
  await publishQuiz(quizId);
}

/** Answers every issued question correctly (looks answers up in the DB revision, as the grader does). */
async function correctAnswers(attemptId: string, wrongOn: number[] = []) {
  const a = await db.quizAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { quizRevision: true } });
  const snap = a.quizRevision.questionSnapshot as { questions: { id: string; options: { id: string; isCorrect: boolean }[] }[] };
  const issued = a.issuedQuestions as { questionId: string }[];
  const out: Record<string, string> = {};
  issued.forEach((iq, i) => {
    const q = snap.questions.find((x) => x.id === iq.questionId)!;
    out[q.id] = (wrongOn.includes(i) ? q.options.find((o) => !o.isCorrect) : q.options.find((o) => o.isCorrect))!.id;
  });
  return out;
}

beforeEach(async () => {
  await resetDb();
  adminId = (await makeUser({ role: "ADMIN" })).id;
  empId = (await makeUser({ name: "Marco" })).id;
  categoryId = (await makeCategory()).id;
  dishId = (await createDish(adminId, dishInput())).id;
  await publishDish(adminId, dishId);
});

describe("quiz builder", () => {
  it("one quiz per dish; supports multiple choice and true/false; reorder and delete keep order gap-free", async () => {
    const a = await getOrCreateQuiz(dishId);
    expect((await getOrCreateQuiz(dishId)).id).toBe(a.id);
    expect(await db.quiz.count()).toBe(1);
    const q1 = await saveQuestion(a.id, null, mcq("One"));
    const q2 = await saveQuestion(a.id, null, { questionText: "Two", questionType: "TRUE_FALSE", trueFalseAnswer: false });
    const q3 = await saveQuestion(a.id, null, mcq("Three"));
    const tf = await db.quizAnswerOption.findMany({ where: { questionId: q2.id }, orderBy: { sortOrder: "asc" } });
    expect(tf.map((o) => [o.answerText, o.isCorrect])).toEqual([["True", false], ["False", true]]);
    await moveQuestion(a.id, q3.id, "up");
    await moveQuestion(a.id, q1.id, "up"); // already first: no-op
    expect((await db.quizQuestion.findMany({ where: { quizId: a.id }, orderBy: { sortOrder: "asc" } })).map((q) => q.questionText)).toEqual(["One", "Three", "Two"]);
    await deleteQuestion(a.id, q1.id);
    expect((await db.quizQuestion.findMany({ where: { quizId: a.id }, orderBy: { sortOrder: "asc" } })).map((q) => q.sortOrder)).toEqual([0, 1]);
  });
  it("editing a question replaces its answers; cannot touch another quiz's question", async () => {
    const q = await getOrCreateQuiz(dishId);
    const { id } = await saveQuestion(q.id, null, mcq("Orig"));
    await saveQuestion(q.id, id, mcq("Edited", 3));
    expect(await db.quizAnswerOption.count({ where: { questionId: id } })).toBe(4);
    expect((await db.quizAnswerOption.findFirstOrThrow({ where: { questionId: id, isCorrect: true } })).answerText).toBe("Tomato");
    const otherDish = (await createDish(adminId, dishInput({ name: "Other" }))).id;
    const other = await getOrCreateQuiz(otherDish);
    await expect(saveQuestion(other.id, id, mcq("Hijack"))).rejects.toThrow(/not found/);
    await expect(deleteQuestion(other.id, id)).rejects.toThrow(/not found/);
  });
  it("incomplete quizzes cannot be published", async () => {
    const q = await getOrCreateQuiz(dishId);
    await expect(publishQuiz(q.id)).rejects.toThrow(/at least one question/);
    await saveQuestion(q.id, null, mcq("One"));
    await expect(updateQuizSettings(q.id, { title: "T", passingScore: 80, allowRetries: true, questionCount: 5, randomizeQuestions: false, randomizeAnswers: false, showCorrectAnswers: true })).rejects.toThrow(/only have 1/);
    await expect(updateQuizSettings(q.id, { title: "T", passingScore: 0, allowRetries: true, randomizeQuestions: false, randomizeAnswers: false, showCorrectAnswers: true })).rejects.toThrow();
    await expect(updateQuizSettings(q.id, { title: "T", passingScore: 101, allowRetries: true, randomizeQuestions: false, randomizeAnswers: false, showCorrectAnswers: true })).rejects.toThrow();
    expect((await db.quiz.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("DRAFT");
  });
  it("publishing snapshots the quiz as an immutable revision, notifies once, and detects later edits", async () => {
    await buildQuiz();
    expect(await db.quizRevision.count()).toBe(1);
    expect((await db.notification.findMany({ where: { type: "QUIZ_AVAILABLE" } })).map((n) => n.userId)).toEqual([empId]);
    expect(await hasUnpublishedChanges(quizId)).toBe(false);
    expect((await publishQuiz(quizId)).changed).toBe(false); // nothing changed → no new revision
    await saveQuestion(quizId, null, mcq("Fourth"));
    expect(await hasUnpublishedChanges(quizId)).toBe(true);
    expect(await publishQuiz(quizId)).toEqual({ version: 2, changed: true });
    const revs = await db.quizRevision.findMany({ orderBy: { version: "asc" } });
    expect((revs[0]!.questionSnapshot as { questions: unknown[] }).questions).toHaveLength(3); // v1 untouched
    expect((revs[1]!.questionSnapshot as { questions: unknown[] }).questions).toHaveLength(4);
    expect(await db.notification.count({ where: { type: "QUIZ_AVAILABLE" } })).toBe(1);
  });
});

describe("taking a quiz", () => {
  beforeEach(buildQuiz);

  it("is locked until the dish is studied; studying is idempotent", async () => {
    await expect(startAttempt(empId, dishId)).rejects.toThrow(/Study this dish/);
    const a = await acknowledgeStudy(empId, dishId);
    const b = await acknowledgeStudy(empId, dishId);
    expect(b.studiedAt).toEqual(a.studiedAt);
    expect(await db.dishStudyProgress.count()).toBe(1);
    await expect(startAttempt(empId, dishId)).resolves.toBeTruthy();
  });
  it("employees cannot study or take quizzes for unpublished, draft or archived dishes", async () => {
    await unpublishDish(dishId);
    expect(await getDishForEmployee(empId, dishId)).toBeNull();
    await expect(acknowledgeStudy(empId, dishId)).rejects.toThrow(/not available/);
    await expect(startAttempt(empId, dishId)).rejects.toThrow(/not available/);
    expect(await listDishesForEmployee(empId)).toHaveLength(0);
    await archiveDish(dishId);
    await expect(acknowledgeStudy(empId, dishId)).rejects.toThrow();
  });
  it("an unpublished quiz cannot be taken", async () => {
    await acknowledgeStudy(empId, dishId);
    await unpublishQuiz(quizId);
    await expect(startAttempt(empId, dishId)).rejects.toThrow(/not available/);
  });
  it("the payload sent to the browser contains no answers or explanations", async () => {
    await acknowledgeStudy(empId, dishId);
    const play = await startAttempt(empId, dishId);
    const json = JSON.stringify(play);
    expect(json).not.toMatch(/isCorrect|Why:|correct/i);
    expect(play.questions).toHaveLength(3);
    expect(play.questions[0]!.options).toHaveLength(4);
    expect(JSON.stringify(await getPlayAttempt(empId, play.attemptId))).not.toMatch(/isCorrect|Why:/);
  });
  it("starting twice resumes the same attempt (no duplicates), even concurrently", async () => {
    await acknowledgeStudy(empId, dishId);
    const [a, b] = await Promise.all([startAttempt(empId, dishId), startAttempt(empId, dishId)]);
    expect(a.attemptId).toBe(b.attemptId);
    expect((await startAttempt(empId, dishId)).attemptId).toBe(a.attemptId);
    expect(await db.quizAttempt.count()).toBe(1);
  });
  it("grades on the server, stores the attempt and answers, and ties it to the revisions", async () => {
    await acknowledgeStudy(empId, dishId);
    const { attemptId } = await startAttempt(empId, dishId);
    const res = await submitAttempt(empId, attemptId, await correctAnswers(attemptId, [2]));
    expect(res).toMatchObject({ score: 67, passed: false });
    const row = await db.quizAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { answers: true, quizRevision: true, dishRevision: true } });
    expect(row).toMatchObject({ status: "SUBMITTED", correctCount: 2, totalQuestions: 3, score: 67, passed: false, passingScore: 80 });
    expect(row.answers).toHaveLength(3);
    expect(row.answers.filter((a) => a.isCorrect)).toHaveLength(2);
    expect([row.quizRevision.version, row.dishRevision.version]).toEqual([1, 1]);
  });
  it("pass/fail follows the configured percentage", async () => {
    await acknowledgeStudy(empId, dishId);
    const a1 = await startAttempt(empId, dishId);
    expect((await submitAttempt(empId, a1.attemptId, await correctAnswers(a1.attemptId))).passed).toBe(true);
    await updateQuizSettings(quizId, { title: "Carbonara quiz", passingScore: 100, allowRetries: true, randomizeQuestions: false, randomizeAnswers: false, showCorrectAnswers: true });
    await publishQuiz(quizId);
    const a2 = await startAttempt(empId, dishId);
    expect((await submitAttempt(empId, a2.attemptId, await correctAnswers(a2.attemptId, [0]))).passed).toBe(false);
  });
  it("rejects tampered submissions and leaves the attempt open", async () => {
    await acknowledgeStudy(empId, dishId);
    const { attemptId, questions } = await startAttempt(empId, dishId);
    await expect(submitAttempt(empId, attemptId, { [questions[0]!.id]: "00000000-0000-4000-8000-000000000000" })).rejects.toThrow(/could not be processed/);
    await expect(submitAttempt(empId, attemptId, { "11111111-1111-4111-8111-111111111111": questions[0]!.options[0]!.id })).rejects.toThrow(/could not be processed/);
    expect((await db.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } })).status).toBe("IN_PROGRESS");
  });
  it("double submit (even concurrent) records exactly one result", async () => {
    await acknowledgeStudy(empId, dishId);
    const { attemptId } = await startAttempt(empId, dishId);
    const answers = await correctAnswers(attemptId);
    const [a, b] = await Promise.all([submitAttempt(empId, attemptId, answers), submitAttempt(empId, attemptId, answers)]);
    expect([a, b].filter((r) => !r.alreadySubmitted)).toHaveLength(1);
    expect(await db.quizAttemptAnswer.count()).toBe(3);
    // re-submitting with *different* answers after the fact cannot change the stored score
    await submitAttempt(empId, attemptId, await correctAnswers(attemptId, [0, 1, 2]));
    expect((await db.quizAttempt.findUniqueOrThrow({ where: { id: attemptId } })).score).toBe(100);
  });
  it("one employee cannot read, resume or submit another's attempt", async () => {
    const other = (await makeUser({ name: "Other" })).id;
    await acknowledgeStudy(empId, dishId);
    const { attemptId } = await startAttempt(empId, dishId);
    expect(await getPlayAttempt(other, attemptId)).toBeNull();
    await expect(submitAttempt(other, attemptId, {})).rejects.toThrow(/not found/);
    await submitAttempt(empId, attemptId, await correctAnswers(attemptId));
    expect(await getAttemptResult(other, attemptId)).toBeNull();
    expect(await getAttemptResult(empId, attemptId)).not.toBeNull();
  });
  it("retries disabled: one attempt per training cycle", async () => {
    await updateQuizSettings(quizId, { title: "Carbonara quiz", passingScore: 80, allowRetries: false, randomizeQuestions: false, randomizeAnswers: false, showCorrectAnswers: true });
    await publishQuiz(quizId);
    await acknowledgeStudy(empId, dishId);
    const { attemptId } = await startAttempt(empId, dishId);
    await submitAttempt(empId, attemptId, await correctAnswers(attemptId, [0, 1]));
    await expect(startAttempt(empId, dishId)).rejects.toThrow(/used all attempts/);
  });
  it("retries enabled: every attempt is kept in history", async () => {
    await acknowledgeStudy(empId, dishId);
    const a1 = await startAttempt(empId, dishId);
    await submitAttempt(empId, a1.attemptId, await correctAnswers(a1.attemptId, [0, 1]));
    const a2 = await startAttempt(empId, dishId);
    expect(a2.attemptId).not.toBe(a1.attemptId);
    await submitAttempt(empId, a2.attemptId, await correctAnswers(a2.attemptId));
    const history = await listAttempts(empId);
    expect(history.map((h) => h.score)).toEqual([100, 33]);
  });
  it("showCorrectAnswers=false hides the correct answer and explanation in results", async () => {
    await updateQuizSettings(quizId, { title: "Carbonara quiz", passingScore: 80, allowRetries: true, randomizeQuestions: false, randomizeAnswers: false, showCorrectAnswers: false });
    await publishQuiz(quizId);
    await acknowledgeStudy(empId, dishId);
    const { attemptId } = await startAttempt(empId, dishId);
    await submitAttempt(empId, attemptId, await correctAnswers(attemptId, [0]));
    const result = (await getAttemptResult(empId, attemptId))!;
    expect(result).toMatchObject({ total: 3, correct: 2, incorrect: 1, showCorrectAnswers: false });
    expect(result.questions.every((q) => q.correctText === null && q.explanation === null)).toBe(true);
    expect(result.questions.map((q) => q.isCorrect)).toEqual([false, true, true]);
  });
  it("showCorrectAnswers=true reveals correct answers and explanations only after submission", async () => {
    await acknowledgeStudy(empId, dishId);
    const { attemptId } = await startAttempt(empId, dishId);
    expect(await getAttemptResult(empId, attemptId)).toBeNull(); // not submitted yet
    await submitAttempt(empId, attemptId, await correctAnswers(attemptId, [0]));
    const result = (await getAttemptResult(empId, attemptId))!;
    expect(result.questions[0]).toMatchObject({ correctText: "Guanciale", explanation: "Why: Which ingredient is traditional?", isCorrect: false });
  });
  it("republishing the quiz mid-attempt voids the stale unfinished attempt; finished attempts keep their original revision", async () => {
    await acknowledgeStudy(empId, dishId);
    const done = await startAttempt(empId, dishId);
    await submitAttempt(empId, done.attemptId, await correctAnswers(done.attemptId));
    const open = await startAttempt(empId, dishId);
    await saveQuestion(quizId, null, mcq("New question"));
    await publishQuiz(quizId);
    const fresh = await startAttempt(empId, dishId);
    expect(fresh.attemptId).not.toBe(open.attemptId);
    expect(fresh.questions).toHaveLength(4);
    expect(await db.quizAttempt.findUnique({ where: { id: open.attemptId } })).toBeNull();
    const old = await db.quizAttempt.findUniqueOrThrow({ where: { id: done.attemptId }, include: { quizRevision: true } });
    expect(old.quizRevision.version).toBe(1);
    expect((await getAttemptResult(empId, done.attemptId))!.total).toBe(3); // still interpretable as 3 questions
  });
  it("failures notify managers; a pass does not", async () => {
    await acknowledgeStudy(empId, dishId);
    const a1 = await startAttempt(empId, dishId);
    await submitAttempt(empId, a1.attemptId, await correctAnswers(a1.attemptId, [0, 1]));
    expect(await db.notification.findMany({ where: { userId: adminId, type: "QUIZ_FAILED" } })).toHaveLength(1);
    const a2 = await startAttempt(empId, dishId);
    await submitAttempt(empId, a2.attemptId, await correctAnswers(a2.attemptId));
    expect(await db.notification.count({ where: { userId: adminId, type: "QUIZ_FAILED" } })).toBe(1);
  });
  it("questionCount draws a subset and grades only those", async () => {
    await updateQuizSettings(quizId, { title: "Carbonara quiz", passingScore: 80, allowRetries: true, questionCount: 2, randomizeQuestions: true, randomizeAnswers: true, showCorrectAnswers: true });
    await publishQuiz(quizId);
    await acknowledgeStudy(empId, dishId);
    const { attemptId, questions } = await startAttempt(empId, dishId);
    expect(questions).toHaveLength(2);
    const res = await submitAttempt(empId, attemptId, await correctAnswers(attemptId));
    expect(res).toMatchObject({ score: 100, passed: true });
    expect((await db.quizAttemptAnswer.count({ where: { attemptId } }))).toBe(2);
  });
});

describe("dish updates and retraining", () => {
  beforeEach(buildQuiz);

  it("a retraining update locks the quiz until re-study, keeps history, and requires a new pass", async () => {
    await acknowledgeStudy(empId, dishId);
    const first = await startAttempt(empId, dishId);
    await submitAttempt(empId, first.attemptId, await correctAnswers(first.attemptId));
    let d = (await getDishForEmployee(empId, dishId))!;
    expect(d.status).toMatchObject({ quizState: "PASSED", complete: true });

    await updateDish(adminId, dishId, dishInput({ garnishes: "Basil", requiresRetraining: true }));
    d = (await getDishForEmployee(empId, dishId))!;
    expect(d.status).toMatchObject({ studyState: "NEEDS_REVIEW", quizState: "LOCKED", complete: false });
    expect(d.requiresRetraining).toBe(true);
    expect(d.snapshot.garnishes).toBe("Basil"); // employee sees the new content
    await expect(startAttempt(empId, dishId)).rejects.toThrow(/updated/);
    expect((await db.notification.findMany({ where: { userId: empId, type: "RETRAINING_REQUIRED" } }))).toHaveLength(1);

    await acknowledgeStudy(empId, dishId);
    expect((await getDishForEmployee(empId, dishId))!.status).toMatchObject({ studyState: "STUDIED", quizState: "AVAILABLE", complete: false });
    const second = await startAttempt(empId, dishId);
    expect((await db.quizAttempt.findUniqueOrThrow({ where: { id: second.attemptId }, include: { dishRevision: true } })).dishRevision.version).toBe(2);
    await submitAttempt(empId, second.attemptId, await correctAnswers(second.attemptId));
    expect((await getDishForEmployee(empId, dishId))!.status).toMatchObject({ quizState: "PASSED", complete: true });
    expect(await db.quizAttempt.count({ where: { userId: empId, status: "SUBMITTED" } })).toBe(2); // history kept
  });
  it("a minor update does not force retraining but is flagged as updated", async () => {
    await acknowledgeStudy(empId, dishId);
    await updateDish(adminId, dishId, dishInput({ garnishes: "Basil" }));
    const d = (await getDishForEmployee(empId, dishId))!;
    expect(d.status).toMatchObject({ studyState: "STUDIED", updatedSinceStudied: true, quizState: "AVAILABLE" });
    await expect(startAttempt(empId, dishId)).resolves.toBeTruthy();
  });
});

describe("employee dashboard", () => {
  it("computes progress from real records", async () => {
    await buildQuiz();
    const d2 = (await createDish(adminId, dishInput({ name: "Tiramisu" }))).id;
    await publishDish(adminId, d2); // no quiz
    await createDish(adminId, dishInput({ name: "Hidden draft" })); // draft: invisible
    let dash = await getEmployeeDashboard(empId);
    expect(dash.progress).toMatchObject({ totalDishes: 2, studied: 0, quizzesAvailable: 1, completionPercent: 0, averageScore: null });
    expect(dash.needsStudy).toHaveLength(2);

    await acknowledgeStudy(empId, d2);
    await acknowledgeStudy(empId, dishId);
    const a = await startAttempt(empId, dishId);
    await submitAttempt(empId, a.attemptId, await correctAnswers(a.attemptId, [0]));
    dash = await getEmployeeDashboard(empId);
    expect(dash.progress).toMatchObject({ studied: 2, quizzesCompleted: 1, quizzesPassed: 0, quizzesFailed: 1, averageScore: 67, completionPercent: 50 });
    expect(dash.failedQuizzes.map((d) => d.name)).toEqual(["Carbonara"]);

    const b = await startAttempt(empId, dishId);
    await submitAttempt(empId, b.attemptId, await correctAnswers(b.attemptId));
    dash = await getEmployeeDashboard(empId);
    expect(dash.progress).toMatchObject({ quizzesPassed: 1, quizzesFailed: 0, completionPercent: 100, averageScore: 100 });
    // finishing everything tells the manager exactly once
    expect(await db.notification.count({ where: { userId: adminId, type: "TRAINING_COMPLETED" } })).toBe(1);
  });
});
