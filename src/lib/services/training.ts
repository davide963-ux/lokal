import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { computeDishStatus, type DishStatus } from "@/lib/training/status";
import type { DishSnapshot } from "./dish-snapshot";
import { notifyAdmins } from "./notifications";

/** Loads training status for the given user across the given published dishes (batched, 4 queries). */
export async function loadStatuses(userId: string, dishIds: string[]): Promise<Map<string, DishStatus>> {
  if (dishIds.length === 0) return new Map();
  const [revisions, studies, quizzes, attempts] = await Promise.all([
    db.dishRevision.findMany({ where: { dishId: { in: dishIds } }, select: { dishId: true, version: true, requiresRetraining: true } }),
    db.dishStudyProgress.findMany({ where: { userId, dishId: { in: dishIds } }, select: { dishId: true, dishRevision: { select: { version: true } } } }),
    db.quiz.findMany({ where: { dishId: { in: dishIds }, status: "PUBLISHED" }, select: { id: true, dishId: true, allowRetries: true } }),
    db.quizAttempt.findMany({
      where: { userId, status: "SUBMITTED", quiz: { dishId: { in: dishIds } } },
      select: { score: true, passed: true, submittedAt: true, quiz: { select: { dishId: true } }, dishRevision: { select: { version: true } } },
    }),
  ]);
  const by = <T extends { dishId: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) (m.get(r.dishId) ?? m.set(r.dishId, []).get(r.dishId)!).push(r);
    return m;
  };
  const revBy = by(revisions), studyBy = by(studies), quizBy = new Map(quizzes.map((q) => [q.dishId, q]));
  const attBy = new Map<string, typeof attempts>();
  for (const a of attempts) (attBy.get(a.quiz.dishId) ?? attBy.set(a.quiz.dishId, []).get(a.quiz.dishId)!).push(a);

  return new Map(
    dishIds.map((id) => [
      id,
      computeDishStatus({
        revisions: revBy.get(id) ?? [],
        studiedVersions: (studyBy.get(id) ?? []).map((s) => s.dishRevision.version),
        quiz: quizBy.get(id) ? { allowRetries: quizBy.get(id)!.allowRetries } : null,
        attempts: (attBy.get(id) ?? []).map((a) => ({ score: a.score!, passed: a.passed!, dishVersion: a.dishRevision.version, submittedAt: a.submittedAt! })),
      }),
    ]),
  );
}

/** Employees only ever see PUBLISHED dishes; anything else reads as "not found". */
export async function getDishForEmployee(userId: string, dishId: string) {
  const dish = await db.dish.findFirst({
    where: { id: dishId, status: "PUBLISHED" },
    select: { id: true, name: true, imageUrl: true, isAvailable: true, category: { select: { name: true } } },
  });
  if (!dish) return null;
  const latest = await db.dishRevision.findFirst({ where: { dishId }, orderBy: { version: "desc" } });
  if (!latest) return null;
  const [status, quiz, lastStudy, latestChange] = await Promise.all([
    loadStatuses(userId, [dishId]).then((m) => m.get(dishId)!),
    db.quiz.findFirst({ where: { dishId, status: "PUBLISHED" }, select: { id: true, title: true, passingScore: true, allowRetries: true } }),
    db.dishStudyProgress.findFirst({ where: { userId, dishId }, orderBy: { studiedAt: "desc" }, select: { studiedAt: true, dishRevision: { select: { version: true } } } }),
    db.dishRevision.findFirst({ where: { dishId, version: { gt: 1 } }, orderBy: { version: "desc" }, select: { changeSummary: true } }),
  ]);
  return {
    dish, snapshot: latest.snapshot as unknown as DishSnapshot, version: latest.version, requiresRetraining: latest.requiresRetraining,
    status, quiz, lastStudiedAt: lastStudy?.studiedAt ?? null, changeSummary: latestChange?.changeSummary ?? null,
  };
}

