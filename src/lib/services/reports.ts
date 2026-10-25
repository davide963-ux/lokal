import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { computeDishStatus, type DishStatus } from "@/lib/training/status";
import { loadTrainingData } from "./training";

export type StatusFilter = "complete" | "in_progress" | "not_started" | "needs_attention";
export const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "complete", label: "Fully trained" },
  { id: "in_progress", label: "In progress" },
  { id: "not_started", label: "Not started" },
  { id: "needs_attention", label: "Needs attention" },
];

export type TeamRow = {
  userId: string; name: string; email: string; jobTitle: string | null; status: "ACTIVE" | "INVITED" | "INACTIVE";
  totalDishes: number; studied: number; quizzesAvailable: number; passed: number; failed: number; needsReview: number;
  averageScore: number | null; completionPercent: number; lastActivity: Date | null; attention: boolean;
};

export type TeamFilters = { q?: string; categoryId?: string; dishId?: string; status?: StatusFilter; includeInactive?: boolean };

/** Published dishes in scope (optionally narrowed by category / one dish). */
async function scopeDishes(f: Pick<TeamFilters, "categoryId" | "dishId">) {
  return db.dish.findMany({
    where: { status: "PUBLISHED", ...(f.categoryId ? { categoryId: f.categoryId } : {}), ...(f.dishId ? { id: f.dishId } : {}) },
    select: { id: true, name: true, category: { select: { name: true } } },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });
}

function summarise(statuses: DishStatus[]) {
  const scored = statuses.filter((s) => s.lastScore !== null);
  return {
    totalDishes: statuses.length,
    studied: statuses.filter((s) => s.studyState === "STUDIED").length,
    quizzesAvailable: statuses.filter((s) => s.quizState !== "NONE").length,
    passed: statuses.filter((s) => s.quizState === "PASSED").length,
    failed: statuses.filter((s) => s.quizState === "FAILED").length,
    needsReview: statuses.filter((s) => s.studyState === "NEEDS_REVIEW").length,
    averageScore: scored.length ? Math.round(scored.reduce((a, s) => a + s.lastScore!, 0) / scored.length) : null,
    completionPercent: statuses.length ? Math.round((statuses.filter((s) => s.complete).length / statuses.length) * 100) : 0,
  };
}

export function matchesStatus(row: Pick<TeamRow, "completionPercent" | "studied" | "passed" | "failed" | "needsReview" | "attention" | "totalDishes">, f: StatusFilter) {
  switch (f) {
    case "complete": return row.totalDishes > 0 && row.completionPercent === 100;
    case "needs_attention": return row.attention;
    case "not_started": return row.studied === 0 && row.passed === 0 && row.failed === 0;
    case "in_progress": return row.completionPercent < 100 && !row.attention && (row.studied > 0 || row.passed > 0);
  }
}

export async function getTeamReport(f: TeamFilters = {}) {
  const employees = await db.user.findMany({
    where: {
      role: "EMPLOYEE",
      status: f.includeInactive ? undefined : "ACTIVE",
      ...(f.q ? { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { email: { contains: f.q, mode: "insensitive" } }] } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, jobTitle: true, status: true },
  });
  const dishes = await scopeDishes(f);
  const data = await loadTrainingData(employees.map((e) => e.id), dishes.map((d) => d.id));
  const lastAttempt = await db.quizAttempt.groupBy({ by: ["userId"], where: { userId: { in: employees.map((e) => e.id) }, status: "SUBMITTED" }, _max: { submittedAt: true } });
  const lastStudy = await db.dishStudyProgress.groupBy({ by: ["userId"], where: { userId: { in: employees.map((e) => e.id) } }, _max: { studiedAt: true } });
  const act = new Map<string, Date>();
  for (const x of [...lastAttempt.map((a) => [a.userId, a._max.submittedAt] as const), ...lastStudy.map((a) => [a.userId, a._max.studiedAt] as const)]) {
    if (x[1] && (!act.get(x[0]) || x[1] > act.get(x[0])!)) act.set(x[0], x[1]);
  }

  let rows: TeamRow[] = employees.map((e) => {
    const statuses = dishes.map((d) => computeDishStatus(data.get(e.id)!.get(d.id)!.input));
    const s = summarise(statuses);
    return { userId: e.id, name: e.name, email: e.email, jobTitle: e.jobTitle, status: e.status, ...s, lastActivity: act.get(e.id) ?? null, attention: s.failed > 0 || s.needsReview > 0 };
  });
  if (f.status) rows = rows.filter((r) => matchesStatus(r, f.status!));

  // Team-wide figures are computed over the same (filtered) rows the table shows.
  const pairs = rows.flatMap((r) => dishes.map((d) => computeDishStatus(data.get(r.userId)!.get(d.id)!.input)));
  const team = summarise(pairs);
  return {
    rows, dishes,
    totals: {
      employees: rows.length, dishes: dishes.length,
      averageScore: team.averageScore, completionPercent: team.completionPercent,
      needingTraining: rows.filter((r) => r.attention || (r.totalDishes > 0 && r.completionPercent < 100 && r.status === "ACTIVE")).length,
    },
  };
}

