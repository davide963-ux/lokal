import { db, type Tx } from "@/lib/db";
import type { NotificationType } from "@/generated/prisma/enums";

type Client = Tx | typeof db;
type Payload = { type: NotificationType; title: string; message: string; link?: string };

/** Fan-out to specific users. */
export async function notifyUsers(userIds: string[], p: Payload, client: Client = db) {
  if (userIds.length === 0) return 0;
  const res = await client.notification.createMany({
    data: userIds.map((userId) => ({ userId, ...p })),
  });
  return res.count;
}

export async function notifyAllEmployees(p: Payload, client: Client = db) {
  const users = await client.user.findMany({ where: { role: "EMPLOYEE", status: "ACTIVE" }, select: { id: true } });
  return notifyUsers(users.map((u) => u.id), p, client);
}

export async function notifyAdmins(p: Payload, client: Client = db) {
  const users = await client.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  return notifyUsers(users.map((u) => u.id), p, client);
}
