"use server";

import { revalidatePath } from "next/cache";
import { assertEmployee } from "@/lib/authz";
import { fail, runAction, type ActionResult } from "@/lib/action";
import { rateLimit } from "@/lib/rate-limit";
import { startAttempt, submitAttempt } from "@/lib/services/attempts";
import { acknowledgeStudy } from "@/lib/services/training";
import { uuid } from "@/lib/validation/common";

export async function acknowledgeStudyAction(dishId: string): Promise<ActionResult<{ studiedAt: string }>> {
  return runAction(async () => {
    const user = await assertEmployee();
    const res = await acknowledgeStudy(user.id, uuid.parse(dishId));
    revalidatePath("/employee", "layout");
    return { ok: true, data: { studiedAt: res.studiedAt.toISOString() }, message: "Great. You can take the quiz now." };
  });
}

export async function startQuizAction(dishId: string): Promise<ActionResult<{ attemptId: string }>> {
  return runAction(async () => {
    const user = await assertEmployee();
    const limited = await rateLimit(`quiz-start:${user.id}`, 30, 10 * 60);
    if (!limited.ok) return fail("You're starting quizzes very quickly. Please wait a moment.");
    const play = await startAttempt(user.id, uuid.parse(dishId));
    return { ok: true, data: { attemptId: play.attemptId } };
  });
}

export async function submitQuizAction(attemptId: string, answers: Record<string, string>): Promise<ActionResult<{ attemptId: string }>> {
  return runAction(async () => {
    const user = await assertEmployee();
    const limited = await rateLimit(`quiz-submit:${user.id}`, 40, 10 * 60);
    if (!limited.ok) return fail("Too many submissions. Please wait a moment.");
    // `answers` is untrusted: shape-check before it reaches the grader.
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(answers ?? {})) {
      if (typeof v === "string" && Object.keys(clean).length < 500) clean[k] = v;
    }
    await submitAttempt(user.id, uuid.parse(attemptId), clean);
    revalidatePath("/employee", "layout");
    return { ok: true, data: { attemptId } };
  });
}
