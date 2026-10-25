import { redirect } from "next/navigation";
import { requireEmployeePage } from "@/lib/authz";
import { db } from "@/lib/db";
import { getPlayAttempt } from "@/lib/services/attempts";
import { QuizPlayer } from "./quiz-player";

export const metadata = { title: "Quiz" };

export default async function QuizPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requireEmployeePage();
  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) redirect("/employee/menu");
  const play = await getPlayAttempt(user.id, attemptId);
  if (!play) {
    // Already submitted (e.g. back button after finishing) → show the result instead of an error.
    const done = await db.quizAttempt.findFirst({ where: { id: attemptId, userId: user.id, status: "SUBMITTED" }, select: { id: true } });
    redirect(done ? `/employee/results/${done.id}` : "/employee/menu");
  }
  const dish = await db.quizAttempt.findUniqueOrThrow({ where: { id: attemptId }, select: { quiz: { select: { dishId: true } } } });
  return <QuizPlayer attemptId={play.attemptId} dishId={dish.quiz.dishId} dishName={play.dishName} quizTitle={play.quizTitle} questions={play.questions} />;
}
