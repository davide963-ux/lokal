import Link from "next/link";
import { Download, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { TabLinks } from "@/components/layout/tab-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { requireAdminPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { parseAttemptParams, parseTeamParams, qs } from "@/lib/results-params";
import { getAttemptsLog, getTeamReport, STATUS_FILTERS } from "@/lib/services/reports";
import { initials } from "@/lib/utils";

export const metadata = { title: "Training results" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ResultsPage({ searchParams }: { searchParams: SP }) {
  await requireAdminPage();
  const sp = await searchParams;
  const tab = sp.tab === "attempts" ? "attempts" : "team";
  const [categories, dishes, employees] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.dish.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }], select: { id: true, name: true } }),
    db.user.findMany({ where: { role: "EMPLOYEE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader title="Training results" description="How well your team knows the menu, from real study and quiz records." />
      <TabLinks active={tab} tabs={[{ id: "team", label: "Team", href: "/admin/results" }, { id: "attempts", label: "Quiz attempts", href: "/admin/results?tab=attempts" }]} />
      {tab === "team" ? <TeamTab sp={sp} categories={categories} dishes={dishes} /> : <AttemptsTab sp={sp} categories={categories} dishes={dishes} employees={employees} />}
    </>
  );
}

type Opt = { id: string; name: string };

async function TeamTab({ sp, categories, dishes }: { sp: Awaited<SP>; categories: Opt[]; dishes: Opt[] }) {
  const f = parseTeamParams(sp);
  const { rows, totals } = await getTeamReport(f);
  const filtering = Object.keys(f.raw).length > 0;
  return (
    <>
      <form action="/admin/results" className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input name="q" defaultValue={f.q} placeholder="Employee name or email" aria-label="Employee" className="pl-9" /></div>
        <Select name="category" defaultValue={f.categoryId ?? ""} aria-label="Category"><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select name="dish" defaultValue={f.dishId ?? ""} aria-label="Dish"><option value="">All dishes</option>{dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
        <Select name="status" defaultValue={f.status ?? ""} aria-label="Training status"><option value="">Any status</option>{STATUS_FILTERS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{totals.employees} employee{totals.employees === 1 ? "" : "s"} · {totals.dishes} dish{totals.dishes === 1 ? "" : "es"} in scope{totals.averageScore !== null && ` · team average ${totals.averageScore}%`}</span>
        <span className="flex gap-2">
          {filtering && <Button asChild variant="ghost" size="sm"><Link href="/admin/results">Clear filters</Link></Button>}
          <Button asChild variant="secondary" size="sm"><a href={`/admin/results/export?${qs({ type: "team", ...f.raw })}`}><Download />Export CSV</a></Button>
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title={filtering ? "No employees match" : "No active employees yet"} description={filtering ? "Try clearing the filters." : "Add employees and publish dishes to see training results here."} />
      ) : (
        <Card className="overflow-x-auto" tabIndex={0} role="region" aria-label="Team results table (scrolls sideways on small screens)">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-3 font-medium">Employee</th><th className="px-3 py-3 font-medium">Studied</th><th className="px-3 py-3 font-medium">Passed</th><th className="px-3 py-3 font-medium">Avg score</th><th className="w-44 px-4 py-3 font-medium">Completion</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.userId} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/admin/employees/${r.userId}`} className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{initials(r.name)}</span>
                      <span className="min-w-0"><span className="block truncate font-medium hover:text-primary">{r.name}</span>
                        <span className="flex flex-wrap gap-1">{r.failed > 0 && <Badge variant="danger">{r.failed} to retake</Badge>}{r.needsReview > 0 && <Badge variant="warning">{r.needsReview} to review</Badge>}</span></span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{r.studied}/{r.totalDishes}</td>
                  <td className="px-3 py-3 tabular-nums">{r.passed}</td>
                  <td className="px-3 py-3 tabular-nums">{r.averageScore === null ? <span className="text-muted-foreground">–</span> : `${r.averageScore}%`}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><Progress label={`${r.name} completion`} value={r.completionPercent} tone={r.completionPercent >= 80 ? "primary" : r.completionPercent >= 40 ? "warning" : "danger"} className="flex-1" /><span className="w-10 text-right tabular-nums">{r.completionPercent}%</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

async function AttemptsTab({ sp, categories, dishes, employees }: { sp: Awaited<SP>; categories: Opt[]; dishes: Opt[]; employees: Opt[] }) {
  const f = parseAttemptParams(sp);
  const attempts = await getAttemptsLog(f);
  const filtering = Object.keys(f.raw).length > 0;
  return (
    <>
      <form action="/admin/results" className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="tab" value="attempts" />
        <Select name="employee" defaultValue={f.userId ?? ""} aria-label="Employee"><option value="">All employees</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
        <Select name="category" defaultValue={f.categoryId ?? ""} aria-label="Category"><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select name="dish" defaultValue={f.dishId ?? ""} aria-label="Dish"><option value="">All dishes</option>{dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
        <Select name="result" defaultValue={f.result ?? ""} aria-label="Result"><option value="">Passed &amp; failed</option><option value="passed">Passed</option><option value="failed">Failed</option></Select>
        <label className="grid gap-1 text-xs text-muted-foreground">From<Input type="date" name="from" defaultValue={f.raw.from} aria-label="From date" /></label>
        <label className="grid gap-1 text-xs text-muted-foreground">To<Input type="date" name="to" defaultValue={f.raw.to} aria-label="To date" /></label>
        <div className="flex items-end gap-2 lg:col-span-2"><Button type="submit" variant="secondary">Filter</Button>{filtering && <Button asChild variant="ghost"><Link href="/admin/results?tab=attempts">Clear</Link></Button>}
          <Button asChild variant="secondary" className="ml-auto"><a href={`/admin/results/export?${qs({ type: "attempts", ...f.raw })}`}><Download />Export CSV</a></Button></div>
      </form>
      {attempts.length === 0 ? <EmptyState icon={Users} title="No quiz attempts" description={filtering ? "Nothing matches these filters." : "Submitted quizzes will be listed here."} /> : (
        <Card className="overflow-x-auto" tabIndex={0} role="region" aria-label="Quiz attempts table (scrolls sideways on small screens)">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">When</th><th className="px-3 py-3 font-medium">Employee</th><th className="px-3 py-3 font-medium">Dish</th><th className="px-3 py-3 font-medium">Score</th><th className="px-4 py-3 font-medium">Result</th></tr></thead>
            <tbody className="divide-y divide-border">
              {attempts.map((a) => (
                <tr key={a.id} className="hover:bg-muted/40">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{a.submittedAt!.toLocaleString()}</td>
                  <td className="px-3 py-3"><Link href={`/admin/employees/${a.user.id}`} className="font-medium hover:text-primary">{a.user.name}</Link></td>
                  <td className="px-3 py-3">{a.quiz.dish.name}<span className="ml-1 text-xs text-muted-foreground">v{a.dishRevision.version}</span></td>
                  <td className="px-3 py-3 tabular-nums">{a.score}% <span className="text-xs text-muted-foreground">({a.correctCount}/{a.totalQuestions})</span></td>
                  <td className="px-4 py-3"><Badge variant={a.passed ? "success" : "danger"}>{a.passed ? "passed" : "failed"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {attempts.length >= 200 && <p className="mt-3 text-xs text-muted-foreground">Showing the latest 200. Export CSV for everything that matches.</p>}
    </>
  );
}
