"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/authz";
import { runAction, type ActionResult } from "@/lib/action";
import {
  createEmployee, deactivateEmployee, issueAccessLink, reactivateEmployee, updateEmployee, type EmployeeInput,
} from "@/lib/services/employees";
import { absoluteUrl } from "@/lib/server/origin";
import { uuid } from "@/lib/validation/common";

export type AccessLink = { url: string; expiresAt: string; purpose: "INVITE" | "PASSWORD_RESET"; name: string };

const refresh = (id?: string) => {
  revalidatePath("/admin/employees");
  revalidatePath("/admin");
  if (id) revalidatePath(`/admin/employees/${id}`);
};

export async function createEmployeeAction(input: EmployeeInput): Promise<ActionResult<{ id: string; link: AccessLink }>> {
  return runAction(async () => {
    await assertAdmin();
    const { user, token, expiresAt } = await createEmployee(input);
    refresh();
    return {
      ok: true,
      message: "Employee added",
      data: { id: user.id, link: { url: await absoluteUrl(`/set-password/${token}`), expiresAt: expiresAt.toISOString(), purpose: "INVITE", name: user.name } },
    };
  });
}

export async function updateEmployeeAction(id: string, input: EmployeeInput): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await updateEmployee(uuid.parse(id), input);
    refresh(id);
    return { ok: true, message: "Employee updated" };
  });
}

export async function deactivateEmployeeAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await deactivateEmployee(uuid.parse(id));
    refresh(id);
    return { ok: true, message: "Employee deactivated and signed out" };
  });
}

export async function reactivateEmployeeAction(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await assertAdmin();
    await reactivateEmployee(uuid.parse(id));
    refresh(id);
    return { ok: true, message: "Employee reactivated" };
  });
}

export async function issueAccessLinkAction(id: string): Promise<ActionResult<{ link: AccessLink }>> {
  return runAction(async () => {
    await assertAdmin();
    const { token, expiresAt, purpose, user } = await issueAccessLink(uuid.parse(id));
    refresh(id);
    return {
      ok: true,
      data: { link: { url: await absoluteUrl(`/set-password/${token}`), expiresAt: expiresAt.toISOString(), purpose, name: user.name } },
    };
  });
}
