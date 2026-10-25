import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { makeCategory, makePublishedDish, makeUser, resetDb, takeQuiz } from "./helpers";

let mockSession: { user: { id: string; role: string; sessionVersion: number } } | null = null;
vi.mock("@/auth", () => ({ auth: async () => mockSession, signOut: vi.fn(), signIn: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { GET } from "@/app/admin/results/export/route";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/notification-actions";
import { notifyUsers } from "@/lib/services/notifications";

const asUser = (u: { id: string; role: string; sessionVersion: number }) => (mockSession = { user: u });
const get = (qs = "") => GET(new Request(`http://localhost/admin/results/export?${qs}`));

let admin: Awaited<ReturnType<typeof makeUser>>;

beforeEach(async () => {
  await resetDb();
  mockSession = null;
  admin = await makeUser({ role: "ADMIN" });
});

describe("CSV export endpoint", () => {
  it("refuses anonymous callers and employees with 403 and no data", async () => {
    expect((await get("type=team")).status).toBe(403);
    const emp = await makeUser({ name: "Secret Employee" });
    asUser({ id: emp.id, role: "EMPLOYEE", sessionVersion: emp.sessionVersion });
    for (const qs of ["type=team", "type=attempts"]) {
      const res = await get(qs);
      expect(res.status).toBe(403);
      expect(await res.text()).not.toContain("Secret Employee");
    }
  });
  it("a forged ADMIN role claim does not unlock the export", async () => {
    const emp = await makeUser();
    asUser({ id: emp.id, role: "ADMIN", sessionVersion: emp.sessionVersion });
    expect((await get("type=team")).status).toBe(403);
  });
  it("admins get an attachment with real data; formulas in names are neutralised; filters apply", async () => {
    const cat = await makeCategory();
    const { dishId } = await makePublishedDish(admin.id, cat.id, "Carbonara");
    const evil = await makeUser({ name: '=HYPERLINK("http://evil.example","x")', email: "evil@x.com" });
    const ok = await makeUser({ name: "Maria", email: "maria@x.com" });
    await takeQuiz(ok.id, dishId);
    await takeQuiz(evil.id, dishId, [0, 1]);
    asUser({ id: admin.id, role: "ADMIN", sessionVersion: admin.sessionVersion });

    const team = await get("type=team");
    expect(team.status).toBe(200);
    expect(team.headers.get("content-type")).toContain("text/csv");
    expect(team.headers.get("content-disposition")).toMatch(/attachment; filename="training-team-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(team.headers.get("cache-control")).toBe("no-store");
    const raw = new Uint8Array(await team.clone().arrayBuffer());
    expect([...raw.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM so Excel reads accents
    const text = await team.text(); // decoding strips the BOM
    expect(text.startsWith("Employee,Email")).toBe(true);
    expect(text).toContain("Maria,maria@x.com");
    expect(text).not.toMatch(/(^|,|\n)=HYPERLINK/); // never a raw leading '='
    expect(text).toContain("'=HYPERLINK");

    const filtered = await (await get("type=team&q=maria")).text();
    expect(filtered).toContain("Maria");
    expect(filtered).not.toContain("HYPERLINK");

    const attempts = await (await get("type=attempts&result=failed")).text();
    expect(attempts.split("\r\n").filter(Boolean)).toHaveLength(2); // header + the one failed attempt
    expect(attempts).toContain("failed");
    expect(attempts).not.toContain("Maria");
  });
  it("junk filter values are ignored, not trusted", async () => {
    asUser({ id: admin.id, role: "ADMIN", sessionVersion: admin.sessionVersion });
    expect((await get("type=attempts&employee=' OR 1=1--&from=garbage&dish=zzz")).status).toBe(200);
  });
});

describe("notification actions", () => {
  it("require sign-in", async () => {
    expect(await markAllNotificationsReadAction()).toMatchObject({ ok: false, error: "Please sign in again." });
    expect(await markNotificationReadAction("00000000-0000-4000-8000-000000000000")).toMatchObject({ ok: false });
  });
  it("only touch the caller's own notifications", async () => {
    const a = await makeUser(), b = await makeUser();
    await notifyUsers([a.id, b.id], { type: "DISH_UPDATED", title: "t", message: "m" });
    const bNote = await db.notification.findFirstOrThrow({ where: { userId: b.id } });
    asUser({ id: a.id, role: "EMPLOYEE", sessionVersion: a.sessionVersion });
    await markNotificationReadAction(bNote.id); // another user's id
    expect((await db.notification.findUniqueOrThrow({ where: { id: bNote.id } })).isRead).toBe(false);
    await markAllNotificationsReadAction();
    expect(await db.notification.count({ where: { userId: a.id, isRead: false } })).toBe(0);
    expect(await db.notification.count({ where: { userId: b.id, isRead: false } })).toBe(1);
  });
});
