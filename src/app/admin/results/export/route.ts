import { getCurrentUser } from "@/lib/authz";
import { toCsv } from "@/lib/csv";
import { parseAttemptParams, parseTeamParams } from "@/lib/results-params";
import { getAttemptsLog, getTeamReport } from "@/lib/services/reports";

export const dynamic = "force-dynamic";

const iso = (d: Date | null) => (d ? d.toISOString() : "");

export async function GET(req: Request) {
  // Route handlers have no layout guard: authorise explicitly, server-side.
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams);
  const type = sp.type === "attempts" ? "attempts" : "team";
  let body: string;

  if (type === "team") {
    const { rows } = await getTeamReport(parseTeamParams(sp));
    body = toCsv(rows, [
      { header: "Employee", value: (r) => r.name },
      { header: "Email", value: (r) => r.email },
      { header: "Job title", value: (r) => r.jobTitle },
      { header: "Account status", value: (r) => r.status.toLowerCase() },
      { header: "Dishes in scope", value: (r) => r.totalDishes },
      { header: "Dishes studied", value: (r) => r.studied },
      { header: "Quizzes passed", value: (r) => r.passed },
      { header: "Quizzes to retake", value: (r) => r.failed },
      { header: "Dishes needing review", value: (r) => r.needsReview },
      { header: "Average score %", value: (r) => r.averageScore },
      { header: "Completion %", value: (r) => r.completionPercent },
      { header: "Last activity (UTC)", value: (r) => iso(r.lastActivity) },
    ]);
  } else {
    const rows = await getAttemptsLog({ ...parseAttemptParams(sp), limit: 20000 });
    body = toCsv(rows, [
      { header: "Submitted (UTC)", value: (r) => iso(r.submittedAt) },
      { header: "Employee", value: (r) => r.user.name },
      { header: "Email", value: (r) => r.user.email },
      { header: "Dish", value: (r) => r.quiz.dish.name },
      { header: "Category", value: (r) => r.quiz.dish.category.name },
      { header: "Score %", value: (r) => r.score },
      { header: "Correct", value: (r) => r.correctCount },
      { header: "Questions", value: (r) => r.totalQuestions },
      { header: "Passing score %", value: (r) => r.passingScore },
      { header: "Result", value: (r) => (r.passed ? "passed" : "failed") },
      { header: "Dish version", value: (r) => r.dishRevision.version },
      { header: "Quiz version", value: (r) => r.quizRevision.version },
    ]);
  }
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="training-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
