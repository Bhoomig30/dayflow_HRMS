import { NextRequest } from "next/server";
import { withApiHandler, ok } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import {
  getAttendanceTrend,
  getDepartmentDistribution,
  getHrOverview,
  getLateArrivalTrend,
  getLeaveTypeUtilization,
  getSalaryOverview,
} from "@/lib/services/analytics.service";
import { currentYear } from "@/lib/utils/date";

/** HR-only analytics bundle — every figure is a live aggregate over stored records, computed on each request. */
export const GET = withApiHandler(async (req: NextRequest) => {
  await requireRole("HR");
  const year = Number(req.nextUrl.searchParams.get("year")) || currentYear();

  const [overview, attendanceTrend, departmentDistribution, leaveUtilization, lateArrivalTrend, salaryOverview] = await Promise.all([
    getHrOverview(),
    getAttendanceTrend(14),
    getDepartmentDistribution(),
    getLeaveTypeUtilization(year),
    getLateArrivalTrend(8),
    getSalaryOverview(),
  ]);

  return ok({ overview, attendanceTrend, departmentDistribution, leaveUtilization, lateArrivalTrend, salaryOverview, year });
});
