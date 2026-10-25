"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import { runAction, type ActionResult } from "@/lib/action";
import {
  deleteQuestion, getOrCreateQuiz, moveQuestion, publishQuiz, saveQuestion, unpublishQuiz, updateQuizSettings,
} from "@/lib/services/quizzes";
import { uuid } from "@/lib/validation/common";
import type { QuestionInput, QuizSettingsInput } from "@/lib/validation/quiz";

const refresh = () => {
  revalidatePath("/admin/quizzes", "layout");
  revalidatePath("/admin");
};

export async function createQuizAction(dishId: string): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await getOrCreateQuiz(uuid.parse(dishId));
    refresh();
    return { ok: true, message: "Quiz created" };
  });
}
export async function updateQuizSettingsAction(quizId: string, input: QuizSettingsInput): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await updateQuizSettings(uuid.parse(quizId), input);
    refresh();
    return { ok: true, message: "Quiz settings saved" };
  });
}
export async function saveQuestionAction(quizId: string, questionId: string | null, input: QuestionInput): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await saveQuestion(uuid.parse(quizId), questionId ? uuid.parse(questionId) : null, input);
    refresh();
    return { ok: true, message: questionId ? "Question updated" : "Question added" };
  });
}
export async function deleteQuestionAction(quizId: string, questionId: string): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await deleteQuestion(uuid.parse(quizId), uuid.parse(questionId));
    refresh();
    return { ok: true, message: "Question deleted" };
  });
}
export async function moveQuestionAction(quizId: string, questionId: string, direction: "up" | "down"): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await moveQuestion(uuid.parse(quizId), uuid.parse(questionId), direction === "up" ? "up" : "down");
    refresh();
    return { ok: true };
  });
}
export async function publishQuizAction(quizId: string): Promise<ActionResult<{ version: number; changed: boolean }>> {
  return runAction(async () => {
    await assertAdmin();
    const res = await publishQuiz(uuid.parse(quizId));
    refresh();
    return { ok: true, data: res, message: res.changed ? `Quiz published (version ${res.version})` : "Quiz is already up to date" };
  });
}
export async function unpublishQuizAction(quizId: string): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await unpublishQuiz(uuid.parse(quizId));
    refresh();
    return { ok: true, message: "Quiz unpublished" };
  });
}
