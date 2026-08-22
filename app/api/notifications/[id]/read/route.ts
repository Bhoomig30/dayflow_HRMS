import { withApiHandler, ok } from "@/lib/api/handler";
import { requireSession } from "@/lib/auth/guards";
import { markRead } from "@/lib/services/notification.service";

export const POST = withApiHandler(async (_req, ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await markRead(session.employeeId, id);
  return ok({ success: true });
});
