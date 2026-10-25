import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import type { Role, UserStatus } from "@/generated/prisma/enums";

/** Empties every table (keeps schema + constraints). Call in beforeEach. */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

let counter = 0;
export async function makeUser(
  opts: { role?: Role; status?: UserStatus; email?: string; password?: string; name?: string } = {},
) {
  counter += 1;
  return db.user.create({
    data: {
      name: opts.name ?? `User ${counter}`,
      email: opts.email ?? `user${counter}@example.com`,
      role: opts.role ?? "EMPLOYEE",
      status: opts.status ?? "ACTIVE",
      passwordHash: opts.status === "INVITED" ? null : await hashPassword(opts.password ?? "Passw0rd-test!"),
    },
  });
}

export async function makeCategory(name = "Pasta") {
  return db.category.upsert({ where: { name }, update: {}, create: { name } });
}

export async function makeAllergen(name = "Eggs") {
  return db.allergen.upsert({ where: { name }, update: {}, create: { name } });
}

// ───── Training fixtures (shared by flow and report tests) ─────
import { createDish, publishDish } from "@/lib/services/dishes";
import { getOrCreateQuiz, publishQuiz, saveQuestion, updateQuizSettings } from "@/lib/services/quizzes";
import { acknowledgeStudy } from "@/lib/services/training";
import { startAttempt, submitAttempt } from "@/lib/services/attempts";

export async function makePublishedDish(adminId: string, categoryId: string, name: string, withQuiz = true) {
  const { id } = await createDish(adminId, { name, categoryId, allergensVerified: true });
  await publishDish(adminId, id);
  let quizId: string | null = null;
  if (withQuiz) {
    quizId = (await getOrCreateQuiz(id)).id;
    for (const t of ["Q one", "Q two"]) {
      await saveQuestion(quizId, null, { questionText: t, questionType: "MULTIPLE_CHOICE", options: [{ text: "Right", isCorrect: true }, { text: "Wrong", isCorrect: false }] });
    }
    await updateQuizSettings(quizId, { title: `${name} quiz`, passingScore: 80, allowRetries: true, randomizeQuestions: false, randomizeAnswers: false, showCorrectAnswers: true });
    await publishQuiz(quizId);
  }
  return { dishId: id, quizId };
}

/** Studies the dish and submits a quiz; `wrongOn` lists question indexes to answer incorrectly. */
export async function takeQuiz(userId: string, dishId: string, wrongOn: number[] = []) {
  await acknowledgeStudy(userId, dishId);
  const play = await startAttempt(userId, dishId);
  const a = await db.quizAttempt.findUniqueOrThrow({ where: { id: play.attemptId }, include: { quizRevision: true } });
  const snap = a.quizRevision.questionSnapshot as { questions: { id: string; options: { id: string; isCorrect: boolean }[] }[] };
  const issued = a.issuedQuestions as { questionId: string }[];
  const answers: Record<string, string> = {};
  issued.forEach((iq, i) => {
    const q = snap.questions.find((x) => x.id === iq.questionId)!;
    answers[q.id] = q.options.find((o) => o.isCorrect === !wrongOn.includes(i))!.id;
  });
  return submitAttempt(userId, play.attemptId, answers);
}
