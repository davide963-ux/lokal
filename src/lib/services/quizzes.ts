import { db, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import type { QuizSnapshot, SnapshotQuestion } from "@/lib/quiz/types";
import { snapshotHash } from "./dish-snapshot";
import { notifyAllEmployees } from "./notifications";
import { questionInput, quizSettingsInput, type QuestionInput, type QuizSettingsInput } from "@/lib/validation/quiz";

type Client = Tx | typeof db;

/** One quiz per dish; created lazily the first time a manager opens the builder. */
export async function getOrCreateQuiz(dishId: string) {
  const dish = await db.dish.findUnique({ where: { id: dishId }, select: { id: true, name: true } });
  if (!dish) throw new DomainError("Dish not found.");
  return db.quiz.upsert({ where: { dishId }, update: {}, create: { dishId, title: `${dish.name} quiz` } });
}

async function loadQuiz(client: Client, quizId: string) {
  const quiz = await client.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { options: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } } },
  });
  if (!quiz) throw new DomainError("Quiz not found.");
  return quiz;
}

/** The working copy as an immutable-snapshot shape (includes answers; server-side only). */
export async function buildQuizSnapshot(client: Client, quizId: string): Promise<QuizSnapshot> {
  const q = await loadQuiz(client, quizId);
  return {
    title: q.title,
    settings: {
      passingScore: q.passingScore, allowRetries: q.allowRetries, questionCount: q.questionCount,
      randomizeQuestions: q.randomizeQuestions, randomizeAnswers: q.randomizeAnswers, showCorrectAnswers: q.showCorrectAnswers,
    },
    questions: q.questions.map<SnapshotQuestion>((x) => ({
      id: x.id, text: x.questionText, type: x.questionType, explanation: x.explanation,
      options: x.options.map((o) => ({ id: o.id, text: o.answerText, isCorrect: o.isCorrect })),
    })),
  };
}

export function publishProblems(s: QuizSnapshot): string[] {
  const problems: string[] = [];
  if (s.questions.length === 0) problems.push("Add at least one question.");
  if (s.settings.questionCount && s.settings.questionCount > s.questions.length) {
    problems.push(`"Number of questions" (${s.settings.questionCount}) is larger than the ${s.questions.length} question${s.questions.length === 1 ? "" : "s"} you have written.`);
  }
  s.questions.forEach((q, i) => {
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (q.options.length < 2 || correct !== 1) problems.push(`Question ${i + 1} needs at least 2 answers and exactly one correct answer.`);
  });
  return problems;
}

export async function updateQuizSettings(quizId: string, raw: QuizSettingsInput) {
  const input = quizSettingsInput.parse(raw);
  const total = await db.quizQuestion.count({ where: { quizId } });
  if (input.questionCount && total > 0 && input.questionCount > total) {
    throw new DomainError(`You only have ${total} question${total === 1 ? "" : "s"}. Write more or lower the number.`);
  }
  return db.quiz.update({ where: { id: quizId }, data: input });
}

export async function saveQuestion(quizId: string, questionId: string | null, raw: QuestionInput) {
  const input = questionInput.parse(raw);
  const options =
    input.questionType === "TRUE_FALSE"
      ? [{ text: "True", isCorrect: input.trueFalseAnswer === true }, { text: "False", isCorrect: input.trueFalseAnswer === false }]
      : input.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }));

  return db.$transaction(async (tx) => {
    if (!(await tx.quiz.findUnique({ where: { id: quizId }, select: { id: true } }))) throw new DomainError("Quiz not found.");
    let id = questionId;
    if (id) {
      const existing = await tx.quizQuestion.findFirst({ where: { id, quizId } });
      if (!existing) throw new DomainError("Question not found.");
      await tx.quizQuestion.update({ where: { id }, data: { questionText: input.questionText, questionType: input.questionType, explanation: input.explanation } });
      await tx.quizAnswerOption.deleteMany({ where: { questionId: id } });
    } else {
      const last = await tx.quizQuestion.aggregate({ where: { quizId }, _max: { sortOrder: true } });
      const created = await tx.quizQuestion.create({
        data: { quizId, questionText: input.questionText, questionType: input.questionType, explanation: input.explanation, sortOrder: (last._max.sortOrder ?? -1) + 1 },
      });
      id = created.id;
    }
    await tx.quizAnswerOption.createMany({ data: options.map((o, i) => ({ questionId: id!, answerText: o.text, isCorrect: o.isCorrect, sortOrder: i })) });
    return { id };
  });
}

export async function deleteQuestion(quizId: string, questionId: string) {
  const res = await db.quizQuestion.deleteMany({ where: { id: questionId, quizId } });
  if (res.count !== 1) throw new DomainError("Question not found.");
  const left = await db.quizQuestion.findMany({ where: { quizId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  await db.$transaction(left.map((q, i) => db.quizQuestion.update({ where: { id: q.id }, data: { sortOrder: i } })));
}

export async function moveQuestion(quizId: string, questionId: string, direction: "up" | "down") {
  await db.$transaction(async (tx) => {
    const all = await tx.quizQuestion.findMany({ where: { quizId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true } });
    const i = all.findIndex((q) => q.id === questionId);
    if (i < 0) throw new DomainError("Question not found.");
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j]!, all[i]!];
    for (const [idx, q] of all.entries()) await tx.quizQuestion.update({ where: { id: q.id }, data: { sortOrder: idx } });
  });
}

/**
 * Publishes the working copy. Creates a new immutable QuizRevision only when the content
 * differs from the latest one, so attempts stay tied to the exact questions that were asked.
 */
export async function publishQuiz(quizId: string) {
  return db.$transaction(async (tx) => {
    const quiz = await tx.quiz.findUnique({ where: { id: quizId }, include: { dish: { select: { name: true } } } });
    if (!quiz) throw new DomainError("Quiz not found.");
    const snapshot = await buildQuizSnapshot(tx, quizId);
    const problems = publishProblems(snapshot);
    if (problems.length) throw new DomainError(`This quiz can't be published yet. ${problems[0]}`);

    const latest = await tx.quizRevision.findFirst({ where: { quizId }, orderBy: { version: "desc" } });
    let version = latest?.version ?? 0;
    const changed = !latest || snapshotHash(latest.questionSnapshot) !== snapshotHash(snapshot);
    if (changed) {
      version += 1;
      await tx.quizRevision.create({ data: { quizId, version, questionSnapshot: snapshot } });
    }
    const wasPublished = quiz.status === "PUBLISHED";
    await tx.quiz.update({ where: { id: quizId }, data: { status: "PUBLISHED", currentVersion: version } });
    if (!wasPublished && version === 1) {
      await notifyAllEmployees(
        { type: "QUIZ_AVAILABLE", title: `New quiz: ${quiz.dish.name}`, message: "Study the dish, then test your knowledge.", link: `/employee/menu/${quiz.dishId}` },
        tx,
      );
    }
    return { version, changed };
  });
}

export async function unpublishQuiz(quizId: string) {
  const res = await db.quiz.updateMany({ where: { id: quizId, status: "PUBLISHED" }, data: { status: "DRAFT" } });
  if (res.count !== 1) throw new DomainError("This quiz is not published.");
}

/** True when the working copy differs from what employees currently take. */
export async function hasUnpublishedChanges(quizId: string): Promise<boolean> {
  const latest = await db.quizRevision.findFirst({ where: { quizId }, orderBy: { version: "desc" } });
  if (!latest) return true;
  return snapshotHash(latest.questionSnapshot) !== snapshotHash(await buildQuizSnapshot(db, quizId));
}
