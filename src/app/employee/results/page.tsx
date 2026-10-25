import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { requireEmployeePage } from "@/lib/authz";
import { listAttempts } from "@/lib/services/attempts";
import { listDishesForEmployee } from "@/lib/services/training";
import { DishList } from "@/components/employee/dish-card";

export const metadata = { title: "Results" };

export default async function ResultsPage() {
  const user = await requireEmployeePage();
  const [attempts, dishes] = await Promise.all([listAttempts(user.id), listDishesForEmployee(user.id)]);
  const retakes = dishes.filter((d) => d.status.quizState === "FAILED" && d.status.canStartQuiz);
  return (
    <>
      <h1 className="text-3xl font-semibold">Results</h1>
      {retakes.length > 0 && (
        <section className="mt-5"><h2 className="mb-3 text-lg font-semibold">Eligible for a retake</h2><DishList dishes={retakes} /></section>
      )}
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Quiz history</h2>
        {attempts.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No quizzes taken yet" description="Study a dish, then take its quiz. Your scores will appear here." action={<Button asChild><Link href="/employee/menu">Browse menu</Link></Button>} />
        ) : (
          <Card><ul className="divide-y divide-border">
            {attempts.map((a) => (
              <li key={a.id}>
                <Link href={`/employee/results/${a.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-muted/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.quiz.dish.name}</p>
                    <p className="text-xs text-muted-foreground">{a.submittedAt!.toLocaleDateString()} · {a.correctCount}/{a.totalQuestions} correct · v{a.dishRevision.version}</p>
                  </div>
                  <span className="font-display text-xl font-semibold">{a.score}%</span>
                  <Badge variant={a.passed ? "success" : "danger"}>{a.passed ? "passed" : "failed"}</Badge>
                </Link>
              </li>
            ))}
          </ul></Card>
        )}
      </section>
    </>
  );
}
