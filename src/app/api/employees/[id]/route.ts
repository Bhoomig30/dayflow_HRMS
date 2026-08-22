import { NextRequest } from "next/server";
import { withApiHandler, ok } from "@/lib/api/handler";
import { requireOwnerOrHr } from "@/lib/auth/guards";
import {
  getEmployeeWithUser,
  hrEditableProfileSchema,
  profileCompleteness,
  selfEditableProfileSchema,
  updateEmployeeAsHr,
  updateEmployeeSelf,
} from "@/lib/services/employee.service";
import { ApiError } from "@/lib/api/errors";

export const GET = withApiHandler(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  await requireOwnerOrHr(id);
  const full = await getEmployeeWithUser(id);
  if (!full) throw ApiError.notFound("Employee not found.");
  return ok({
    employee: {
      id: full.employee.id,
      fullName: full.employee.fullName,
      employeeCode: full.user?.employeeCode,
      email: full.user?.email,
      role: full.user?.role,
      department: full.department?.name ?? null,
      departmentId: full.employee.departmentId,
      jobTitle: full.employee.jobTitle,
      managerId: full.employee.managerId,
      employmentStatus: full.employee.employmentStatus,
      dateOfJoining: full.employee.dateOfJoining,
      phone: full.employee.phone,
      address: full.employee.address,
      emergencyContactName: full.employee.emergencyContactName,
      emergencyContactPhone: full.employee.emergencyContactPhone,
      profilePhotoUrl: full.employee.profilePhotoUrl,
      completeness: profileCompleteness(full.employee),
    },
  });
});

/**
 * Field-level authorization: an EMPLOYEE session may only patch the
 * self-editable subset of fields on their OWN record (requireOwnerOrHr
 * enforces the ownership half); HR may patch the broader field set on any
 * employee. There is no request path by which an employee can set
 * protected fields like department, job title or employment status on
 * themselves — those keys simply aren't in selfEditableProfileSchema.
 */
export const PATCH = withApiHandler(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  const session = await requireOwnerOrHr(id);
  const body = await req.json();

  if (session.role === "HR") {
    const input = hrEditableProfileSchema.parse(body);
    await updateEmployeeAsHr(session.employeeId, id, input);
  } else {
    const input = selfEditableProfileSchema.parse(body);
    await updateEmployeeSelf(id, input);
  }

  const full = await getEmployeeWithUser(id);
  return ok({ employee: full });
});
