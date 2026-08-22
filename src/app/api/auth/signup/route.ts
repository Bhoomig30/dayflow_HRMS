import { NextRequest } from "next/server";
import { withApiHandler, ok } from "@/lib/api/handler";
import { signUp, signUpSchema } from "@/lib/services/auth.service";
import { getEmployeeById } from "@/lib/services/employee.service";
import { isDevVerificationEnabled } from "@/lib/config/auth";
import { sendVerificationEmail } from "@/lib/email/service";

/**
 * Public self-service signup. Per the "email verification required"
 * requirement, this does NOT create a session — the account exists but is
 * unverified, and sign-in (see /api/auth/signin) rejects unverified
 * accounts.
 *
 * Email delivery is optional and provider-driven (see lib/email/provider.ts
 * — EMAIL_PROVIDER / EMAIL_API_KEY / EMAIL_FROM). What happens next depends
 * on whether one is configured:
 *   - Configured and delivery succeeds: a real email was sent, nothing else
 *     is exposed in this response.
 *   - Not configured (the default — no provider ships with Dayflow), OR
 *     configured but delivery failed: in development, the verification
 *     link is returned directly in this response
 *     (`devEmailVerificationLink`) so the flow is still exercisable without
 *     a real inbox. This is gated by NODE_ENV, not a flag a deployment can
 *     forget to flip — see isDevVerificationEnabled(). In production, no
 *     token or link is ever included in this response — returning it would
 *     let anyone who can create an account also verify it themselves,
 *     defeating the point of verification.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const input = signUpSchema.parse(body);
  const { userId, employeeId, verificationToken } = await signUp(input);
  const employee = await getEmployeeById(employeeId);

  const verifyUrl = `${req.nextUrl.origin}/api/auth/verify-email?token=${verificationToken}`;
  const emailResult = await sendVerificationEmail({
    to: input.email,
    fullName: input.fullName,
    verifyUrl,
  });

  const showDevLink = !emailResult.delivered && isDevVerificationEnabled();

  return ok(
    {
      user: {
        id: userId,
        employeeId,
        employeeCode: input.employeeCode.toUpperCase(),
        role: "EMPLOYEE",
        fullName: employee!.fullName,
      },
      verificationRequired: true,
      message: emailResult.delivered
        ? "Account created. Check your email to verify your account, then sign in."
        : showDevLink
          ? "Account created. No email provider is configured in this environment, so use the development verification link below, then sign in."
          : "Account created. Verify your email using the link sent to your inbox, then sign in. (This deployment has no email provider configured — contact an administrator if you did not receive a verification email.)",
      ...(showDevLink
        ? {
            devEmailVerificationLink:
              `/api/auth/verify-email?token=${verificationToken}`,
          }
        : {}),
    },
    201
  );
});