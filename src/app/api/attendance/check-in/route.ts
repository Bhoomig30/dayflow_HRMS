import { withApiHandler, ok } from "@/lib/api/handler";
import { requireSession } from "@/lib/auth/guards";
import { checkIn } from "@/lib/services/attendance.service";

export const POST = withApiHandler(async () => {
  const session = await requireSession();
  const record = await checkIn(session.employeeId);
  return ok({ attendance: record });
});
