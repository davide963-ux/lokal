import Link from "next/link";
import { CheckCircle2, ChefHat, ShieldAlert, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/authz";
import { db } from "@/lib/db";

export const metadata = { title: "Dashboard" };
const STATUS_BADGE = { DRAFT: "warning", PUBLISHED: "success", ARCHIVED: "neutral" } as const;

function Stat({ label, value, hint, icon: Icon, href }: { label: string; value: number; hint?: string; icon: typeof Users; href: string }) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardContent className="flex items-start justify-between gap-3 p-5">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><Icon className="size-5" /></div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function AdminDashboard() {
  const user = await requireAdminPage();
  const [published, drafts, activeEmployees, invited, unverified, recentDishes] = await Promise.all([
    db.dish.count({ where: { status: "PUBLISHED" } }),
    db.dish.count({ where: { status: "DRAFT" } }),
    db.user.count({ where: { role: "EMPLOYEE", status: "ACTIVE" } }),
    db.user.count({ where: { role: "EMPLOYEE", status: "INVITED" } }),
    db.dish.count({ where: { status: { not: "ARCHIVED" }, allergensVerifiedAt: null } }),
    db.dish.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { updatedAt: "desc" }, take: 6, include: { category: { select: { name: true } } } }),
  ]);
  const empty = published + drafts === 0 && activeEmployees + invited === 0;

  return (
    <>
      <PageHeader title={`Good to see you, ${user.name.split(" ")[0]}`} description="Here's where your team's training stands." />
      {empty && (
        <Card className="mb-6 border-primary/30 bg-primary-soft/40">
          <CardContent className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-display text-lg font-semibold">Let&apos;s get started</p>
              <p className="text-sm text-muted-foreground">Add your restaurant details, create a category and your first dish, then invite your team.</p>
            </div>
            <div className="flex flex-wrap gap-2"><Button asChild variant="secondary"><Link href="/admin/settings">Settings</Link></Button><Button asChild><Link href="/admin/menu/categories">Create a category</Link></Button></div>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Published dishes" value={published} hint={drafts ? `${drafts} draft${drafts === 1 ? "" : "s"}` : undefined} icon={ChefHat} href="/admin/menu?status=PUBLISHED" />
        <Stat label="Active employees" value={activeEmployees} hint={invited ? `${invited} awaiting setup` : undefined} icon={Users} href="/admin/employees?status=ACTIVE" />
        <Stat label="Pending invitations" value={invited} icon={UserPlus} href="/admin/employees?status=INVITED" />
        <Stat label="Dishes needing allergen check" value={unverified} hint={unverified ? "Verify before publishing" : "All verified"} icon={unverified ? ShieldAlert : CheckCircle2} href="/admin/menu" />
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Recently updated dishes</CardTitle></CardHeader>
        <CardContent>
          {recentDishes.length === 0 ? <p className="text-sm text-muted-foreground">Nothing here yet. Your latest dish changes will show up here.</p> : (
            <ul className="divide-y divide-border">
              {recentDishes.map((d) => (
                <li key={d.id}>
                  <Link href={`/admin/menu/${d.id}`} className="flex items-center gap-3 py-3 transition-colors hover:text-primary">
                    <div className="min-w-0 flex-1"><p className="truncate font-medium">{d.name}</p><p className="text-xs text-muted-foreground">{d.category.name} · {d.updatedAt.toLocaleDateString()}</p></div>
                    <Badge variant={STATUS_BADGE[d.status]}>{d.status.toLowerCase()}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
