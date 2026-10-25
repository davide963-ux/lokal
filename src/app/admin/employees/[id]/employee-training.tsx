import Link from "next/link";
import { AlertTriangle, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { dishLabel } from "@/lib/training/labels";
import type { getEmployeeReport } from "@/lib/services/reports";

type Report = Awaited<ReturnType<typeof getEmployeeReport>>;
const d = (x: Date | null) => (x ? x.toLocaleDateString() : "–");

export function EmployeeTraining({ report }: { report: Report }) {
  const { summary: s, rows, attempts, failed, needsReview } = report;
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-sm text-muted-foreground">Training completion</p><p className="font-display text-5xl font-semibold tracking-tight">{s.completionPercent}%</p></div>
            <Button asChild variant="secondary" size="sm"><a href={`/admin/results/export?type=attempts&employee=${report.user.id}`}><Download />Export attempts CSV</a></Button>
          </div>
          <Progress value={s.completionPercent} className="mt-4 h-3" />
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><dt className="text-muted-foreground">Dishes studied</dt><dd className="text-xl font-semibold">{s.studied}<span className="text-sm font-normal text-muted-foreground"> / {s.totalDishes}</span></dd></div>
            <div><dt className="text-muted-foreground">Quizzes passed</dt><dd className="text-xl font-semibold text-success">{s.passed}<span className="text-sm font-normal text-muted-foreground"> / {s.quizzesAvailable}</span></dd></div>
            <div><dt className="text-muted-foreground">To retake</dt><dd className={`text-xl font-semibold ${s.failed ? "text-destructive" : ""}`}>{s.failed}</dd></div>
            <div><dt className="text-muted-foreground">Average score</dt><dd className="text-xl font-semibold">{s.averageScore === null ? "–" : `${s.averageScore}%`}</dd></div>
          </dl>
        </CardContent>
      </Card>

      {(failed.length > 0 || needsReview.length > 0) && (
        <div className="rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm text-warning">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" />Needs attention</p>
          <ul className="mt-2 grid gap-1">
            {failed.map((r) => <li key={r.dishId}>Failed <strong>{r.name}</strong> (latest {r.status.lastScore}%)</li>)}
            {needsReview.map((r) => <li key={r.dishId}><strong>{r.name}</strong> was updated and needs to be re-studied</li>)}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Dishes</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? <p className="px-5 pb-5 text-sm text-muted-foreground">No published dishes yet.</p> : (
            <table className="w-full min-w-[620px] text-sm">
              <thead className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-2.5 font-medium">Dish</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5 font-medium">Studied</th><th className="px-3 py-2.5 font-medium">Last score</th><th className="px-5 py-2.5 font-medium">Completed</th></tr></thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const l = dishLabel(r.status);
                  return (
                    <tr key={r.dishId}>
                      <td className="px-5 py-2.5"><span className="font-medium">{r.name}</span><span className="block text-xs text-muted-foreground">{r.category}</span></td>
                      <td className="px-3 py-2.5"><Badge variant={l.tone}>{l.text}</Badge></td>
                      <td className="px-3 py-2.5 text-muted-foreground">{d(r.studiedAt)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{r.status.lastScore === null ? "–" : `${r.status.lastScore}%`}</td>
                      <td className="px-5 py-2.5 text-muted-foreground">{d(r.completedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Quiz history</CardTitle></CardHeader>
        <CardContent className="p-0">
          {attempts.length === 0 ? <p className="px-5 pb-5 text-sm text-muted-foreground">No quizzes taken yet.</p> : (
            <ul className="divide-y divide-border border-t border-border">
              {attempts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1"><Link href={`/admin/menu/${a.quiz.dishId}`} className="font-medium hover:text-primary">{a.quiz.dish.name}</Link>
                    <p className="text-xs text-muted-foreground">{a.submittedAt!.toLocaleString()} · {a.correctCount}/{a.totalQuestions} correct · dish v{a.dishRevision.version}</p></div>
                  <span className="font-display text-lg font-semibold">{a.score}%</span>
                  <Badge variant={a.passed ? "success" : "danger"}>{a.passed ? "passed" : "failed"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
