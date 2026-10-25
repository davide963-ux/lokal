import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { resetDb } from "./helpers";

beforeEach(resetDb);

describe("rateLimit", () => {
  it("allows up to the limit then blocks with a retry hint", async () => {
    for (let i = 0; i < 3; i++) expect((await rateLimit("k", 3, 60)).ok).toBe(true);
    const blocked = await rateLimit("k", 3, 60);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
  it("keys are independent", async () => {
    await rateLimit("a", 1, 60);
    expect((await rateLimit("a", 1, 60)).ok).toBe(false);
    expect((await rateLimit("b", 1, 60)).ok).toBe(true);
  });
  it("starts a fresh window after expiry", async () => {
    await rateLimit("w", 1, 60);
    expect((await rateLimit("w", 1, 60)).ok).toBe(false);
    await db.rateLimit.update({ where: { key: "w" }, data: { windowStart: new Date(Date.now() - 61_000) } });
    expect((await rateLimit("w", 1, 60)).ok).toBe(true);
  });
  it("is atomic under concurrency", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit("c", 5, 60)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });
});
