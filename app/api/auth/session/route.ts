import { withApiHandler, ok } from "@/lib/api/handler";
import { getSession } from "@/lib/auth/session";
import { getEmployeeWithUser } from "@/lib/services/employee.service";

export const GET = withApiHandler(async () => {
  const session = await getSession();
  if (!session) return ok({ authenticated: false }, 200);

  const full = await getEmployeeWithUser(session.employeeId);
  return ok({
    authenticated: true,
    user: {
      employeeId: session.employeeId,
      employeeCode: session.employeeCode,
      role: session.role,
      fullName: session.fullName,
      email: session.email,
      emailVerified: full?.user?.emailVerified ?? false,
      profilePhotoUrl: full?.employee?.profilePhotoUrl ?? null,
    },
  });
});
