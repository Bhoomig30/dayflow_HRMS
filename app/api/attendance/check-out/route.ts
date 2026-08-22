import { withApiHandler, ok } from "@/lib/api/handler";
import { requireSession } from "@/lib/auth/guards";
import { checkOut } from "@/lib/services/attendance.service";

export const POST = withApiHandler(async () => {
  const session = await requireSession();
  const record = await checkOut(session.employeeId);
  return ok({ attendance: record });
});
