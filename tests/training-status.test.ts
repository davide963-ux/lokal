import { describe, expect, it } from "vitest";
import { computeDishStatus, type DishStatusInput } from "@/lib/training/status";

const d = (n: number) => new Date(2026, 0, n);
const base = (over: Partial<DishStatusInput> = {}): DishStatusInput => ({
  revisions: [{ version: 1, requiresRetraining: false }], studiedVersions: [], quiz: { allowRetries: true }, attempts: [], ...over,
});
const att = (score: number, passed: boolean, dishVersion = 1, day = 1) => ({ score, passed, dishVersion, submittedAt: d(day) });

describe("computeDishStatus", () => {
  it("not studied → quiz locked, cannot start", () => {
    expect(computeDishStatus(base())).toMatchObject({ studyState: "NOT_STUDIED", quizState: "LOCKED", canStartQuiz: false, complete: false });
  });
  it("studied → quiz available", () => {
    expect(computeDishStatus(base({ studiedVersions: [1] }))).toMatchObject({ studyState: "STUDIED", quizState: "AVAILABLE", canStartQuiz: true, complete: false });
  });
  it("studied dish without a published quiz is complete", () => {
    expect(computeDishStatus(base({ studiedVersions: [1], quiz: null }))).toMatchObject({ quizState: "NONE", complete: true });
  });
  it("passed → complete; failed → retry allowed or not by the quiz setting", () => {
    expect(computeDishStatus(base({ studiedVersions: [1], attempts: [att(90, true)] }))).toMatchObject({ quizState: "PASSED", complete: true, bestScore: 90 });
    const failed = base({ studiedVersions: [1], attempts: [att(40, false)] });
    expect(computeDishStatus(failed)).toMatchObject({ quizState: "FAILED", canStartQuiz: true, lastScore: 40 });
    expect(computeDishStatus({ ...failed, quiz: { allowRetries: false } })).toMatchObject({ quizState: "FAILED", canStartQuiz: false });
  });
  it("a later pass supersedes an earlier fail; best vs last score are tracked", () => {
    const s = computeDishStatus(base({ studiedVersions: [1], attempts: [att(40, false, 1, 1), att(85, true, 1, 2), att(60, false, 1, 3)] }));
    expect(s).toMatchObject({ quizState: "PASSED", bestScore: 85, lastScore: 60, attemptsCount: 3 });
  });
  it("a non-mandatory update leaves study valid but flags it as updated", () => {
    const s = computeDishStatus(base({ revisions: [{ version: 1, requiresRetraining: false }, { version: 2, requiresRetraining: false }], studiedVersions: [1], attempts: [att(90, true)] }));
    expect(s).toMatchObject({ studyState: "STUDIED", quizState: "PASSED", updatedSinceStudied: true, complete: true });
  });
  it("a retraining update invalidates old study and old results until re-studied and re-passed", () => {
    const revisions = [{ version: 1, requiresRetraining: false }, { version: 2, requiresRetraining: true }];
    const before = computeDishStatus({ ...base({ revisions }), studiedVersions: [1], attempts: [att(95, true, 1)] });
    expect(before).toMatchObject({ studyState: "NEEDS_REVIEW", quizState: "LOCKED", complete: false, canStartQuiz: false, attemptsCount: 0, requiredVersion: 2 });
    const studied = computeDishStatus({ ...base({ revisions }), studiedVersions: [1, 2], attempts: [att(95, true, 1)] });
    expect(studied).toMatchObject({ studyState: "STUDIED", quizState: "AVAILABLE", complete: false }); // old pass doesn't count
    const passed = computeDishStatus({ ...base({ revisions }), studiedVersions: [1, 2], attempts: [att(95, true, 1), att(90, true, 2, 5)] });
    expect(passed).toMatchObject({ quizState: "PASSED", complete: true });
  });
  it("retries-off applies per training cycle: a new retraining cycle grants a fresh attempt", () => {
    const revisions = [{ version: 1, requiresRetraining: false }, { version: 2, requiresRetraining: true }];
    const s = computeDishStatus({ revisions, studiedVersions: [1, 2], quiz: { allowRetries: false }, attempts: [att(50, false, 1)] });
    expect(s.canStartQuiz).toBe(true);
  });
});
