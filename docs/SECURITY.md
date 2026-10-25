# Security model

Scope: one restaurant per deployment, two roles (`ADMIN`, `EMPLOYEE`). This document says what is enforced, where,
and which automated test covers it. If a control has no test listed, treat it as lower assurance.

## Principles

1. **The server decides.** Hiding a button is never a control. Every page, server action and route handler re-checks
   identity and role against PostgreSQL (`src/lib/authz.ts`). The proxy (`src/proxy.ts`) is only a fast redirect.
2. **The database is the authority on the session.** The JWT only names the user. On every request the account must
   still exist, be `ACTIVE`, and carry the same `sessionVersion`. Deactivating a user or changing a password invalidates all
   of that user's sessions immediately. A forged role claim is ignored.
3. **Safety-critical content is never generated.** Allergen and dietary data is typed in by a manager, who must
   attest to it before a dish can be published; any safety-relevant edit to a live dish requires a fresh attestation.

## Controls

| Area | Control | Where | Tests |
|---|---|---|---|
| Passwords | bcrypt cost 12; min 10 chars, letter + number; max 72 bytes (bcrypt truncation is rejected, not silently accepted) | `lib/password.ts` | `auth.test.ts` |
| Login | Generic error for wrong email/password; dummy hash keeps timing similar for unknown emails; only `ACTIVE` accounts | `lib/credentials.ts` | `auth.test.ts` |
| Brute force | DB-backed atomic counters: 8 failures / account and 30 / IP per 15 min; works across serverless instances | `lib/rate-limit.ts` | `rate-limit.test.ts` (incl. concurrency) |
| Invites / resets | 256-bit random token, only SHA-256 stored, single use (atomic claim), expiry 7 d / 24 h, new token revokes older ones, deactivation revokes | `lib/tokens.ts`, `lib/account.ts` | `auth.test.ts` (incl. concurrent use) |
| Sessions | Auth.js JWT, 14 days, `sessionVersion` revocation, secure cookies on HTTPS | `auth.config.ts`, `authz.ts` | `authz.test.ts` |
| Authorization | `assertAdmin` / `assertEmployee` first line of every server action; admin accounts cannot be edited through employee screens | `app/**/actions.ts` | `actions-authz.test.ts` sweeps **every** action as anonymous, employee and forged-admin and asserts no writes |
| Export | CSV route authorises explicitly (route handlers have no layout guard); formula-injection neutralised | `app/admin/results/export` | `export-notifications.test.ts` |
| Quiz integrity | Correct answers are never sent before submission; the server fixes which questions/options were issued, rejects answers outside that set, grades against the immutable revision snapshot, and records one result per attempt even under double-submit | `lib/quiz/grading.ts`, `lib/services/attempts.ts` | `grading.test.ts`, `quiz-flow.test.ts` |
| Data isolation | Employees see only `PUBLISHED` dishes; attempts and notifications are always queried with the caller's id | `services/training.ts`, `attempts.ts`, `notifications.ts` | `quiz-flow.test.ts`, `reports.test.ts` |
| Input validation | Zod on every action input; image URLs restricted to this project's Blob host | `lib/validation/*` | `dishes.test.ts`, `uploads-settings.test.ts` |
| Uploads | Type decided by file content (magic bytes), not name or MIME; JPEG/PNG/WebP only (no SVG); 4 MB cap; random object names; admin-only; rate-limited | `lib/uploads.ts` | `uploads-settings.test.ts` |
| Open redirect | `callbackUrl` must be a same-site relative path | `app/(auth)/actions.ts` | browser run |
| Injection | Prisma parameterises all queries; the only raw SQL (rate limiter) uses bound parameters | `lib/rate-limit.ts` | `rate-limit.test.ts` |
| Browser hardening | CSP (self + project Blob for images, no framing, no plugins, `form-action 'self'`), HSTS, `nosniff`, `X-Frame-Options: DENY`, restrictive Permissions-Policy, `noindex` | `next.config.ts` | audit crawl (no CSP violations) |
| Configuration | Startup validation of `DATABASE_URL`, `AUTH_SECRET` (≥32 chars); production refuses to start on bad critical config | `lib/env.ts`, `instrumentation.ts` | `hardening.test.ts` |
| Secrets | Only environment variables; `.env*` git-ignored; `.env.example` has no values | `.gitignore` | CI secret-free |
| First-run setup | `/setup` exists only when `SETUP_TOKEN` (24+ chars) is configured and no manager exists; constant-time token check, per-IP rate limit, advisory lock so concurrent submissions create exactly one manager | `lib/setup.ts`, `app/(auth)/setup` | `first-run-setup.test.ts` |
| Maintenance endpoint | Closed unless `CRON_SECRET` is set; constant-time bearer comparison | `api/cron/cleanup` | `hardening.test.ts` |
| Dependencies | `npm audit` clean (nested `zod` pinned through `overrides`); CI fails on high severity | `package.json`, `.github/workflows/ci.yml` | CI |
| Data integrity | FK constraints, uniqueness, check constraints (settings singleton, score ranges, attempt consistency), transactions for multi-step writes | `prisma/migrations` | all DB tests |

## Known limitations (deliberate or accepted for v1)

- **No MFA and no email.** Invite/reset links are handed over by the manager (WhatsApp/SMS). Treat them like a password until used; they are single-use and expire. Manager password recovery needs operator database access (`npm run admin:reset-password`).
- **CSP allows inline scripts/styles** (`'unsafe-inline'`), because Next.js bootstrap and the UI library need them. A nonce-based CSP would be stricter but forces dynamic rendering everywhere.
- **IP-based rate limiting trusts `x-forwarded-for`**, which is correct on Vercel and wrong behind an untrusted proxy. The per-account limit does not depend on it.
- **No audit log** of administrative actions. Dish revisions record who published each version; other admin actions are not individually logged.
- **Account lockout is temporary throttling**, so an attacker who knows an employee's email can slow that employee's logins for up to 15 minutes. This is the usual trade-off against password guessing.
- **Images are public by URL** (unguessable, but not access-controlled). They contain only menu photos and the logo.
- **A rogue manager is out of scope**: managers can see all training data by design.

## Reporting a vulnerability

Tell the maintainer privately; do not open a public issue with exploit details.
