import { withApiHandler, ok } from "@/lib/api/handler";
import { requireSession } from "@/lib/auth/guards";
import { markAllRead } from "@/lib/services/notification.service";

export const POST = withApiHandler(async () => {
  const session = await requireSession();
  await markAllRead(session.employeeId);
  return ok({ success: true });
});
