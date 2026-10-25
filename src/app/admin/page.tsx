import Link from "next/link";
import { BarChart3, CheckCircle2, ChefHat, ClipboardCheck, ShieldAlert, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireAdminPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { getAttemptsLog, getTeamReport } from "@/lib/services/reports";

export const metadata = { title: "Dashboard" };
const STATUS_BADGE = { DRAFT: "warning", PUBLISHED: "success", ARCHIVED: "neutral" } as const;

function Stat({ label, value, hint, icon: Icon, href }: { label: string; value: string | number; hint?: string; icon: typeof Users; href: string }) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardContent className="flex items-start justify-between gap-3 p-5">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><Icon className="size-5" /></div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function AdminDashboard() {
  const user = await requireAdminPage();
  const [published, drafts, quizzes, unverified, recentDishes, team, recentAttempts, invited] = await Promise.all([
    db.dish.count({ where: { status: "PUBLISHED" } }),
    db.dish.count({ where: { status: "DRAFT" } }),
    db.quiz.count({ where: { status: "PUBLISHED", dish: { status: "PUBLISHED" } } }),
    db.dish.count({ where: { status: { not: "ARCHIVED" }, allergensVerifiedAt: null } }),
    db.dish.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" }, take: 5, include: { category: { select: { name: true } } } }),
    getTeamReport(),
    getAttemptsLog({ limit: 5 }),
    db.user.count({ where: { role: "EMPLOYEE", status: "INVITED" } }),
  ]);
  const needTraining = team.rows
    .filter((r) => r.totalDishes > 0 && r.completionPercent < 100)
    .sort((a, b) => Number(b.attention) - Number(a.attention) || a.completionPercent - b.completionPercent)
    .slice(0, 5);
  const empty = published + drafts === 0 && team.rows.length + invited === 0;

  return (
    <>
      <PageHeader title={`Good to see you, ${user.name.split(" ")[0]}`} description="Here's where your team's training stands." />
      {empty && (
        <Card className="mb-6 border-primary/30 bg-primary-soft/40">
          <CardContent className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div><p className="font-display text-lg font-semibold">Let&apos;s get started</p><p className="text-sm text-muted-foreground">Add your restaurant details, create a category and your first dish, then invite your team.</p></div>
            <div className="flex flex-wrap gap-2"><Button asChild variant="secondary"><Link href="/admin/settings">Settings</Link></Button><Button asChild><Link href="/admin/menu/categories">Create a category</Link></Button></div>
          </CardContent>
        </Card>
      )}
      {unverified > 0 && (
        <Link href="/admin/menu" className="mb-4 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
          <ShieldAlert className="size-4 shrink-0" /><span><strong>{unverified} dish{unverified === 1 ? "" : "es"}</strong> need{unverified === 1 ? "s" : ""} allergen verification before they can be published.</span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Published dishes" value={published} hint={drafts ? `${drafts} draft${drafts === 1 ? "" : "s"}` : undefined} icon={ChefHat} href="/admin/menu?status=PUBLISHED" />
        <Stat label="Active employees" value={team.rows.length} hint={invited ? `${invited} awaiting setup` : undefined} icon={Users} href="/admin/employees?status=ACTIVE" />
        <Stat label="Published quizzes" value={quizzes} icon={ClipboardCheck} href="/admin/quizzes" />
        <Stat label="Average quiz score" value={team.totals.averageScore === null ? "–" : `${team.totals.averageScore}%`} hint={team.totals.averageScore === null ? "No quizzes taken yet" : undefined} icon={BarChart3} href="/admin/results?tab=attempts" />
      </div>

      <Card className="mt-4">
        <CardContent className="p-5">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-sm text-muted-foreground">Overall training completion</p><p className="font-display text-4xl font-semibold tracking-tight">{team.totals.completionPercent}%</p></div>
            <Button asChild variant="secondary" size="sm"><Link href="/admin/results">Full results</Link></Button>
          </div>
          <Progress value={team.totals.completionPercent} className="mt-3 h-3" />
          <p className="mt-2 text-xs text-muted-foreground">Share of (employee × dish) pairs that are studied and, where a quiz exists, passed on the current version.</p>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Needs additional training</CardTitle></CardHeader>
          <CardContent>
            {needTraining.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" />{team.rows.length === 0 ? "No active employees yet." : "Everyone is fully trained."}</p>
            ) : (
              <ul className="divide-y divide-border">
                {needTraining.map((r) => (
                  <li key={r.userId}>
                    <Link href={`/admin/employees/${r.userId}`} className="flex items-center gap-3 py-3 hover:text-primary">
                      <div className="min-w-0 flex-1"><p className="truncate font-medium">{r.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">{r.failed > 0 && <Badge variant="danger">{r.failed} to retake</Badge>}{r.needsReview > 0 && <Badge variant="warning">{r.needsReview} to review</Badge>}</div></div>
                      <span className="text-sm tabular-nums text-muted-foreground">{r.completionPercent}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent quiz submissions</CardTitle></CardHeader>
          <CardContent>
            {recentAttempts.length === 0 ? <p className="text-sm text-muted-foreground">No quizzes submitted yet.</p> : (
              <ul className="divide-y divide-border">
                {recentAttempts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1"><p className="truncate font-medium">{a.user.name}</p><p className="truncate text-xs text-muted-foreground">{a.quiz.dish.name} · {a.submittedAt!.toLocaleDateString()}</p></div>
                    <span className="tabular-nums">{a.score}%</span><Badge variant={a.passed ? "success" : "danger"}>{a.passed ? "passed" : "failed"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Recently updated dishes</CardTitle></CardHeader>
        <CardContent>
          {recentDishes.length === 0 ? <p className="text-sm text-muted-foreground">Nothing here yet. Your latest dish changes will show up here.</p> : (
            <ul className="divide-y divide-border">
              {recentDishes.map((d) => (
                <li key={d.id}>
                  <Link href={`/admin/menu/${d.id}`} className="flex items-center gap-3 py-3 transition-colors hover:text-primary">
                    <div className="min-w-0 flex-1"><p className="truncate font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{d.category.name} · {d.updatedAt.toLocaleDateString()}</p></div>
                    <Badge variant={STATUS_BADGE[d.status]}>{d.status.toLowerCase()}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
