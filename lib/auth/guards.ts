import { eq } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { getSession, type SessionPayload } from "./session";
import { db } from "@/lib/db/client";
import { employees, users, type Role } from "@/lib/db/schema";

/**
 * Server-side authorization guards. These MUST be called inside every API
 * route (and server component) that touches employee data — the frontend
 * role checks that drive navigation/UI visibility are a UX convenience only
 * and are never trusted for security.
 */

/**
 * requireSession() is the single choke point almost every other guard
 * (requireRole, requireOwnerOrHr) and every protected API route builds on.
 * A JWT is only proof of "who signed in and with what role, as of when the
 * token was issued" — it is stateless, so on its own it cannot reflect an
 * account being deactivated, an employee being marked inactive, or a role
 * changing AFTER the token was issued. A currently-unauthorized or
 * deactivated account must not retain privileged access merely because it
 * still holds an old valid JWT.
 *
 * So every call re-validates the session's identity against current
 * database state — one extra indexed lookup per request (joined on the
 * unique users.id / employees.user_id keys), not per guard call: guards
 * that build on this one (requireRole, requireOwnerOrHr) call it once and
 * reuse the same revalidated SessionPayload, so a route that calls a single
 * guard still only pays for a single extra query, not one per guard.
 *
 * The role/employeeCode/fullName/email returned reflect the CURRENT
 * database row, not whatever was embedded in the JWT at sign-in — so even a
 * role change takes effect on the very next request, not just after the
 * token expires or the user signs in again.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw ApiError.unauthorized();

  const rows = await db
    .select({
      isActive: users.isActive,
      role: users.role,
      employeeCode: users.employeeCode,
      email: users.email,
      fullName: employees.fullName,
      employmentStatus: employees.employmentStatus,
    })
    .from(users)
    .innerJoin(employees, eq(employees.userId, users.id))
    .where(eq(users.id, session.userId))
    .limit(1);

  const current = rows[0];
  if (!current || !current.isActive || current.employmentStatus !== "ACTIVE") {
    throw ApiError.unauthorized("Your session is no longer valid. Please sign in again.");
  }

  // Always trust the freshly-read row over the JWT's embedded claims — this
  // is what makes a deactivation or role change take effect immediately
  // instead of only once the old token expires.
  return {
    ...session,
    role: current.role,
    employeeCode: current.employeeCode,
    email: current.email,
    fullName: current.fullName,
  };
}

export async function requireRole(...roles: Role[]): Promise<SessionPayload> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    throw ApiError.forbidden("This action requires a different role.");
  }
  return session;
}

/**
 * Enforces that the authenticated user either IS the employee identified by
 * `employeeId`, OR holds an HR role. This is the core defense against IDOR:
 * every route that reads or writes a specific employee's data must call
 * this with the employeeId taken from the URL/body, never trust a client
 * supplied "isOwner" flag.
 */
export async function requireOwnerOrHr(employeeId: string): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role === "HR") return session;
  if (session.employeeId !== employeeId) {
    throw ApiError.forbidden("You can only access your own records.");
  }
  return session;
}
