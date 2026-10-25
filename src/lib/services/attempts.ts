import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { gradeAttempt, InvalidSubmission, issueQuestions, toPlayQuestions } from "@/lib/quiz/grading";
import type { IssuedQuestion, PlayQuestion, QuizSnapshot } from "@/lib/quiz/types";
import { notifyAdmins } from "./notifications";
import { loadStatuses, notifyIfTrainingComplete } from "./training";

export type PlayAttempt = { attemptId: string; quizTitle: string; dishName: string; questions: PlayQuestion[] };

async function playPayload(attempt: { id: string; issuedQuestions: unknown; quizRevision: { questionSnapshot: unknown }; quiz: { title: string; dish: { name: string } } }): Promise<PlayAttempt> {
  const snapshot = attempt.quizRevision.questionSnapshot as unknown as QuizSnapshot;
  return {
    attemptId: attempt.id,
    quizTitle: attempt.quiz.title,
    dishName: attempt.quiz.dish.name,
    questions: toPlayQuestions(snapshot, attempt.issuedQuestions as IssuedQuestion[]),
  };
}

const attemptInclude = { quizRevision: true, quiz: { select: { title: true, dish: { select: { name: true } } } } } as const;

/**
 * Starts (or resumes) a quiz attempt. Rules enforced here, not in the UI:
 * dish + quiz published, employee has acknowledged the current training, retry policy respected.
 */
export async function startAttempt(userId: string, dishId: string): Promise<PlayAttempt> {
  const quiz = await db.quiz.findFirst({ where: { dishId, status: "PUBLISHED", dish: { status: "PUBLISHED" } } });
  if (!quiz) throw new DomainError("This quiz is not available.");
  const revision = await db.quizRevision.findFirst({ where: { quizId: quiz.id }, orderBy: { version: "desc" } });
  if (!revision) throw new DomainError("This quiz is not available.");

  const status = (await loadStatuses(userId, [dishId])).get(dishId)!;
  if (status.studyState === "NOT_STUDIED") throw new DomainError("Study this dish and confirm it before taking the quiz.");
  if (status.studyState === "NEEDS_REVIEW") throw new DomainError("This dish was updated. Review the new information first.");
  if (!status.canStartQuiz) throw new DomainError("You have used all attempts allowed for this quiz.");

  // The attempt records the dish revision the employee actually studied.
  const studied = await db.dishStudyProgress.findFirst({ where: { userId, dishId }, orderBy: { dishRevision: { version: "desc" } }, select: { dishRevisionId: true } });
  if (!studied) throw new DomainError("Study this dish and confirm it before taking the quiz.");

  const existing = await db.quizAttempt.findFirst({ where: { userId, quizId: quiz.id, status: "IN_PROGRESS" }, include: attemptInclude });
  if (existing) {
    if (existing.quizRevisionId === revision.id) return playPayload(existing); // resume
    await db.quizAttempt.delete({ where: { id: existing.id } }); // quiz changed since: unfinished attempt is void
  }

  const snapshot = revision.questionSnapshot as unknown as QuizSnapshot;
  const issued = issueQuestions(snapshot);
  if (issued.length === 0) throw new DomainError("This quiz is not available.");
  try {
    const created = await db.quizAttempt.create({
      data: {
        userId, quizId: quiz.id, quizRevisionId: revision.id, dishRevisionId: studied.dishRevisionId,
        issuedQuestions: issued, totalQuestions: issued.length, passingScore: snapshot.settings.passingScore,
      },
      include: attemptInclude,
    });
    return playPayload(created);
  } catch (e) {
    // Two taps at once: the partial unique index allows only one in-progress attempt. Resume the winner.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const winner = await db.quizAttempt.findFirst({ where: { userId, quizId: quiz.id, status: "IN_PROGRESS" }, include: attemptInclude });
      if (winner) return playPayload(winner);
    }
    throw e;
  }
}

export async function getPlayAttempt(userId: string, attemptId: string): Promise<PlayAttempt | null> {
  const attempt = await db.quizAttempt.findFirst({ where: { id: attemptId, userId, status: "IN_PROGRESS" }, include: attemptInclude });
  return attempt ? playPayload(attempt) : null;
}

