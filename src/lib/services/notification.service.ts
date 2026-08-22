import { db } from "@/lib/db/client";
import { notifications, type NotificationType } from "@/lib/db/schema";
import { newId } from "@/lib/utils/id";
import { and, desc, eq } from "drizzle-orm";

interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
}

export async function createNotification(input: CreateNotificationInput) {
  const id = newId("ntf");
  await db.insert(notifications).values({
    id,
    recipientId: input.recipientId,
    type: input.type,
    title: input.title,
    message: input.message,
  });
  return id;
}

export async function listNotifications(recipientId: string, limit = 50) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, recipientId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadCount(recipientId: string): Promise<number> {
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.recipientId, recipientId), eq(notifications.isRead, false)));
  return rows.length;
}

export async function markRead(recipientId: string, notificationId: string) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.recipientId, recipientId)));
}

export async function markAllRead(recipientId: string) {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.recipientId, recipientId));
}
