import { NextRequest } from "next/server";
import { withApiHandler, ok } from "@/lib/api/handler";
import { requireOwnerOrHr } from "@/lib/auth/guards";
import { getAttendanceHistory, getAttendanceSummary } from "@/lib/services/attendance.service";
import { todayISO } from "@/lib/utils/date";

/**
 * IDOR-sensitive endpoint: an Employee session may only fetch their own
 * employeeId; requireOwnerOrHr enforces that server-side regardless of what
 * the client puts in the URL.
 */
export const GET = withApiHandler(async (req: NextRequest, ctx) => {
  const { employeeId } = await ctx.params;
  await requireOwnerOrHr(employeeId);

  const url = req.nextUrl;
  const end = url.searchParams.get("end") || todayISO();
  let start = url.searchParams.get("start");
  if (!start) {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    start = d.toISOString().slice(0, 10);
  }

  const [history, summary] = await Promise.all([
    getAttendanceHistory(employeeId, start, end),
    getAttendanceSummary(employeeId, start, end),
  ]);
  return ok({ history, summary });
});
