import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/authz";
import { db } from "@/lib/db";

export const metadata = { title: "Quizzes" };

export default async function QuizzesPage() {
  await requireAdminPage();
  const dishes = await db.dish.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    select: {
      id: true, name: true, status: true, category: { select: { name: true } },
      quiz: { select: { status: true, currentVersion: true, _count: { select: { questions: true } } } },
    },
  });
  const stats = await db.quizAttempt.groupBy({ by: ["quizId"], where: { status: "SUBMITTED" }, _count: true, _avg: { score: true } });
  const quizIds = new Map((await db.quiz.findMany({ select: { id: true, dishId: true } })).map((q) => [q.dishId, q.id]));
  const statBy = new Map(stats.map((s) => [s.quizId, s]));

  if (dishes.length === 0) {
    return (<><PageHeader title="Quizzes" /><EmptyState icon={ClipboardCheck} title="No dishes yet" description="Create a dish first, then write a quiz for it." action={<Button asChild><Link href="/admin/menu/new">Create a dish</Link></Button>} /></>);
  }
  return (
    <>
      <PageHeader title="Quizzes" description="One quiz per dish. Employees take it after studying the dish." />
      <Card><ul className="divide-y divide-border">
        {dishes.map((d) => {
          const st = d.quiz && statBy.get(quizIds.get(d.id) ?? "");
          return (
            <li key={d.id}>
              <Link href={`/admin/quizzes/${d.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-muted/50">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.category.name}{d.status !== "PUBLISHED" && ` · dish is ${d.status.toLowerCase()}`}</p>
                </div>
                {st ? <span className="text-xs text-muted-foreground">{st._count} attempt{st._count === 1 ? "" : "s"} · avg {Math.round(st._avg.score ?? 0)}%</span> : null}
                {d.quiz && <span className="text-xs text-muted-foreground">{d.quiz._count.questions} question{d.quiz._count.questions === 1 ? "" : "s"}</span>}
                {!d.quiz ? <Badge>no quiz</Badge> : d.quiz.status === "PUBLISHED" ? <Badge variant="success">published v{d.quiz.currentVersion}</Badge> : <Badge variant="warning">draft</Badge>}
              </Link>
            </li>
          );
        })}
      </ul></Card>
    </>
  );
}
