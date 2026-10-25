import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { requireAdminPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { initials } from "@/lib/utils";
import type { UserStatus } from "@/generated/prisma/enums";
import { AddEmployee } from "./add-employee";

export const metadata = { title: "Employees" };
const STATUS_VARIANT = { ACTIVE: "success", INVITED: "warning", INACTIVE: "neutral" } as const;
const LABEL = { ACTIVE: "active", INVITED: "invited", INACTIVE: "deactivated" } as const;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdminPage();
  const { q, status } = await searchParams;
  const statusFilter = (["ACTIVE", "INVITED", "INACTIVE"] as const).find((s) => s === status) as UserStatus | undefined;
  const [employees, total] = await Promise.all([
    db.user.findMany({
      where: {
        role: "EMPLOYEE",
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    db.user.count({ where: { role: "EMPLOYEE" } }),
  ]);

  return (
    <>
      <PageHeader title="Employees" description="Add your team and send them a link to set their password." actions={<AddEmployee />} />
      <form action="/admin/employees" className="mb-5 grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
        <Input name="q" defaultValue={q} placeholder="Search by name or email…" aria-label="Search employees" />
        <Select name="status" defaultValue={statusFilter ?? ""} aria-label="Status">
          <option value="">All statuses</option><option value="ACTIVE">Active</option><option value="INVITED">Invited</option><option value="INACTIVE">Deactivated</option>
        </Select>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      {employees.length === 0 ? (
        <EmptyState icon={Users} title={total === 0 ? "No employees yet" : "No employees match"} description={total === 0 ? "Add your first waiter. They'll receive a link to choose a password." : "Try clearing the filters."} />
      ) : (
        <Card><ul className="divide-y divide-border">
          {employees.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/employees/${e.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{initials(e.name)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.jobTitle ? `${e.jobTitle} · ` : ""}{e.email}</p>
                </div>
                <div className="hidden text-right text-xs text-muted-foreground sm:block">{e.lastLoginAt ? `Last seen ${e.lastLoginAt.toLocaleDateString()}` : "Never signed in"}</div>
                <Badge variant={STATUS_VARIANT[e.status]}>{LABEL[e.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul></Card>
      )}
    </>
  );
}
