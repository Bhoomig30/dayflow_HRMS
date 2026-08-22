import { withApiHandler, ok } from "@/lib/api/handler";
import { requireSession } from "@/lib/auth/guards";
import { listNotifications, unreadCount } from "@/lib/services/notification.service";

export const GET = withApiHandler(async () => {
  const session = await requireSession();
  const [items, unread] = await Promise.all([listNotifications(session.employeeId), unreadCount(session.employeeId)]);
  return ok({ notifications: items, unreadCount: unread });
});
