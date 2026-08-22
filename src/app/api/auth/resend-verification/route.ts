import { NextRequest } from "next/server";
import {
  withApiHandler,
  ok,
} from "@/lib/api/handler";

import {
  requestEmailVerification,
  resendVerificationSchema,
} from "@/lib/services/auth.service";

import {
  sendVerificationEmail,
} from "@/lib/email/service";

import {
  isDevVerificationEnabled,
} from "@/lib/config/auth";

// Identical wording and identical response shape regardless of what
// actually happened server-side (no account, already verified, rate
// limited, or a genuine token issued).
const GENERIC_MESSAGE =
  "If that account exists and still needs verification, a new verification link is on its way.";

/**
 * Public, unauthenticated "resend verification email".
 *
 * Reachable from the sign-in page when a sign-in attempt is rejected
 * for being unverified.
 */
export const POST =
  withApiHandler(
    async (req: NextRequest) => {
      const body =
        await req.json();

      const input =
        resendVerificationSchema.parse(
          body
        );

      const result =
        await requestEmailVerification(
          input.identifier
        );

      let devEmailVerificationLink:
        | string
        | undefined;

      if (result) {
        const verifyUrl =
          `${req.nextUrl.origin}/api/auth/verify-email?token=${result.token}`;

        const emailResult =
          await sendVerificationEmail({
            to: result.email,
            fullName:
              result.fullName,
            verifyUrl,
          });

        if (
          !emailResult.delivered &&
          isDevVerificationEnabled()
        ) {
          devEmailVerificationLink =
            `/api/auth/verify-email?token=${result.token}`;
        }
      }

      return ok({
        message:
          GENERIC_MESSAGE,

        ...(devEmailVerificationLink
          ? {
              devEmailVerificationLink,
            }
          : {}),
      });
    }
  );