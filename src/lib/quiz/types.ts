// Client-safe types for quizzes (no server imports).

export type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE";

export type SnapshotOption = { id: string; text: string; isCorrect: boolean };
export type SnapshotQuestion = {
  id: string;
  text: string;
  type: QuestionType;
  explanation: string | null;
  options: SnapshotOption[];
};
export type QuizSettings = {
  passingScore: number;
  allowRetries: boolean;
  questionCount: number | null;
  randomizeQuestions: boolean;
  randomizeAnswers: boolean;
  showCorrectAnswers: boolean;
};
/** Immutable copy of a published quiz. Contains answers: NEVER send to the browser. */
export type QuizSnapshot = { title: string; settings: QuizSettings; questions: SnapshotQuestion[] };

/** What the server locked in when an attempt started: which questions, in which order. IDs only. */
export type IssuedQuestion = { questionId: string; optionIds: string[] };

/** What the browser is allowed to see while taking the quiz. */
export type PlayQuestion = {
  id: string;
  text: string;
  type: QuestionType;
  options: { id: string; text: string }[];
};
