import { NextRequest } from "next/server";
import { withApiHandler, ok } from "@/lib/api/handler";
import { requireSession } from "@/lib/auth/guards";
import { getAttendanceHistory, getAttendanceSummary, getAttendanceForDate } from "@/lib/services/attendance.service";
import { todayISO } from "@/lib/utils/date";

function defaultRange(req: NextRequest) {
  const url = req.nextUrl;
  const end = url.searchParams.get("end") || todayISO();
  let start = url.searchParams.get("start");
  if (!start) {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    start = d.toISOString().slice(0, 10);
  }
  return { start, end };
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requireSession();
  const { start, end } = defaultRange(req);
  const [history, summary, today] = await Promise.all([
    getAttendanceHistory(session.employeeId, start, end),
    getAttendanceSummary(session.employeeId, start, end),
    getAttendanceForDate(session.employeeId, todayISO()),
  ]);
  return ok({ history, summary, today });
});
