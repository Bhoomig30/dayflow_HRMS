import { withApiHandler, ok } from "@/lib/api/handler";
import { requireSession } from "@/lib/auth/guards";
import { getLeaveBalanceSummary } from "@/lib/services/leave.service";

export const GET = withApiHandler(async () => {
  const session = await requireSession();
  const balances = await getLeaveBalanceSummary(session.employeeId);
  return ok({ balances });
});
