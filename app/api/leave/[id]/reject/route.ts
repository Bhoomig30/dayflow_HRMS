import { NextRequest } from "next/server";
import { withApiHandler, ok } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { rejectLeaveRequest, reviewLeaveSchema } from "@/lib/services/leave.service";

export const POST = withApiHandler(async (req: NextRequest, ctx) => {
  const session = await requireRole("HR");
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { comment } = reviewLeaveSchema.parse(body);
  const result = await rejectLeaveRequest(session.employeeId, id, comment);
  return ok(result);
});