/** "I Have Studied This Dish": records that the employee acknowledged the *current* revision. */
export async function acknowledgeStudy(userId: string, dishId: string) {
  return db.$transaction(async (tx) => {
    const dish = await tx.dish.findFirst({ where: { id: dishId, status: "PUBLISHED" }, select: { id: true } });
    if (!dish) throw new DomainError("This dish is not available.");
    const latest = await tx.dishRevision.findFirst({ where: { dishId }, orderBy: { version: "desc" } });
    if (!latest) throw new DomainError("This dish is not available.");
    // Idempotent: a double tap must not create a second record or move the timestamp.
    const row = await tx.dishStudyProgress.upsert({
      where: { userId_dishRevisionId: { userId, dishRevisionId: latest.id } },
      update: {},
      create: { userId, dishId, dishRevisionId: latest.id },
    });
    return { studiedAt: row.studiedAt, version: latest.version };
  });
}

export async function listDishesForEmployee(userId: string, filter: { q?: string; categoryId?: string } = {}) {
  const dishes = await db.dish.findMany({
    where: {
      status: "PUBLISHED",
      ...(filter.q ? { name: { contains: filter.q, mode: "insensitive" } } : {}),
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, imageUrl: true, shortDescription: true, isAvailable: true, publishedAt: true, categoryId: true, category: { select: { name: true } } },
  });
  const statuses = await loadStatuses(userId, dishes.map((d) => d.id));
  return dishes.map((d) => ({ ...d, status: statuses.get(d.id)! }));
}

export type EmployeeProgress = {
  totalDishes: number; studied: number; quizzesAvailable: number; quizzesCompleted: number;
  quizzesPassed: number; quizzesFailed: number; averageScore: number | null; completionPercent: number;
};

export async function getEmployeeDashboard(userId: string) {
  const dishes = await listDishesForEmployee(userId);
  const quizDishIds = new Set(
    (await db.quiz.findMany({ where: { status: "PUBLISHED", dishId: { in: dishes.map((d) => d.id) } }, select: { dishId: true } })).map((q) => q.dishId),
  );
  const scored = dishes.filter((d) => d.status.lastScore !== null);
  const progress: EmployeeProgress = {
    totalDishes: dishes.length,
    studied: dishes.filter((d) => d.status.studyState === "STUDIED").length,
    quizzesAvailable: quizDishIds.size,
    quizzesCompleted: scored.length,
    quizzesPassed: dishes.filter((d) => d.status.quizState === "PASSED").length,
    quizzesFailed: dishes.filter((d) => d.status.quizState === "FAILED").length,
    averageScore: scored.length ? Math.round(scored.reduce((s, d) => s + d.status.lastScore!, 0) / scored.length) : null,
    completionPercent: dishes.length ? Math.round((dishes.filter((d) => d.status.complete).length / dishes.length) * 100) : 0,
  };
  return {
    progress,
    needsStudy: dishes.filter((d) => d.status.studyState !== "STUDIED"),
    pendingQuizzes: dishes.filter((d) => d.status.quizState === "AVAILABLE"),
    failedQuizzes: dishes.filter((d) => d.status.quizState === "FAILED"),
    recentlyAdded: [...dishes].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)).slice(0, 6),
    dishes,
  };
}

/** Tells managers when an employee has finished every published dish (and its quiz). Fires once per completion. */
export async function notifyIfTrainingComplete(userId: string) {
  const [dishes, user] = await Promise.all([listDishesForEmployee(userId), db.user.findUnique({ where: { id: userId }, select: { name: true } })]);
  if (!user || dishes.length === 0 || !dishes.every((d) => d.status.complete)) return false;
  const marker = `Training complete: ${user.name}`;
  const already = await db.notification.findFirst({ where: { type: "TRAINING_COMPLETED", title: marker, createdAt: { gt: new Date(Date.now() - 24 * 3600 * 1000) } } });
  if (already) return false;
  await notifyAdmins({ type: "TRAINING_COMPLETED", title: marker, message: `${user.name} has completed training on all ${dishes.length} dishes.`, link: `/admin/employees/${userId}` });
  return true;
}
