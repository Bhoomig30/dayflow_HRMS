import { NextRequest } from "next/server";
import { withApiHandler, ok } from "@/lib/api/handler";
import { signUp, signUpSchema } from "@/lib/services/auth.service";
import { getEmployeeById } from "@/lib/services/employee.service";
import { isDevVerificationEnabled } from "@/lib/config/auth";

/**
 * Public self-service signup. Per the "email verification required"
 * requirement, this does NOT create a session — the account exists but is
 * unverified, and sign-in (see /api/auth/signin) rejects unverified
 * accounts. There is no outbound email provider configured in this
 * environment (see README), so:
 *   - In development, the verification link is returned directly in this
 *     response (`devEmailVerificationLink`) so the flow is actually
 *     exercisable without SMTP. This is explicitly gated by NODE_ENV and is
 *     never present in a production build/run (see lib/config/auth.ts).
 *   - In production, no token or link is ever included in this response —
 *     returning it would let anyone who can create an account also verify
 *     it, defeating the point of verification. A real deployment must wire
 *     up an actual email provider to deliver this link.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const input = signUpSchema.parse(body);
  const { userId, employeeId, verificationToken } = await signUp(input);
  const employee = await getEmployeeById(employeeId);

  return ok(
    {
      user: { id: userId, employeeId, employeeCode: input.employeeCode.toUpperCase(), role: "EMPLOYEE", fullName: employee!.fullName },
      verificationRequired: true,
      message: isDevVerificationEnabled()
        ? "Account created. No email provider is configured in this environment, so use the development verification link below, then sign in."
        : "Account created. Verify your email using the link sent to your inbox, then sign in. (This deployment has no email provider configured — contact an administrator if you did not receive a verification email.)",
      ...(isDevVerificationEnabled() ? { devEmailVerificationLink: `/api/auth/verify-email?token=${verificationToken}` } : {}),
    },
    201
  );
});
