/**
 * Whether the development-only email verification mechanism is
 * allowed to expose a verification link/token in an API response.
 *
 * This is intentionally tied to Next.js's own NODE_ENV, which the
 * framework itself sets — not something a developer sets ad hoc.
 *
 * `next dev` runs with NODE_ENV=development, while
 * `next build`/`next start` run with NODE_ENV=production.
 *
 * That means this can't accidentally stay "on" in a real
 * deployment merely because someone forgot to flip a flag.
 *
 * There is no real email provider wired into Dayflow by default.
 * This flag governs the ONLY substitute for one.
 *
 * It must never be true when NODE_ENV=production, since that
 * would mean anyone who can create an account can also verify it
 * themselves, defeating the point of verification.
 */
export function isDevVerificationEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * How long a generated email-verification token stays valid,
 * and the minimum gap between two token issuances for the same
 * account.
 *
 * This provides a lightweight abuse guard so a single account
 * can't be used to spam itself or spam an inbox with an
 * unbounded number of tokens.
 *
 * Both values are environment-overridable.
 */
export const VERIFICATION_TOKEN_TTL_MINUTES = Number(
  process.env.DAYFLOW_EMAIL_VERIFICATION_TTL_MINUTES ?? 60
);

export const VERIFICATION_RESEND_COOLDOWN_SECONDS = Number(
  process.env.DAYFLOW_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS ?? 60
);