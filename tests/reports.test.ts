import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { csvCell, toCsv } from "@/lib/csv";
import { updateDish } from "@/lib/services/dishes";
import { listNotifications, markAllRead, markRead, notifyUsers, unreadCount } from "@/lib/services/notifications";
import { getAttemptsLog, getEmployeeReport, getTeamReport, matchesStatus, parseDay } from "@/lib/services/reports";
import { acknowledgeStudy } from "@/lib/services/training";
import { makeCategory, makePublishedDish, makeUser, resetDb, takeQuiz } from "./helpers";

let adminId: string, pastaId: string, dessertId: string;
let carbonara: string, penne: string, tiramisu: string;
let maria: string, john: string;

beforeEach(async () => {
  await resetDb();
  adminId = (await makeUser({ role: "ADMIN" })).id;
  pastaId = (await makeCategory("Pasta")).id;
  dessertId = (await makeCategory("Desserts")).id;
  carbonara = (await makePublishedDish(adminId, pastaId, "Carbonara")).dishId;
  penne = (await makePublishedDish(adminId, pastaId, "Penne")).dishId;
  tiramisu = (await makePublishedDish(adminId, dessertId, "Tiramisu")).dishId;
  maria = (await makeUser({ name: "Maria", email: "maria@x.com" })).id;
  john = (await makeUser({ name: "John", email: "john@x.com" })).id;
  await makeUser({ name: "Alex", email: "alex@x.com" });
  // Maria: everything passed. John: studied all, passed 1, failed 1. Alex: nothing.
  for (const d of [carbonara, penne, tiramisu]) await takeQuiz(maria, d);
  await takeQuiz(john, carbonara);
  await takeQuiz(john, penne, [0, 1]); // 0%
  await acknowledgeStudy(john, tiramisu);
});

describe("team report", () => {
  it("computes studied / passed / average / completion from real records", async () => {
    const { rows, totals } = await getTeamReport();
    const by = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(by.Maria).toMatchObject({ totalDishes: 3, studied: 3, passed: 3, failed: 0, averageScore: 100, completionPercent: 100, attention: false });
    expect(by.John).toMatchObject({ studied: 3, passed: 1, failed: 1, averageScore: 50, completionPercent: 33, attention: true });
    expect(by.Alex).toMatchObject({ studied: 0, passed: 0, averageScore: null, completionPercent: 0, lastActivity: null });
    expect(by.Maria!.lastActivity).not.toBeNull();
    // team figures: mean of the three scored pairs-with-scores (100,100,100,100,0) = 80; completion 4 of 9 dishes×people
    expect(totals).toMatchObject({ employees: 3, dishes: 3, averageScore: 80, completionPercent: 44, needingTraining: 2 });
  });
  it("excludes deactivated and pending employees by default, admins always", async () => {
    await makeUser({ name: "Gone", status: "INACTIVE" });
    await makeUser({ name: "Pending", status: "INVITED" });
    expect((await getTeamReport()).rows.map((r) => r.name).sort()).toEqual(["Alex", "John", "Maria"]);
    expect((await getTeamReport({ includeInactive: true })).rows.map((r) => r.name)).toContain("Gone");
    expect((await getTeamReport({ includeInactive: true })).rows.map((r) => r.name)).not.toContain("User 1");
  });
  it("filters by employee text, category, and a single dish (metrics are scoped to the filter)", async () => {
    expect((await getTeamReport({ q: "joh" })).rows.map((r) => r.name)).toEqual(["John"]);
    expect((await getTeamReport({ q: "MARIA@x" })).rows).toHaveLength(1);
    const desserts = await getTeamReport({ categoryId: dessertId });
    expect(desserts.totals.dishes).toBe(1);
    expect(desserts.rows.find((r) => r.name === "John")).toMatchObject({ totalDishes: 1, studied: 1, passed: 0, completionPercent: 0 }); // studied, quiz not taken
    const penneOnly = await getTeamReport({ dishId: penne });
    expect(penneOnly.rows.find((r) => r.name === "John")).toMatchObject({ failed: 1, averageScore: 0, attention: true });
    expect(penneOnly.rows.find((r) => r.name === "Maria")).toMatchObject({ completionPercent: 100 });
  });
  it("filters by training status", async () => {
    const names = async (status: Parameters<typeof matchesStatus>[1]) => (await getTeamReport({ status })).rows.map((r) => r.name);
    expect(await names("complete")).toEqual(["Maria"]);
    expect(await names("needs_attention")).toEqual(["John"]);
    expect(await names("not_started")).toEqual(["Alex"]);
    expect(await names("in_progress")).toEqual([]);
  });
  it("a retraining update moves employees to 'needs attention' and drops their completion", async () => {
    await updateDish(adminId, carbonara, { name: "Carbonara", categoryId: pastaId, garnishes: "Basil", allergensVerified: true, requiresRetraining: true });
    const { rows } = await getTeamReport();
    expect(rows.find((r) => r.name === "Maria")).toMatchObject({ needsReview: 1, studied: 2, passed: 2, completionPercent: 67, attention: true });
    expect((await getTeamReport({ status: "complete" })).rows).toHaveLength(0);
  });
  it("an empty team or an empty menu yields zeros, not NaN or errors", async () => {
    await resetDb();
    expect((await getTeamReport()).totals).toEqual({ employees: 0, dishes: 0, averageScore: null, completionPercent: 0, needingTraining: 0 });
    await makeUser();
    const r = await getTeamReport();
    expect(r.rows[0]).toMatchObject({ totalDishes: 0, completionPercent: 0, averageScore: null });
  });
});

