import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { requireAdminPage } from "@/lib/authz";
import { db } from "@/lib/db";
import { EmployeeEditor } from "./employee-editor";

export const metadata = { title: "Employee" };
const VARIANT = { ACTIVE: "success", INVITED: "warning", INACTIVE: "neutral" } as const;

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await db.user.findUnique({ where: { id } });
  if (!user || user.role !== "EMPLOYEE") notFound();
  return (
    <>
      <Link href="/admin/employees" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Employees</Link>
      <PageHeader title={user.name} description={`Added ${user.createdAt.toLocaleDateString()}${user.lastLoginAt ? ` · last signed in ${user.lastLoginAt.toLocaleString()}` : " · has not signed in yet"}`}
        actions={<Badge variant={VARIANT[user.status]}>{user.status === "INACTIVE" ? "deactivated" : user.status.toLowerCase()}</Badge>} />
      <EmployeeEditor id={user.id} status={user.status} initial={{ name: user.name, email: user.email, jobTitle: user.jobTitle ?? "", phone: user.phone ?? "" }} />
    </>
  );
}
