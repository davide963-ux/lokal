import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { computeDishStatus, type DishStatus, type DishStatusInput } from "@/lib/training/status";
import type { DishSnapshot } from "./dish-snapshot";
import { notifyAdmins } from "./notifications";

export type DishTrainingData = {
  input: DishStatusInput;
  /** Every acknowledgement by this employee (any revision), newest last. */
  studies: { version: number; studiedAt: Date }[];
};

/**
 * Loads raw training facts for many employees × dishes in a fixed number of queries (5),
 * independent of team size. Everything that decides "where does X stand" goes through
 * computeDishStatus on this data, so the employee app and manager reports can never disagree.
 */
export async function loadTrainingData(userIds: string[], dishIds: string[]): Promise<Map<string, Map<string, DishTrainingData>>> {
  const out = new Map<string, Map<string, DishTrainingData>>();
  if (userIds.length === 0 || dishIds.length === 0) return out;
  const [revisions, studies, quizzes, attempts] = await Promise.all([
    db.dishRevision.findMany({ where: { dishId: { in: dishIds } }, select: { dishId: true, version: true, requiresRetraining: true } }),
    db.dishStudyProgress.findMany({ where: { userId: { in: userIds }, dishId: { in: dishIds } }, select: { userId: true, dishId: true, studiedAt: true, dishRevision: { select: { version: true } } }, orderBy: { studiedAt: "asc" } }),
    db.quiz.findMany({ where: { dishId: { in: dishIds }, status: "PUBLISHED" }, select: { dishId: true, allowRetries: true } }),
    db.quizAttempt.findMany({
      where: { userId: { in: userIds }, status: "SUBMITTED", quiz: { dishId: { in: dishIds } } },
      select: { userId: true, score: true, passed: true, submittedAt: true, quiz: { select: { dishId: true } }, dishRevision: { select: { version: true } } },
    }),
  ]);
  const revBy = new Map<string, { version: number; requiresRetraining: boolean }[]>();
  for (const r of revisions) (revBy.get(r.dishId) ?? revBy.set(r.dishId, []).get(r.dishId)!).push(r);
  const quizBy = new Map(quizzes.map((q) => [q.dishId, { allowRetries: q.allowRetries }]));
  const key = (u: string, d: string) => `${u}|${d}`;
  const studyBy = new Map<string, typeof studies>();
  for (const x of studies) (studyBy.get(key(x.userId, x.dishId)) ?? studyBy.set(key(x.userId, x.dishId), []).get(key(x.userId, x.dishId))!).push(x);
  const attBy = new Map<string, typeof attempts>();
  for (const x of attempts) (attBy.get(key(x.userId, x.quiz.dishId)) ?? attBy.set(key(x.userId, x.quiz.dishId), []).get(key(x.userId, x.quiz.dishId))!).push(x);

  for (const u of userIds) {
    const perDish = new Map<string, DishTrainingData>();
    for (const d of dishIds) {
      const st = studyBy.get(key(u, d)) ?? [];
      perDish.set(d, {
        studies: st.map((x) => ({ version: x.dishRevision.version, studiedAt: x.studiedAt })),
        input: {
          revisions: revBy.get(d) ?? [],
          studiedVersions: st.map((x) => x.dishRevision.version),
          quiz: quizBy.get(d) ?? null,
          attempts: (attBy.get(key(u, d)) ?? []).map((a) => ({ score: a.score!, passed: a.passed!, dishVersion: a.dishRevision.version, submittedAt: a.submittedAt! })),
        },
      });
    }
    out.set(u, perDish);
  }
  return out;
}

/** Training status for one employee across the given dishes. */
export async function loadStatuses(userId: string, dishIds: string[]): Promise<Map<string, DishStatus>> {
  const data = (await loadTrainingData([userId], dishIds)).get(userId);
  return new Map(dishIds.map((id) => [id, computeDishStatus(data!.get(id)!.input)]));
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
