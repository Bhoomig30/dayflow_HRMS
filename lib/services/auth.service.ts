import { db } from "@/lib/db/client";
import { employees, users } from "@/lib/db/schema";
import { newId } from "@/lib/utils/id";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { createEmployeeProfile, ensureDepartment } from "./employee.service";
import { ensureLeaveBalances } from "./leave.service";
import { recordActivity } from "./activity.service";
import { createNotification } from "./notification.service";
import { randomUUID } from "node:crypto";

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required.").max(120),
  employeeCode: z
    .string()
    .trim()
    .min(3, "Employee ID must be at least 3 characters.")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Employee ID can only contain letters, numbers and hyphens."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1),
  department: z.string().trim().max(80).optional(),
  jobTitle: z.string().trim().max(120).optional(),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or Employee ID."),
  password: z.string().min(1, "Enter your password."),
});
export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Public self-service signup ALWAYS creates an EMPLOYEE account. HR/Admin
 * accounts are provisioned by an existing HR user (see
 * employees.service::createEmployeeByHr / the seed script), never through
 * this public endpoint — accepting a client-supplied role here would be a
 * direct privilege-escalation hole.
 *
 * The account is created with emailVerified=false and NO session is issued
 * by this function — the caller (the API route) must not treat a successful
 * signUp() as a login. Per the requirement that email verification is
 * required before protected access, the caller-facing flow is:
 *   sign up -> account created, unverified -> verify -> sign in.
 * See verifyEmail() below and authenticate(), which rejects unverified
 * accounts.
 */
export async function signUp(input: SignUpInput) {
  const passwordCheck = validatePasswordStrength(input.password);
  if (!passwordCheck.valid) {
    throw ApiError.badRequest(passwordCheck.errors.join(" "));
  }

  const existing = await db
    .select()
    .from(users)
    .where(or(eq(users.email, input.email.toLowerCase()), eq(users.employeeCode, input.employeeCode.toUpperCase())));
  if (existing.some((u) => u.email === input.email.toLowerCase())) {
    throw ApiError.conflict("An account with this email already exists.");
  }
  if (existing.some((u) => u.employeeCode === input.employeeCode.toUpperCase())) {
    throw ApiError.conflict("This Employee ID is already registered.");
  }

  const passwordHash = await hashPassword(input.password);
  const userId = newId("usr");
  const verificationToken = randomUUID();

  await db.insert(users).values({
    id: userId,
    employeeCode: input.employeeCode.toUpperCase(),
    email: input.email.toLowerCase(),
    passwordHash,
    role: "EMPLOYEE",
    emailVerified: false,
    emailVerificationToken: verificationToken,
  });

  const departmentId = input.department ? await ensureDepartment(input.department) : null;
  const employeeId = await createEmployeeProfile({
    userId,
    fullName: input.fullName,
    departmentId,
    jobTitle: input.jobTitle || null,
  });

  await ensureLeaveBalances(employeeId);

  await recordActivity({
    actorId: employeeId,
    action: "EMPLOYEE_CREATED",
    entityType: "employee",
    entityId: employeeId,
    subjectEmployeeId: employeeId,
    metadata: { via: "self-signup" },
  });

  await createNotification({
    recipientId: employeeId,
    type: "ANNOUNCEMENT",
    title: "Welcome to Dayflow",
    message: `Welcome, ${input.fullName.split(" ")[0]}! Complete your profile to help HR keep your records accurate.`,
  });

  return { userId, employeeId, verificationToken };
}

export async function authenticate(input: SignInInput) {
  const identifier = input.identifier.trim();
  const rows = await db
    .select()
    .from(users)
    .where(or(eq(users.email, identifier.toLowerCase()), eq(users.employeeCode, identifier.toUpperCase())))
    .limit(1);
  const user = rows[0];
  if (!user) throw ApiError.unauthorized("No account matches that email or Employee ID.");
  if (!user.isActive) throw ApiError.unauthorized("This account has been deactivated. Contact HR.");
  if (!user.emailVerified) {
    throw ApiError.unauthorized("Please verify your email before signing in. Check the verification link sent when you signed up.");
  }

  const validPassword = await verifyPassword(input.password, user.passwordHash);
  if (!validPassword) throw ApiError.unauthorized("Incorrect password.");

  const employeeRows = await db.select().from(employees).where(eq(employees.userId, user.id)).limit(1);
  const employee = employeeRows[0];
  if (!employee) throw ApiError.unauthorized("This account has no employee profile. Contact HR.");
  if (employee.employmentStatus !== "ACTIVE") {
    throw ApiError.unauthorized("This account has been deactivated. Contact HR.");
  }

  return { user, employee };
}

export async function verifyEmail(token: string) {
  const rows = await db.select().from(users).where(eq(users.emailVerificationToken, token)).limit(1);
  const user = rows[0];
  if (!user) throw ApiError.badRequest("Invalid or expired verification link.");
  await db.update(users).set({ emailVerified: true, emailVerificationToken: null }).where(eq(users.id, user.id));
  return user;
}

/**
 * HR-only: create an additional employee (or HR) account without going
 * through public signup. Creating an HR account this way is intentional —
 * HR staff are the only ones allowed to provision another HR account, and
 * this route is server-side gated to the HR role (see
 * app/api/employees/route.ts POST, which calls requireRole("HR") before
 * this is ever reached).
 */
export const createEmployeeByHrSchema = signUpSchema.extend({
  role: z.enum(["EMPLOYEE", "HR"]).default("EMPLOYEE"),
});
export type CreateEmployeeByHrInput = z.infer<typeof createEmployeeByHrSchema>;

export async function createEmployeeByHr(hrActorEmployeeId: string, input: CreateEmployeeByHrInput) {
  const passwordCheck = validatePasswordStrength(input.password);
  if (!passwordCheck.valid) throw ApiError.badRequest(passwordCheck.errors.join(" "));

  const existing = await db
    .select()
    .from(users)
    .where(or(eq(users.email, input.email.toLowerCase()), eq(users.employeeCode, input.employeeCode.toUpperCase())));
  if (existing.length > 0) {
    throw ApiError.conflict("An account with this email or Employee ID already exists.");
  }

  const passwordHash = await hashPassword(input.password);
  const userId = newId("usr");
  // Assumption (documented, not silently invented): an account provisioned
  // directly by HR is treated as pre-verified. HR is provisioning this
  // account internally and already vouches for the identity behind it —
  // unlike public self-service signup, there is no unverified third party
  // to confirm. This also avoids stranding HR-created accounts: this
  // deployment has no outbound email provider, so there would otherwise be
  // no way to deliver a verification link for an account HR creates on
  // someone's behalf. Public self-service signup (signUp() above) still
  // requires verification, which is the flow the "email verification
  // required" requirement is actually about.
  await db.insert(users).values({
    id: userId,
    employeeCode: input.employeeCode.toUpperCase(),
    email: input.email.toLowerCase(),
    passwordHash,
    role: input.role,
    emailVerified: true,
    emailVerificationToken: null,
  });

  const departmentId = input.department ? await ensureDepartment(input.department) : null;
  const employeeId = await createEmployeeProfile({
    userId,
    fullName: input.fullName,
    departmentId,
    jobTitle: input.jobTitle || null,
  });
  await ensureLeaveBalances(employeeId);

  await recordActivity({
    actorId: hrActorEmployeeId,
    action: "EMPLOYEE_CREATED",
    entityType: "employee",
    entityId: employeeId,
    subjectEmployeeId: employeeId,
    metadata: { via: "hr-created", role: input.role },
  });

  return { userId, employeeId };
}
