"use client";

import { ArrowDown, ArrowUp, Check, CircleAlert, EyeOff, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { FormMessage } from "@/components/ui/form-message";
import { useAction } from "@/components/use-action";
import { cn } from "@/lib/utils";
import type { QuizSettings, SnapshotQuestion } from "@/lib/quiz/types";
import {
  createQuizAction, deleteQuestionAction, moveQuestionAction, publishQuizAction, saveQuestionAction,
  unpublishQuizAction, updateQuizSettingsAction,
} from "../actions";

export function CreateQuiz({ dishId }: { dishId: string }) {
  const { run, pending } = useAction();
  return <Button size="lg" loading={pending} onClick={() => run(() => createQuizAction(dishId))}><Plus />Create quiz</Button>;
}

type Settings = QuizSettings & { title: string };

export function QuizBuilder({ quizId, status, version, unpublishedChanges, attempts, problems, settings, questions }: {
  quizId: string; status: "DRAFT" | "PUBLISHED"; version: number; unpublishedChanges: boolean; attempts: number;
  problems: string[]; settings: Settings; questions: SnapshotQuestion[];
}) {
  const published = status === "PUBLISHED";
  return (
    <div className="grid max-w-3xl gap-6">
      <PublishBar quizId={quizId} published={published} version={version} unpublishedChanges={unpublishedChanges} problems={problems} attempts={attempts} />
      <SettingsCard quizId={quizId} initial={settings} />
      <QuestionsCard quizId={quizId} questions={questions} />
    </div>
  );
}

function PublishBar({ quizId, published, version, unpublishedChanges, problems, attempts }: { quizId: string; published: boolean; version: number; unpublishedChanges: boolean; problems: string[]; attempts: number }) {
  const { run, pending } = useAction();
  const blocked = problems.length > 0;
  return (
    <Card>
      <CardContent className="grid gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {published ? <Badge variant="success">published · v{version}</Badge> : <Badge variant="warning">draft</Badge>}
          {published && unpublishedChanges && <Badge variant="primary">unpublished changes</Badge>}
          {attempts > 0 && <span className="text-xs text-muted-foreground">{attempts} submitted attempt{attempts === 1 ? "" : "s"}</span>}
          <div className="ml-auto flex gap-2">
            {published && <ConfirmButton variant="secondary" loading={pending} title="Unpublish this quiz?" confirmLabel="Unpublish" description="Employees won't be able to start it. Past results are kept." onConfirm={() => run(() => unpublishQuizAction(quizId))}><EyeOff />Unpublish</ConfirmButton>}
            {(!published || unpublishedChanges) && (
              <Button loading={pending} disabled={blocked} onClick={() => run(() => publishQuizAction(quizId))}><Rocket />{published ? "Publish changes" : "Publish quiz"}</Button>
            )}
          </div>
        </div>
        {blocked && (
          <ul className="grid gap-1 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            {problems.map((p) => <li key={p} className="flex gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" />{p}</li>)}
          </ul>
        )}
        {published && unpublishedChanges && !blocked && <p className="text-xs text-muted-foreground">Employees still take the last published version until you publish these changes. Attempts already in progress on the old version are discarded when you do.</p>}
      </CardContent>
    </Card>
  );
}

function SettingsCard({ quizId, initial }: { quizId: string; initial: Settings }) {
  const { run, pending } = useAction();
  const [v, setV] = useState({ ...initial, questionCount: initial.questionCount?.toString() ?? "" });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string>();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  return (
    <Card>
      <CardHeader><CardTitle>Settings</CardTitle><CardDescription>Changes apply to employees after you publish.</CardDescription></CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={(e) => {
          e.preventDefault(); setErrors({}); setFormError(undefined);
          run(() => updateQuizSettingsAction(quizId, { ...v, passingScore: Number(v.passingScore), questionCount: v.questionCount.trim() === "" ? null : Number(v.questionCount) }),
            { onError: (r) => { setErrors(r.fieldErrors ?? {}); if (!r.fieldErrors) setFormError(r.error); } });
        }}>
          <Field label="Quiz title" htmlFor="qt" required error={errors.title?.[0]}><Input id="qt" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={120} required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Passing score (%)" htmlFor="ps" error={errors.passingScore?.[0]} hint="Default 80."><Input id="ps" inputMode="numeric" value={v.passingScore} onChange={(e) => set("passingScore", e.target.value as unknown as number)} /></Field>
            <Field label="Questions per attempt" htmlFor="qc" error={errors.questionCount?.[0]} hint="Leave empty to ask every question."><Input id="qc" inputMode="numeric" value={v.questionCount} onChange={(e) => set("questionCount", e.target.value)} placeholder="All" /></Field>
          </div>
          <div className="grid gap-1">
            <Checkbox label="Allow retries" hint="Employees who fail (or want practice) can try again." checked={v.allowRetries} onChange={(e) => set("allowRetries", e.target.checked)} />
            <Checkbox label="Randomize question order" checked={v.randomizeQuestions} onChange={(e) => set("randomizeQuestions", e.target.checked)} />
            <Checkbox label="Randomize answer order" hint="True / False always stays in order." checked={v.randomizeAnswers} onChange={(e) => set("randomizeAnswers", e.target.checked)} />
            <Checkbox label="Show correct answers after submitting" checked={v.showCorrectAnswers} onChange={(e) => set("showCorrectAnswers", e.target.checked)} />
          </div>
          {formError && <FormMessage type="error">{formError}</FormMessage>}
          <div><Button type="submit" loading={pending}>Save settings</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function QuestionsCard({ quizId, questions }: { quizId: string; questions: SnapshotQuestion[] }) {
  const { run, pending } = useAction();
  const [editing, setEditing] = useState<SnapshotQuestion | "new" | null>(null);
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div><CardTitle>Questions <span className="font-sans text-sm font-normal text-muted-foreground">({questions.length})</span></CardTitle><CardDescription>Employees answer one question per screen.</CardDescription></div>
        <Button onClick={() => setEditing("new")}><Plus />Add question</Button>
      </CardHeader>
      <CardContent>
        {questions.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No questions yet. Add a multiple choice or true / false question.</p>}
        <ol className="grid gap-3">
          {questions.map((q, i) => (
            <li key={q.id} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-start gap-2">
                <div className="flex flex-col">
                  <Button variant="ghost" size="icon" className="size-7" aria-label={`Move question ${i + 1} up`} disabled={i === 0 || pending} onClick={() => run(() => moveQuestionAction(quizId, q.id, "up"), { success: false })}><ArrowUp className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-7" aria-label={`Move question ${i + 1} down`} disabled={i === questions.length - 1 || pending} onClick={() => run(() => moveQuestionAction(quizId, q.id, "down"), { success: false })}><ArrowDown className="size-3.5" /></Button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium"><span className="text-muted-foreground">{i + 1}.</span> {q.text}</p>
                  <ul className="mt-2 grid gap-1">
                    {q.options.map((o) => (
                      <li key={o.id} className={cn("flex items-center gap-2 rounded px-2 py-1 text-sm", o.isCorrect ? "bg-success-soft font-medium text-success" : "text-muted-foreground")}>
                        {o.isCorrect ? <Check className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}{o.text}
                      </li>
                    ))}
                  </ul>
                  {q.explanation && <p className="mt-2 text-xs text-muted-foreground">Explanation: {q.explanation}</p>}
                </div>
                <Badge>{q.type === "TRUE_FALSE" ? "true / false" : "multiple choice"}</Badge>
                <Button variant="ghost" size="icon" className="size-9" aria-label={`Edit question ${i + 1}`} onClick={() => setEditing(q)}><Pencil /></Button>
                <ConfirmButton variant="ghost" size="icon" className="size-9 text-destructive" aria-label={`Delete question ${i + 1}`} destructive title="Delete this question?" confirmLabel="Delete" description="Past results keep their original questions." onConfirm={() => run(() => deleteQuestionAction(quizId, q.id))}><Trash2 /></ConfirmButton>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
      {editing && <QuestionDialog quizId={quizId} question={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function QuestionDialog({ quizId, question, onClose }: { quizId: string; question: SnapshotQuestion | null; onClose: () => void }) {
  const { run, pending } = useAction();
  const [type, setType] = useState<"MULTIPLE_CHOICE" | "TRUE_FALSE">(question?.type ?? "MULTIPLE_CHOICE");
  const [text, setText] = useState(question?.text ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [options, setOptions] = useState(
    question?.type === "MULTIPLE_CHOICE" ? question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
      : [{ text: "", isCorrect: true }, { text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }],
  );
  const [tf, setTf] = useState<boolean>(question?.type === "TRUE_FALSE" ? question.options.find((o) => o.isCorrect)?.text === "True" : true);
  const [error, setError] = useState<string>();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <form className="grid gap-4" onSubmit={(e) => {
          e.preventDefault(); setError(undefined);
          const filled = options.filter((o) => o.text.trim());
          run(() => saveQuestionAction(quizId, question?.id ?? null, {
            questionText: text, questionType: type, explanation,
            options: type === "MULTIPLE_CHOICE" ? filled : [], trueFalseAnswer: type === "TRUE_FALSE" ? tf : undefined,
          }), { onSuccess: onClose, onError: (r) => setError(r.fieldErrors?.options?.[0] ?? r.fieldErrors?.questionText?.[0] ?? r.error) });
        }}>
          <DialogHeader><DialogTitle>{question ? "Edit question" : "New question"}</DialogTitle><DialogDescription className="sr-only">Question editor</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Question type">
            {([["MULTIPLE_CHOICE", "Multiple choice"], ["TRUE_FALSE", "True / False"]] as const).map(([val, label]) => (
              <button key={val} type="button" role="radio" aria-checked={type === val} onClick={() => setType(val)}
                className={cn("rounded-md px-3 py-2 text-sm font-medium transition-colors", type === val ? "bg-card shadow-sm" : "text-muted-foreground")}>{label}</button>
            ))}
          </div>
          <Field label={type === "TRUE_FALSE" ? "Statement" : "Question"} htmlFor="qtext" required>
            <Textarea id="qtext" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={500} required autoFocus />
          </Field>
          {type === "MULTIPLE_CHOICE" ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Answers <span className="font-normal text-muted-foreground">· select the correct one</span></legend>
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" aria-label={`Answer ${i + 1} is correct`} className="size-5 shrink-0 accent-[var(--primary)]" checked={o.isCorrect}
                    onChange={() => setOptions(options.map((x, j) => ({ ...x, isCorrect: i === j })))} />
                  <Input value={o.text} placeholder={`Answer ${i + 1}`} aria-label={`Answer ${i + 1}`} maxLength={200} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                  {options.length > 2 && <Button type="button" variant="ghost" size="icon" aria-label={`Remove answer ${i + 1}`} onClick={() => setOptions(options.filter((_, j) => j !== i).map((x, j, arr) => (arr.some((a) => a.isCorrect) ? x : { ...x, isCorrect: j === 0 })))}><Trash2 /></Button>}
                </div>
              ))}
              {options.length < 6 && <div><Button type="button" variant="secondary" size="sm" onClick={() => setOptions([...options, { text: "", isCorrect: false }])}><Plus />Add answer</Button></div>}
            </fieldset>
          ) : (
            <fieldset className="grid gap-1">
              <legend className="mb-1 text-sm font-medium">Correct answer</legend>
              {[true, false].map((val) => (
                <label key={String(val)} className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2.5">
                  <input type="radio" name="tf" className="size-5 accent-[var(--primary)]" checked={tf === val} onChange={() => setTf(val)} />{val ? "True" : "False"}
                </label>
              ))}
            </fieldset>
          )}
          <Field label="Explanation" htmlFor="qexp" hint="Optional. Shown after submitting, if correct answers are shown."><Textarea id="qexp" value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} maxLength={1000} /></Field>
          {error && <FormMessage type="error">{error}</FormMessage>}
          <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" loading={pending}>{question ? "Save question" : "Add question"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
