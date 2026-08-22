import { withApiHandler, ok } from "@/lib/api/handler";
import { requireOwnerOrHr } from "@/lib/auth/guards";
import { getEmployeeTimeline } from "@/lib/services/activity.service";

export const GET = withApiHandler(async (_req, ctx) => {
  const { id } = await ctx.params;
  await requireOwnerOrHr(id);
  const events = await getEmployeeTimeline(id);
  return ok({ events });
});
