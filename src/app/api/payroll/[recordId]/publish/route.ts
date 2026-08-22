import { withApiHandler, ok } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { publishPayrollRecord } from "@/lib/services/payroll.service";

export const POST = withApiHandler(async (_req, ctx) => {
  const session = await requireRole("HR");
  const { recordId } = await ctx.params;
  const record = await publishPayrollRecord(session.employeeId, recordId);
  return ok({ record });
});
