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

// ───────── Reading (always scoped to the signed-in user) ─────────

export async function listNotifications(userId: string, limit = 50) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
}

export function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, isRead: false } });
}

/** `userId` in the WHERE clause means nobody can mark (or probe) someone else's notifications. */
export async function markRead(userId: string, id: string) {
  await db.notification.updateMany({ where: { id, userId, isRead: false }, data: { isRead: true } });
}

export async function markAllRead(userId: string) {
  await db.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}
