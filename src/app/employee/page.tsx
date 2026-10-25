import Link from "next/link";
import { AlertTriangle, BookOpen, RotateCcw, Sparkles } from "lucide-react";
import { DishList } from "@/components/employee/dish-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { requireEmployeePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { getEmployeeDashboard } from "@/lib/services/training";

export const metadata = { title: "Home" };

function Section({ title, icon: Icon, children, href }: { title: string; icon: typeof BookOpen; children: React.ReactNode; href?: string }) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Icon className="size-5 text-primary" />{title}</h2>
        {href && <Link href={href} className="text-sm font-medium text-primary">See all</Link>}
      </div>
      {children}
    </section>
  );
}

export default async function EmployeeHome() {
  const user = await requireEmployeePage();
  const [d, categories] = await Promise.all([
    getEmployeeDashboard(user.id),
    db.category.findMany({ where: { dishes: { some: { status: "PUBLISHED" } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const p = d.progress;
  const needsReview = d.needsStudy.filter((x) => x.status.studyState === "NEEDS_REVIEW");
  const toStudy = d.needsStudy.filter((x) => x.status.studyState === "NOT_STUDIED");

  return (
    <>
      <h1 className="text-3xl font-semibold">Welcome, {user.name.split(" ")[0]}</h1>
      <p className="mt-1 text-muted-foreground">Here&apos;s your training progress.</p>

      <Card className="mt-5">
        <CardContent className="p-5">
          <div className="flex items-end justify-between">
            <div><p className="text-sm text-muted-foreground">Training progress</p><p className="font-display text-5xl font-semibold tracking-tight">{p.completionPercent}%</p></div>
            {p.averageScore !== null && <div className="text-right"><p className="text-sm text-muted-foreground">Average score</p><p className="text-2xl font-semibold">{p.averageScore}%</p></div>}
          </div>
          <Progress value={p.completionPercent} className="mt-4 h-3" />
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt className="text-muted-foreground">Dishes studied</dt><dd className="text-lg font-semibold">{p.studied} <span className="text-sm font-normal text-muted-foreground">of {p.totalDishes}</span></dd></div>
            <div><dt className="text-muted-foreground">Quizzes completed</dt><dd className="text-lg font-semibold">{p.quizzesCompleted} <span className="text-sm font-normal text-muted-foreground">of {p.quizzesAvailable}</span></dd></div>
            <div><dt className="text-muted-foreground">Passed</dt><dd className="text-lg font-semibold text-success">{p.quizzesPassed}</dd></div>
            <div><dt className="text-muted-foreground">To retake</dt><dd className={`text-lg font-semibold ${p.quizzesFailed ? "text-destructive" : ""}`}>{p.quizzesFailed}</dd></div>
          </dl>
        </CardContent>
      </Card>

      {p.totalDishes === 0 && (
        <div className="mt-6"><EmptyState icon={BookOpen} title="No dishes to study yet" description="Your manager hasn't published any dishes. They'll show up here as soon as they do." /></div>
      )}

      {needsReview.length > 0 && (
        <Section title="Updated · please review" icon={AlertTriangle}>
          <p className="mb-3 rounded-md bg-warning-soft px-3 py-2.5 text-sm text-warning">These dishes have changed since you studied them. Review the new information and take the quiz again.</p>
          <DishList dishes={needsReview} />
        </Section>
      )}
      {d.failedQuizzes.length > 0 && <Section title="Retake needed" icon={RotateCcw}><DishList dishes={d.failedQuizzes} /></Section>}
      {d.pendingQuizzes.length > 0 && <Section title="Quizzes ready" icon={Sparkles}><DishList dishes={d.pendingQuizzes} /></Section>}
      {toStudy.length > 0 && <Section title="Dishes to study" icon={BookOpen} href="/employee/menu"><DishList dishes={toStudy.slice(0, 4)} /></Section>}

      {categories.length > 0 && (
        <Section title="Categories" icon={BookOpen}>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => <Button key={c.id} asChild variant="secondary" size="sm" className="h-9 rounded-full px-4"><Link href={`/employee/menu?category=${c.id}`}>{c.name}</Link></Button>)}
          </div>
        </Section>
      )}
      {d.recentlyAdded.length > 0 && <Section title="Recently added" icon={Sparkles} href="/employee/menu"><DishList dishes={d.recentlyAdded.slice(0, 3)} /></Section>}
    </>
  );
}
