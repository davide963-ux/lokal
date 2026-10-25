import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { buildQuizSnapshot, hasUnpublishedChanges, publishProblems } from "@/lib/services/quizzes";
import { CreateQuiz, QuizBuilder } from "./quiz-builder";

export const metadata = { title: "Quiz builder" };

export default async function QuizBuilderPage({ params }: { params: Promise<{ dishId: string }> }) {
  await requireAdminPage();
  const { dishId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(dishId)) notFound();
  const dish = await db.dish.findUnique({ where: { id: dishId }, select: { id: true, name: true, status: true } });
  if (!dish) notFound();
  const quiz = await db.quiz.findUnique({ where: { dishId } });

  const back = <Link href="/admin/quizzes" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Quizzes</Link>;
  if (!quiz) {
    return (<>{back}<PageHeader title={dish.name} description="This dish has no quiz yet." /><CreateQuiz dishId={dish.id} /></>);
  }
  const [snapshot, unpublished, attempts] = await Promise.all([
    buildQuizSnapshot(db, quiz.id),
    hasUnpublishedChanges(quiz.id),
    db.quizAttempt.count({ where: { quizId: quiz.id, status: "SUBMITTED" } }),
  ]);
  return (
    <>
      {back}
      <PageHeader title={dish.name} description={dish.status === "PUBLISHED" ? "Quiz builder" : `The dish is ${dish.status.toLowerCase()}, so employees can't see this quiz yet.`} />
      <QuizBuilder
        quizId={quiz.id} status={quiz.status} version={quiz.currentVersion} unpublishedChanges={unpublished} attempts={attempts}
        problems={publishProblems(snapshot)} settings={{ ...snapshot.settings, title: snapshot.title }}
        questions={snapshot.questions}
      />
    </>
  );
}
