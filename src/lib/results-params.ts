import { STATUS_FILTERS, parseDay, type AttemptFilters, type StatusFilter, type TeamFilters } from "@/lib/services/reports";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const uuidOrUndef = (v: string | undefined) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);

/** Query-string → typed filters. Anything malformed is ignored rather than trusted. */
export function parseTeamParams(sp: SP): TeamFilters & { raw: Record<string, string> } {
  const status = STATUS_FILTERS.find((s) => s.id === one(sp.status))?.id as StatusFilter | undefined;
  const f = { q: one(sp.q)?.slice(0, 80), categoryId: uuidOrUndef(one(sp.category)), dishId: uuidOrUndef(one(sp.dish)), status, includeInactive: one(sp.inactive) === "1" };
  return { ...f, raw: compact({ q: f.q, category: f.categoryId, dish: f.dishId, status, inactive: f.includeInactive ? "1" : undefined }) };
}

export function parseAttemptParams(sp: SP): AttemptFilters & { raw: Record<string, string> } {
  const from = one(sp.from), to = one(sp.to);
  const result = one(sp.result) === "passed" ? "passed" : one(sp.result) === "failed" ? "failed" : undefined;
  const f: AttemptFilters = { userId: uuidOrUndef(one(sp.employee)), dishId: uuidOrUndef(one(sp.dish)), categoryId: uuidOrUndef(one(sp.category)), from: parseDay(from), to: parseDay(to), result };
  return { ...f, raw: compact({ employee: f.userId, dish: f.dishId, category: f.categoryId, from: f.from && from, to: f.to && to, result }) };
}

function compact(o: Record<string, string | undefined | false | Date>): Record<string, string> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string" && v)) as Record<string, string>;
}
export const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();
