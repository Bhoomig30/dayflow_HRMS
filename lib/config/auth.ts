/**
 * Whether the development-only email verification mechanism is allowed to
 * expose a verification link/token in an API response.
 *
 * This is intentionally tied to Next.js's own NODE_ENV, which the framework
 * itself sets (not something a developer sets ad hoc) — `next dev` runs
 * with NODE_ENV=development, while `next build`/`next start` run with
 * NODE_ENV=production. That means this can't accidentally stay "on" in a
 * real deployment merely because someone forgot to flip a flag: shipping a
 * production build already flips it off automatically.
 *
 * There is no real email provider wired into Dayflow (see README) — this
 * flag governs the ONLY substitute for one. It must never be true when
 * NODE_ENV=production, since that would mean anyone who can create an
 * account can also verify it themselves, defeating the point of
 * verification.
 */
export function isDevVerificationEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}
