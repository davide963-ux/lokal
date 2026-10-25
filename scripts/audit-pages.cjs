/**
 * Visual/accessibility audit. Run against a running production build with seeded data:
 *   AUDIT_BASE=http://localhost:3000 AUDIT_ADMIN="email:password" AUDIT_EMPLOYEE="email:password" node scripts/audit-pages.cjs
 * Needs Playwright (`npm i -D playwright` or a global install). Fails on, per page and viewport:
 *   - horizontal overflow, - console errors / CSP violations / uncaught exceptions, - axe-core WCAG A/AA violations.
 */
const { chromium } = require("playwright");
const axeSource = require("fs").readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const BASE = process.env.AUDIT_BASE || "http://localhost:3000";
const [ADMIN_EMAIL, ADMIN_PW] = (process.env.AUDIT_ADMIN || "giulia@example.com:Manager-pass-2026").split(":");
const [EMP_EMAIL, EMP_PW] = (process.env.AUDIT_EMPLOYEE || "john@example.com:Staff-secure-99").split(":");
const VIEWPORTS = [{ w: 320, h: 640 }, { w: 390, h: 844 }, { w: 768, h: 1024 }, { w: 1280, h: 800 }];
const problems = [];
const seen = new Set();

async function login(browser, email, pw, dest) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(BASE + "/login");
  await p.fill("#email", email); await p.fill("#password", pw);
  await p.click("button[type=submit]"); await p.waitForURL(dest);
  return { ctx, p };
}

async function audit(ctx, label, path, vp) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: vp.w, height: vp.h });
  const logs = [];
  page.on("pageerror", (e) => logs.push(`exception: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") logs.push(`console: ${m.text().slice(0, 200)}`); });
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  const where = `${label} ${path} @${vp.w}`;
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) problems.push(`${where}: horizontal overflow by ${overflow}px`);
  for (const l of logs) problems.push(`${where}: ${l}`);
  if (vp.w === 390 || vp.w === 1280) { // axe is slow; two viewports are enough for contrast + structure
    await page.evaluate(axeSource);
    const res = await page.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
    for (const v of res.violations) {
      const key = `${label} ${path}|${v.id}`;
      if (seen.has(key)) continue; seen.add(key);
      problems.push(`${where}: a11y [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0].target.join(" ")}`);
    }
  }
  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  const anon = await browser.newContext();
  const admin = await login(browser, ADMIN_EMAIL, ADMIN_PW, "**/admin");
  const emp = await login(browser, EMP_EMAIL, EMP_PW, "**/employee");

  const hrefs = async (p, path, sel) => { await p.goto(BASE + path, { waitUntil: "networkidle" }); return p.$$eval(sel, (as) => [...new Set(as.map((a) => a.getAttribute("href")))]); };
  const dishHref = (await hrefs(admin.p, "/admin/menu", "main a[href^='/admin/menu/']")).find((h) => /[0-9a-f-]{36}$/.test(h));
  const quizHref = dishHref && dishHref.replace("/menu/", "/quizzes/");
  const empHref = (await hrefs(admin.p, "/admin/employees", "main a[href^='/admin/employees/']")).find((h) => /[0-9a-f-]{36}$/.test(h));
  const eDish = (await hrefs(emp.p, "/employee/menu", "main a[href^='/employee/menu/']")).find((h) => /[0-9a-f-]{36}$/.test(h));
  const eResult = (await hrefs(emp.p, "/employee/results", "main a[href^='/employee/results/']")).find((h) => /[0-9a-f-]{36}$/.test(h));

  const adminPaths = ["/admin", "/admin/menu", "/admin/menu/new", "/admin/menu/categories", dishHref, "/admin/ingredients", "/admin/ingredients?tab=allergens", "/admin/quizzes", quizHref,
    "/admin/employees", empHref, "/admin/results", "/admin/results?tab=attempts", "/admin/settings", "/admin/notifications", "/admin/account"].filter(Boolean);
  const empPaths = ["/employee", "/employee/menu", eDish, eResult, "/employee/results", "/employee/notifications", "/employee/account"].filter(Boolean);
  const anonPaths = ["/login", "/set-password/not-a-real-token", "/this-page-does-not-exist"];

  for (const vp of VIEWPORTS) {
    for (const p of anonPaths) await audit(anon, "anon", p, vp);
    for (const p of adminPaths) await audit(admin.ctx, "admin", p, vp);
    for (const p of empPaths) await audit(emp.ctx, "employee", p, vp);
  }
  await browser.close();
  console.log(`Audited ${VIEWPORTS.length} viewports × ${anonPaths.length + adminPaths.length + empPaths.length} pages.`);
  if (problems.length) { console.log(`\n${problems.length} problem(s):`); for (const p of problems) console.log(" - " + p); process.exit(1); }
  console.log("No overflow, console errors or accessibility violations.");
})().catch((e) => { console.error(e); process.exit(2); });