describe("employee report", () => {
  it("lists dishes with status, dates, pending and failed items", async () => {
    const r = await getEmployeeReport(john);
    expect(r.summary).toMatchObject({ studied: 3, passed: 1, failed: 1, completionPercent: 33 });
    expect(r.failed.map((x) => x.name)).toEqual(["Penne"]);
    expect(r.pending.map((x) => x.name).sort()).toEqual(["Penne", "Tiramisu"]);
    const c = r.rows.find((x) => x.name === "Carbonara")!;
    expect(c.status.complete).toBe(true);
    expect(c.studiedAt).not.toBeNull();
    expect(c.completedAt).not.toBeNull();
    expect(r.rows.find((x) => x.name === "Tiramisu")!.completedAt).toBeNull();
    expect(r.attempts.map((a) => a.score).sort()).toEqual([0, 100]);
  });
  it("refuses admins and unknown ids", async () => {
    await expect(getEmployeeReport(adminId)).rejects.toThrow(/not found/);
    await expect(getEmployeeReport("00000000-0000-4000-8000-000000000000")).rejects.toThrow(/not found/);
  });
  it("after retraining, history is kept but the old pass no longer counts as complete", async () => {
    await updateDish(adminId, carbonara, { name: "Carbonara", categoryId: pastaId, garnishes: "Basil", allergensVerified: true, requiresRetraining: true });
    const r = await getEmployeeReport(maria);
    expect(r.needsReview.map((x) => x.name)).toEqual(["Carbonara"]);
    expect(r.attempts).toHaveLength(3); // old results still listed
    expect(r.rows.find((x) => x.name === "Carbonara")!.completedAt).toBeNull();
  });
});

describe("attempts log", () => {
  it("filters by employee, dish, category and result", async () => {
    expect(await getAttemptsLog()).toHaveLength(5);
    expect((await getAttemptsLog({ userId: john })).map((a) => a.user.name)).toEqual(["John", "John"]);
    expect(await getAttemptsLog({ dishId: penne })).toHaveLength(2);
    expect(await getAttemptsLog({ categoryId: dessertId })).toHaveLength(1);
    expect((await getAttemptsLog({ result: "failed" })).map((a) => a.score)).toEqual([0]);
    expect(await getAttemptsLog({ result: "passed" })).toHaveLength(4);
  });
  it("date filters are inclusive of the whole 'to' day", async () => {
    const day = new Date().toISOString().slice(0, 10);
    expect(await getAttemptsLog({ from: parseDay(day), to: parseDay(day) })).toHaveLength(5);
    const later = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    expect(await getAttemptsLog({ from: parseDay(later) })).toHaveLength(0);
    const earlier = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    expect(await getAttemptsLog({ to: parseDay(earlier) })).toHaveLength(0);
  });
  it("parseDay rejects junk", () => {
    expect(parseDay("2026-13-45")).toBeUndefined();
    expect(parseDay("yesterday")).toBeUndefined();
    expect(parseDay(undefined)).toBeUndefined();
    expect(parseDay("2026-02-03")?.toISOString()).toBe("2026-02-03T00:00:00.000Z");
  });
});

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('He said "hi", ok')).toBe('"He said ""hi"", ok"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(0)).toBe("0");
  });
  it("neutralises spreadsheet formulas typed into names", () => {
    for (const evil of ["=HYPERLINK(\"http://evil\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"]) expect(csvCell(evil).replace(/^"/, "").startsWith("'")).toBe(true);
    expect(csvCell("-")).toBe("'-");
    expect(csvCell("Anne-Marie")).toBe("Anne-Marie");
    expect(csvCell(-5)).toBe("'-5"); // acceptable: numbers in exports are never negative
  });
  it("builds a BOM-prefixed CRLF document", () => {
    const out = toCsv([{ n: "Zoë", s: 90 }], [{ header: "Name", value: (r) => r.n }, { header: "Score", value: (r) => r.s }]);
    expect(out).toBe("﻿Name,Score\r\nZoë,90\r\n");
  });
});

describe("notifications", () => {
  it("are listed newest first and scoped to their owner", async () => {
    const msg = (title: string) => ({ type: "DISH_UPDATED" as const, title, message: "m" });
    await notifyUsers([maria, john], msg("first"));
    await new Promise((r) => setTimeout(r, 15));
    await notifyUsers([maria], msg("second"));
    const mine = await listNotifications(maria);
    expect(mine.map((n) => n.title)).toEqual(["second", "first"]);
    expect(mine.every((n) => n.userId === maria)).toBe(true);
    expect(await unreadCount(maria)).toBeGreaterThan(0);
    const first = mine[0]!;
    await markRead(john, first.id); // someone else's: no effect
    expect((await db.notification.findUniqueOrThrow({ where: { id: first.id } })).isRead).toBe(false);
    await markRead(maria, first.id);
    expect((await db.notification.findUniqueOrThrow({ where: { id: first.id } })).isRead).toBe(true);
    await markAllRead(maria);
    expect(await unreadCount(maria)).toBe(0);
    expect(await unreadCount(john)).toBeGreaterThan(0); // untouched
  });
  it("managers are told about failures and completed training", async () => {
    const types = (await listNotifications(adminId)).map((n) => n.type);
    expect(types).toContain("QUIZ_FAILED");
    expect(types).toContain("TRAINING_COMPLETED"); // Maria finished everything
  });
});
