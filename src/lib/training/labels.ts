import type { DishStatus } from "./status";

export type Tone = "neutral" | "success" | "warning" | "danger" | "primary";

/** One short, human label for where an employee stands on a dish. */
export function dishLabel(s: DishStatus): { text: string; tone: Tone } {
  if (s.studyState === "NEEDS_REVIEW") return { text: "Updated · review", tone: "warning" };
  if (s.studyState === "NOT_STUDIED") return { text: "To study", tone: "neutral" };
  switch (s.quizState) {
    case "PASSED": return { text: s.bestScore !== null ? `Passed · ${s.bestScore}%` : "Passed", tone: "success" };
    case "FAILED": return { text: `Retake · ${s.lastScore}%`, tone: "danger" };
    case "AVAILABLE": return { text: "Quiz ready", tone: "primary" };
    default: return { text: "Studied", tone: "success" };
  }
}
