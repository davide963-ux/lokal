import { z } from "zod";
import { optText, reqText } from "./common";

export const quizSettingsInput = z.object({
  title: reqText("Quiz title", 120),
  passingScore: z.number().int().min(1, "Between 1 and 100").max(100, "Between 1 and 100"),
  allowRetries: z.boolean(),
  questionCount: z.number().int().min(1, "Must be at least 1").max(200).nullish().transform((v) => v ?? null),
  randomizeQuestions: z.boolean(),
  randomizeAnswers: z.boolean(),
  showCorrectAnswers: z.boolean(),
});
export type QuizSettingsInput = z.input<typeof quizSettingsInput>;

export const questionInput = z
  .object({
    questionText: reqText("Question", 500),
    questionType: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE"]),
    explanation: optText(1000),
    /** Multiple choice: the answers. True/False: ignored (fixed True/False). */
    options: z.array(z.object({ text: reqText("Answer", 200), isCorrect: z.boolean() })).max(6, "At most 6 answers").default([]),
    /** True/False: whether the statement is true. */
    trueFalseAnswer: z.boolean().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.questionType === "TRUE_FALSE") {
      if (q.trueFalseAnswer === undefined) ctx.addIssue({ code: "custom", path: ["trueFalseAnswer"], message: "Choose the correct answer" });
      return;
    }
    if (q.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least 2 answers" });
    if (q.options.filter((o) => o.isCorrect).length !== 1) ctx.addIssue({ code: "custom", path: ["options"], message: "Mark exactly one correct answer" });
    const texts = q.options.map((o) => o.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) ctx.addIssue({ code: "custom", path: ["options"], message: "Answers must be different" });
  });
export type QuestionInput = z.input<typeof questionInput>;
