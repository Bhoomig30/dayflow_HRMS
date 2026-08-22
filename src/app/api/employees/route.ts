import { NextRequest } from "next/server";
import { withApiHandler, ok } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { listEmployees, profileCompleteness } from "@/lib/services/employee.service";
import { createEmployeeByHr, createEmployeeByHrSchema } from "@/lib/services/auth.service";

/** HR-only: list all employees (includes inactive when ?includeInactive=1) for the HR Command Center directory. */
export const GET = withApiHandler(async (req: NextRequest) => {
  await requireRole("HR");
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const rows = await listEmployees({ includeInactive });
  return ok({
    employees: rows.map(({ employee, user, department }) => ({
      id: employee.id,
      fullName: employee.fullName,
      employeeCode: user?.employeeCode,
      email: user?.email,
      role: user?.role,
      department: department?.name ?? null,
      jobTitle: employee.jobTitle,
      employmentStatus: employee.employmentStatus,
      dateOfJoining: employee.dateOfJoining,
      profileComplete: profileCompleteness(employee).complete,
    })),
  });
});

/** HR-only: provision a new employee or HR account directly (does not go through public signup). */
export const POST = withApiHandler(async (req: NextRequest) => {
  const session = await requireRole("HR");
  const body = await req.json();
  const input = createEmployeeByHrSchema.parse(body);
  const { employeeId } = await createEmployeeByHr(session.employeeId, input);
  return ok({ employeeId }, 201);
});
