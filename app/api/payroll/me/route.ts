import { withApiHandler, ok } from "@/lib/api/handler";
import { requireSession } from "@/lib/auth/guards";
import { getPublishedPayrollHistory } from "@/lib/services/payroll.service";

/** Employee view: only ever sees PUBLISHED payroll records — drafts are HR-internal. */
export const GET = withApiHandler(async () => {
  const session = await requireSession();
  const records = await getPublishedPayrollHistory(session.employeeId);
  return ok({ records });
});
