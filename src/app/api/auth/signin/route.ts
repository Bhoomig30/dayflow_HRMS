import { NextRequest } from "next/server";
import { withApiHandler, ok } from "@/lib/api/handler";
import { authenticate, signInSchema } from "@/lib/services/auth.service";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const input = signInSchema.parse(body);
  const { user, employee } = await authenticate(input);

  const token = await createSessionToken({
    userId: user.id,
    employeeId: employee.id,
    employeeCode: user.employeeCode,
    role: user.role,
    fullName: employee.fullName,
    email: user.email,
  });

  const res = ok({
    user: {
      id: user.id,
      employeeId: employee.id,
      employeeCode: user.employeeCode,
      role: user.role,
      fullName: employee.fullName,
      emailVerified: user.emailVerified,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