/** Grades on the server against the immutable revision. `answers`: questionId → optionId. */
export async function submitAttempt(userId: string, attemptId: string, answers: Record<string, string | undefined>) {
  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { quizRevision: true, quiz: { select: { dishId: true, dish: { select: { name: true } } } }, user: { select: { name: true } } },
  });
  if (!attempt) throw new DomainError("Attempt not found.");
  if (attempt.status === "SUBMITTED") return { attemptId, alreadySubmitted: true };

  let graded;
  try {
    graded = gradeAttempt(attempt.quizRevision.questionSnapshot as unknown as QuizSnapshot, attempt.issuedQuestions as unknown as IssuedQuestion[], answers, attempt.passingScore);
  } catch (e) {
    if (e instanceof InvalidSubmission) throw new DomainError("Your answers could not be processed. Please reload and try again.");
    throw e;
  }

  const won = await db.$transaction(async (tx) => {
    // Conditional claim: concurrent submits cannot both record a result.
    const claimed = await tx.quizAttempt.updateMany({
      where: { id: attemptId, userId, status: "IN_PROGRESS" },
      data: { status: "SUBMITTED", correctCount: graded.correct, score: graded.score, passed: graded.passed, submittedAt: new Date() },
    });
    if (claimed.count !== 1) return false;
    await tx.quizAttemptAnswer.createMany({
      data: graded.questions.map((q) => ({
        attemptId, questionRef: q.questionId, questionText: q.questionText,
        selectedOptionRef: q.selectedOptionId, selectedAnswer: q.selectedText, isCorrect: q.isCorrect,
      })),
    });
    return true;
  });
  if (!won) return { attemptId, alreadySubmitted: true };

  if (!graded.passed) {
    await notifyAdmins({
      type: "QUIZ_FAILED", title: `${attempt.user.name} failed ${attempt.quiz.dish.name}`,
      message: `Scored ${graded.score}% (needs ${attempt.passingScore}%).`, link: `/admin/employees/${userId}`,
    });
  } else {
    await notifyIfTrainingComplete(userId);
  }
  return { attemptId, alreadySubmitted: false, score: graded.score, passed: graded.passed };
}

export type AttemptResult = {
  attemptId: string; dishId: string; dishName: string; quizTitle: string; submittedAt: Date;
  total: number; correct: number; incorrect: number; score: number; passed: boolean; passingScore: number;
  showCorrectAnswers: boolean; dishVersion: number; canRetry: boolean;
  questions: { text: string; selectedText: string | null; isCorrect: boolean; correctText: string | null; explanation: string | null }[];
};

export async function getAttemptResult(userId: string, attemptId: string): Promise<AttemptResult | null> {
  const a = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId, status: "SUBMITTED" },
    include: { quizRevision: true, quiz: { select: { title: true, dishId: true, dish: { select: { name: true } } } }, answers: true, dishRevision: { select: { version: true } } },
  });
  if (!a) return null;
  const snapshot = a.quizRevision.questionSnapshot as unknown as QuizSnapshot;
  const show = snapshot.settings.showCorrectAnswers;
  const byQ = new Map(a.answers.map((x) => [x.questionRef, x]));
  const qById = new Map(snapshot.questions.map((q) => [q.id, q]));
  const issued = a.issuedQuestions as unknown as IssuedQuestion[];
  const status = (await loadStatuses(userId, [a.quiz.dishId])).get(a.quiz.dishId);
  return {
    attemptId: a.id, dishId: a.quiz.dishId, dishName: a.quiz.dish.name, quizTitle: a.quiz.title, submittedAt: a.submittedAt!,
    total: a.totalQuestions, correct: a.correctCount ?? 0, incorrect: a.totalQuestions - (a.correctCount ?? 0),
    score: a.score ?? 0, passed: a.passed ?? false, passingScore: a.passingScore, showCorrectAnswers: show,
    dishVersion: a.dishRevision.version, canRetry: !!status?.canStartQuiz,
    questions: issued.map((iq) => {
      const q = qById.get(iq.questionId)!;
      const ans = byQ.get(iq.questionId);
      return {
        text: q.text, selectedText: ans?.selectedAnswer ?? null, isCorrect: ans?.isCorrect ?? false,
        correctText: show ? q.options.find((o) => o.isCorrect)?.text ?? null : null,
        explanation: show ? q.explanation : null,
      };
    }),
  };
}

export async function listAttempts(userId: string) {
  return db.quizAttempt.findMany({
    where: { userId, status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
    select: { id: true, score: true, passed: true, submittedAt: true, correctCount: true, totalQuestions: true, quiz: { select: { dishId: true, dish: { select: { name: true } } } }, dishRevision: { select: { version: true } } },
  });
}
