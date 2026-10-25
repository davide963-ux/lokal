import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, PartyPopper, RotateCcw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireEmployeePage } from "@/lib/authz";
import { getAttemptResult } from "@/lib/services/attempts";
import { cn } from "@/lib/utils";

export const metadata = { title: "Quiz results" };

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireEmployeePage();
  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();
  const r = await getAttemptResult(user.id, attemptId);
  if (!r) notFound();

  return (
    <div className="space-y-5">
      <Card className={cn("overflow-hidden border-2", r.passed ? "border-success/40" : "border-destructive/40")}>
        <div className={cn("px-5 py-6 text-center", r.passed ? "bg-success-soft" : "bg-destructive-soft")}>
          <p className="text-sm font-medium text-muted-foreground">Quiz completed</p>
          <p className={cn("mt-1 flex items-center justify-center gap-2 font-display text-4xl font-semibold", r.passed ? "text-success" : "text-destructive")}>
            {r.passed ? <PartyPopper className="size-8" /> : null}{r.passed ? "PASSED" : "NOT PASSED"}
          </p>
          <p className="mt-2 font-display text-6xl font-semibold tracking-tight">{r.score}%</p>
          {!r.passed && <p className="mt-1 text-sm text-muted-foreground">You need {r.passingScore}% to pass.</p>}
        </div>
        <CardContent className="p-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt className="text-muted-foreground">Dish</dt><dd className="font-semibold">{r.dishName}</dd></div>
            <div><dt className="text-muted-foreground">Quiz</dt><dd className="font-semibold">{r.quizTitle}</dd></div>
            <div><dt className="text-muted-foreground">Questions</dt><dd className="font-semibold">{r.total}</dd></div>
            <div><dt className="text-muted-foreground">Correct</dt><dd className="font-semibold text-success">{r.correct}</dd></div>
            <div><dt className="text-muted-foreground">Incorrect</dt><dd className="font-semibold text-destructive">{r.incorrect}</dd></div>
            <div><dt className="text-muted-foreground">Completed</dt><dd className="font-semibold">{r.submittedAt.toLocaleString()}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        {r.canRetry && !r.passed && <Button asChild size="lg" className="h-14"><Link href={`/employee/menu/${r.dishId}`}><RotateCcw />Review dish &amp; try again</Link></Button>}
        <Button asChild size="lg" variant="secondary" className="h-14"><Link href={`/employee/menu/${r.dishId}`}>Back to dish</Link></Button>
        <Button asChild size="lg" variant="secondary" className="h-14"><Link href="/employee/menu">Browse menu</Link></Button>
      </div>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Your answers</h2>
        {!r.showCorrectAnswers && <p className="mb-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">Correct answers aren&apos;t shown for this quiz.</p>}
        <ol className="grid gap-3">
          {r.questions.map((q, i) => (
            <li key={i} className={cn("rounded-lg border bg-card p-4", q.isCorrect ? "border-success/30" : "border-destructive/30")}>
              <div className="flex items-start gap-3">
                <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white", q.isCorrect ? "bg-success" : "bg-destructive")}>{q.isCorrect ? <Check className="size-4" /> : <X className="size-4" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i + 1}. {q.text}</p>
                  <p className="mt-1 text-sm">Your answer: <span className={q.isCorrect ? "font-medium text-success" : "font-medium text-destructive"}>{q.selectedText ?? "Not answered"}</span></p>
                  {!q.isCorrect && q.correctText && <p className="text-sm">Correct answer: <span className="font-medium text-success">{q.correctText}</span></p>}
                  {q.explanation && <p className="mt-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{q.explanation}</p>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <p className="text-center text-xs text-muted-foreground"><Badge>Dish version {r.dishVersion}</Badge></p>
    </div>
  );
}
