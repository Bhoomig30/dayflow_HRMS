import { withApiHandler, ok } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { getAttendanceForAllOnDate } from "@/lib/services/attendance.service";
import { listEmployees } from "@/lib/services/employee.service";
import { todayISO } from "@/lib/utils/date";

/** HR-only: today's attendance across the whole company. */
export const GET = withApiHandler(async () => {
  await requireRole("HR");
  const today = todayISO();
  const [records, employees] = await Promise.all([getAttendanceForAllOnDate(today), listEmployees()]);
  const byEmployee = new Map(records.map((r) => [r.employeeId, r]));

  const rows = employees.map(({ employee, department }) => ({
    employeeId: employee.id,
    fullName: employee.fullName,
    department: department?.name ?? null,
    jobTitle: employee.jobTitle,
    attendance: byEmployee.get(employee.id) ?? null,
  }));

  return ok({ date: today, rows });
});
