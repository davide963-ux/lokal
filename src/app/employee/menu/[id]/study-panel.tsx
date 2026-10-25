"use client";

import { CheckCircle2, Lock, PlayCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAction } from "@/components/use-action";
import { acknowledgeStudyAction, startQuizAction } from "@/app/employee/actions";
import type { QuizState, StudyState } from "@/lib/training/status";

export function StudyPanel({ dishId, studyState, quizState, canStartQuiz, studiedAt, lastScore, attempts, quiz }: {
  dishId: string; studyState: StudyState; quizState: QuizState; canStartQuiz: boolean; studiedAt: string | null;
  lastScore: number | null; attempts: number; quiz: { passingScore: number; allowRetries: boolean } | null;
}) {
  const router = useRouter();
  const study = useAction();
  const start = useAction();
  const studied = studyState === "STUDIED";

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-4 p-5">
        {!studied ? (
          <>
            <p className="text-sm text-muted-foreground">
              {studyState === "NEEDS_REVIEW" ? "Read the updated information above, then confirm." : "Read everything above, including the allergens, then confirm."}
              {quiz && " The quiz unlocks after you confirm."}
            </p>
            <Button size="lg" className="h-14 w-full text-base" loading={study.pending} onClick={() => study.run(() => acknowledgeStudyAction(dishId))}>
              <CheckCircle2 className="size-5" />I Have Studied This Dish
            </Button>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 font-medium text-success"><CheckCircle2 className="size-5" />Studied{studiedAt && ` on ${new Date(studiedAt).toLocaleDateString()}`}</p>
            {quiz ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {quizState === "PASSED" ? `You passed${lastScore !== null ? ` (latest ${lastScore}%)` : ""}.` : quizState === "FAILED" ? `Latest score ${lastScore}%. You need ${quiz.passingScore}% to pass.` : `You need ${quiz.passingScore}% to pass.`}
                  {attempts > 0 && ` Attempts: ${attempts}.`}
                </p>
                {canStartQuiz ? (
                  <Button size="lg" className="h-14 w-full text-base" loading={start.pending}
                    onClick={() => start.run(() => startQuizAction(dishId), { success: false, refresh: false, onSuccess: (r) => { toast.dismiss(); if (r.data) router.push(`/employee/quiz/${r.data.attemptId}`); } })}>
                    {quizState === "AVAILABLE" ? <><PlayCircle className="size-5" />Start quiz</> : <><RotateCcw className="size-5" />{quizState === "FAILED" ? "Try again" : "Practice again"}</>}
                  </Button>
                ) : (
                  <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"><Lock className="size-4" />No more attempts are allowed for this quiz.</p>
                )}
              </>
            ) : <p className="text-sm text-muted-foreground">There&apos;s no quiz for this dish.</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