export type EmployeeDishRow = {
  dishId: string; name: string; category: string; status: DishStatus;
  studiedAt: Date | null; completedAt: Date | null; lastAttemptAt: Date | null;
};

export async function getEmployeeReport(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, jobTitle: true, phone: true, status: true, lastLoginAt: true, createdAt: true, role: true } });
  if (!user || user.role !== "EMPLOYEE") throw new DomainError("Employee not found.");
  const dishes = await scopeDishes({});
  const data = (await loadTrainingData([userId], dishes.map((d) => d.id))).get(userId);
  const rows: EmployeeDishRow[] = dishes.map((d) => {
    const td = data?.get(d.id);
    const status = computeDishStatus(td!.input);
    const current = td!.input.attempts.filter((a) => a.dishVersion >= status.requiredVersion).sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
    const studiedAt = td!.studies.filter((s) => s.version >= status.requiredVersion).at(0)?.studiedAt ?? null;
    const firstPass = current.find((a) => a.passed)?.submittedAt ?? null;
    return {
      dishId: d.id, name: d.name, category: d.category.name, status, studiedAt,
      completedAt: status.complete ? (status.quizState === "PASSED" ? firstPass : studiedAt) : null,
      lastAttemptAt: current.at(-1)?.submittedAt ?? null,
    };
  });
  const attempts = await db.quizAttempt.findMany({
    where: { userId, status: "SUBMITTED" }, orderBy: { submittedAt: "desc" },
    select: { id: true, score: true, passed: true, correctCount: true, totalQuestions: true, submittedAt: true, quiz: { select: { dishId: true, dish: { select: { name: true, status: true } } } }, dishRevision: { select: { version: true } } },
  });
  return {
    user, summary: summarise(rows.map((r) => r.status)), rows, attempts,
    pending: rows.filter((r) => !r.status.complete),
    failed: rows.filter((r) => r.status.quizState === "FAILED"),
    needsReview: rows.filter((r) => r.status.studyState === "NEEDS_REVIEW"),
  };
}

export type AttemptFilters = { userId?: string; dishId?: string; categoryId?: string; from?: Date; to?: Date; result?: "passed" | "failed"; limit?: number };

/** Submitted quiz attempts, newest first. Dates are inclusive (UTC days). */
export async function getAttemptsLog(f: AttemptFilters = {}) {
  const to = f.to ? new Date(f.to.getTime() + 24 * 3600 * 1000 - 1) : undefined;
  return db.quizAttempt.findMany({
    where: {
      status: "SUBMITTED",
      ...(f.userId ? { userId: f.userId } : {}),
      ...(f.result ? { passed: f.result === "passed" } : {}),
      ...(f.from || to ? { submittedAt: { ...(f.from ? { gte: f.from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      quiz: { ...(f.dishId ? { dishId: f.dishId } : {}), ...(f.categoryId ? { dish: { categoryId: f.categoryId } } : {}) },
    },
    orderBy: { submittedAt: "desc" },
    take: f.limit ?? 200,
    select: {
      id: true, score: true, passed: true, correctCount: true, totalQuestions: true, passingScore: true, submittedAt: true,
      user: { select: { id: true, name: true, email: true } },
      quiz: { select: { dishId: true, title: true, dish: { select: { name: true, category: { select: { name: true } } } } } },
      dishRevision: { select: { version: true } }, quizRevision: { select: { version: true } },
    },
  });
}

export function parseDay(v: string | undefined): Date | undefined {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
