"use client";

import { ArrowLeft, ArrowRight, Check, CircleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { submitQuizAction } from "@/app/employee/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useAction } from "@/components/use-action";
import type { PlayQuestion } from "@/lib/quiz/types";
import { cn } from "@/lib/utils";

const store = {
  read(key: string): { answers: Record<string, string>; index: number } | null {
    try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
  },
  write(key: string, value: unknown) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: progress just isn't persisted */ } },
  clear(key: string) { try { sessionStorage.removeItem(key); } catch { /* ignore */ } },
};

export function QuizPlayer({ attemptId, dishId, dishName, quizTitle, questions }: {
  attemptId: string; dishId: string; dishName: string; quizTitle: string; questions: PlayQuestion[];
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const key = `quiz:${attemptId}`;
  const total = questions.length;
  const [index, setIndex] = useState(0); // === total means the review screen
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  // Restore after a refresh (client-only, after hydration to avoid mismatches).
  useEffect(() => {
    const saved = store.read(key);
    if (!saved) return;
    const valid: Record<string, string> = {};
    for (const q of questions) { const a = saved.answers?.[q.id]; if (a && q.options.some((o) => o.id === a)) valid[q.id] = a; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnswers(valid); setIndex(Math.min(Math.max(saved.index ?? 0, 0), total));
  }, [key, questions, total]);

  const go = (i: number) => { setIndex(i); store.write(key, { answers, index: i }); window.scrollTo({ top: 0 }); };
  const choose = (qid: string, oid: string) => {
    const next = { ...answers, [qid]: oid };
    setAnswers(next); store.write(key, { answers: next, index });
  };
  const answered = questions.filter((q) => answers[q.id]).length;
  const unanswered = total - answered;
  const q = questions[index];
  const reviewing = index === total;

  function submit() {
    run(() => submitQuizAction(attemptId, answers), {
      success: false, refresh: false,
      onSuccess: () => { store.clear(key); router.replace(`/employee/results/${attemptId}`); },
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="border-b border-border bg-card px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link href={`/employee/menu/${dishId}`} aria-label="Leave quiz (your answers are saved)" className="-ml-2 rounded-md p-2 text-muted-foreground"><X className="size-5" /></Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{dishName} · {quizTitle}</p>
            <p className="text-sm font-semibold" aria-live="polite">{reviewing ? "Review your answers" : `Question ${index + 1} of ${total}`}</p>
          </div>
          <p className="text-xs text-muted-foreground">{answered}/{total} answered</p>
        </div>
        <Progress label="Quiz progress" value={((reviewing ? total : index) / total) * 100} className="mx-auto mt-3 max-w-2xl" />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-6">
        {q && (
          <div key={q.id} className="animate-in fade-in slide-in-from-right-4 duration-200">
            <h1 className="font-display text-2xl font-semibold leading-snug">{q.text}</h1>
            <div role="radiogroup" aria-label={q.text} className="mt-6 grid gap-3">
              {q.options.map((o, i) => {
                const selected = answers[q.id] === o.id;
                return (
                  <button key={o.id} type="button" role="radio" aria-checked={selected} onClick={() => choose(q.id, o.id)}
                    className={cn("flex min-h-16 items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-base transition-all active:scale-[0.99]",
                      selected ? "border-primary bg-primary-soft font-medium" : "border-border bg-card hover:border-input")}>
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold", selected ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground")}>
                      {selected ? <Check className="size-4" /> : q.type === "TRUE_FALSE" ? (i === 0 ? "T" : "F") : String.fromCharCode(65 + i)}
                    </span>
                    {o.text}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {reviewing && (
          <div className="animate-in fade-in duration-200">
            <h1 className="font-display text-2xl font-semibold">Ready to submit?</h1>
            {unanswered > 0 && <p className="mt-2 flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning"><CircleAlert className="size-4 shrink-0" />{unanswered} question{unanswered === 1 ? " is" : "s are"} unanswered and will count as incorrect.</p>}
            <ol className="mt-4 grid gap-2">
              {questions.map((qq, i) => {
                const a = qq.options.find((o) => o.id === answers[qq.id]);
                return (
                  <li key={qq.id}>
                    <button type="button" onClick={() => go(i)} className={cn("w-full rounded-lg border px-4 py-3 text-left", a ? "border-border bg-card" : "border-warning bg-warning-soft")}>
                      <p className="text-sm text-muted-foreground">Question {i + 1}</p>
                      <p className="line-clamp-2 font-medium">{qq.text}</p>
                      <p className={cn("mt-1 text-sm", a ? "text-primary" : "font-medium text-warning")}>{a ? a.text : "Not answered"}</p>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-2xl gap-3">
          <Button variant="secondary" size="lg" className="h-14 flex-1" disabled={index === 0 || pending} onClick={() => go(index - 1)}><ArrowLeft />Previous</Button>
          {reviewing
            ? <Button size="lg" className="h-14 flex-[2]" loading={pending} onClick={() => setConfirming(true)}>Submit answers</Button>
            : <Button size="lg" className="h-14 flex-[2]" onClick={() => go(index + 1)}>{index === total - 1 ? "Review" : "Next"}<ArrowRight /></Button>}
        </div>
      </footer>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit your answers?</DialogTitle>
            <DialogDescription>{unanswered > 0 ? `${unanswered} unanswered question${unanswered === 1 ? "" : "s"} will count as incorrect. ` : ""}You can&apos;t change your answers after submitting.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Keep reviewing</Button></DialogClose>
            <Button loading={pending} onClick={() => { setConfirming(false); submit(); }}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
