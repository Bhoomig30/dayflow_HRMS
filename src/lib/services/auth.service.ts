import { db } from "@/lib/db/client";
import { employees, users } from "@/lib/db/schema";
import { newId } from "@/lib/utils/id";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "@/lib/auth/password";
import {
  createEmployeeProfile,
  ensureDepartment,
} from "./employee.service";
import { ensureLeaveBalances } from "./leave.service";
import { recordActivity } from "./activity.service";
import { createNotification } from "./notification.service";
import {
  randomBytes,
  createHash,
} from "node:crypto";
import {
  VERIFICATION_TOKEN_TTL_MINUTES,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
} from "@/lib/config/auth";

/**
 * Email-verification token handling.
 *
 * The token handed to the user is a 256-bit
 * cryptographically-random value.
 *
 * Only its SHA-256 hash is ever written to the
 * database.
 */
function hashVerificationToken(
  token: string
): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function generateVerificationToken(): {
  token: string;
  tokenHash: string;
  expiresAt: string;
} {
  const token =
    randomBytes(32).toString("hex");

  const expiresAt =
    new Date(
      Date.now() +
        VERIFICATION_TOKEN_TTL_MINUTES *
          60_000
    ).toISOString();

  return {
    token,
    tokenHash:
      hashVerificationToken(token),
    expiresAt,
  };
}

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(
      2,
      "Full name is required."
    )
    .max(120),

  employeeCode: z
    .string()
    .trim()
    .min(
      3,
      "Employee ID must be at least 3 characters."
    )
    .max(20)
    .regex(
      /^[A-Za-z0-9-]+$/,
      "Employee ID can only contain letters, numbers and hyphens."
    ),

  email: z
    .string()
    .trim()
    .email(
      "Enter a valid email address."
    ),

  password: z
    .string()
    .min(1),

  department: z
    .string()
    .trim()
    .max(80)
    .optional(),

  jobTitle: z
    .string()
    .trim()
    .max(120)
    .optional(),
});

export type SignUpInput =
  z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(
      1,
      "Enter your email or Employee ID."
    ),

  password: z
    .string()
    .min(
      1,
      "Enter your password."
    ),
});

export type SignInInput =
  z.infer<typeof signInSchema>;

/**
 * Public self-service signup ALWAYS creates
 * an EMPLOYEE account.
 *
 * HR/Admin accounts are provisioned by an
 * existing HR user.
 *
 * The account is created with
 * emailVerified=false and NO session is
 * issued.
 */
export async function signUp(
  input: SignUpInput
) {
  const passwordCheck =
    validatePasswordStrength(
      input.password
    );

  if (!passwordCheck.valid) {
    throw ApiError.badRequest(
      passwordCheck.errors.join(" ")
    );
  }

  const existing = await db
    .select()
    .from(users)
    .where(
      or(
        eq(
          users.email,
          input.email.toLowerCase()
        ),
        eq(
          users.employeeCode,
          input.employeeCode.toUpperCase()
        )
      )
    );

  if (
    existing.some(
      (u) =>
        u.email ===
        input.email.toLowerCase()
    )
  ) {
    throw ApiError.conflict(
      "An account with this email already exists."
    );
  }

  if (
    existing.some(
      (u) =>
        u.employeeCode ===
        input.employeeCode.toUpperCase()
    )
  ) {
    throw ApiError.conflict(
      "This Employee ID is already registered."
    );
  }

  const passwordHash =
    await hashPassword(
      input.password
    );

  const userId = newId("usr");

  const {
    token: verificationToken,
    tokenHash,
    expiresAt,
  } =
    generateVerificationToken();

  await db.insert(users).values({
    id: userId,

    employeeCode:
      input.employeeCode.toUpperCase(),

    email:
      input.email.toLowerCase(),

    passwordHash,

    role: "EMPLOYEE",

    emailVerified: false,

    emailVerificationToken:
      tokenHash,

    emailVerificationExpiresAt:
      expiresAt,
  });

  const departmentId =
    input.department
      ? await ensureDepartment(
          input.department
        )
      : null;

  const employeeId =
    await createEmployeeProfile({
      userId,

      fullName:
        input.fullName,

      departmentId,

      jobTitle:
        input.jobTitle || null,
    });

  await ensureLeaveBalances(
    employeeId
  );

  await recordActivity({
    actorId: employeeId,

    action:
      "EMPLOYEE_CREATED",

    entityType:
      "employee",

    entityId:
      employeeId,

    subjectEmployeeId:
      employeeId,

    metadata: {
      via: "self-signup",
    },
  });

  await createNotification({
    recipientId:
      employeeId,

    type:
      "ANNOUNCEMENT",

    title:
      "Welcome to Dayflow",

    message:
      `Welcome, ${input.fullName.split(" ")[0]}! Complete your profile to help HR keep your records accurate.`,
  });

  return {
    userId,
    employeeId,
    verificationToken,
  };
}

export async function authenticate(
  input: SignInInput
) {
  const identifier =
    input.identifier.trim();

  const rows = await db
    .select()
    .from(users)
    .where(
      or(
        eq(
          users.email,
          identifier.toLowerCase()
        ),

        eq(
          users.employeeCode,
          identifier.toUpperCase()
        )
      )
    )
    .limit(1);

  const user = rows[0];

  if (!user) {
    throw ApiError.unauthorized(
      "No account matches that email or Employee ID."
    );
  }

  if (!user.isActive) {
    throw ApiError.unauthorized(
      "This account has been deactivated. Contact HR."
    );
  }

  if (!user.emailVerified) {
    throw new ApiError(
      401,
      "EMAIL_NOT_VERIFIED",
      "Please verify your email before signing in. Check your inbox for the verification link, or request a new one."
    );
  }

  const validPassword =
    await verifyPassword(
      input.password,
      user.passwordHash
    );

  if (!validPassword) {
    throw ApiError.unauthorized(
      "Incorrect password."
    );
  }

  const employeeRows =
    await db
      .select()
      .from(employees)
      .where(
        eq(
          employees.userId,
          user.id
        )
      )
      .limit(1);

  const employee =
    employeeRows[0];

  if (!employee) {
    throw ApiError.unauthorized(
      "This account has no employee profile. Contact HR."
    );
  }

  if (
    employee.employmentStatus !==
    "ACTIVE"
  ) {
    throw ApiError.unauthorized(
      "This account has been deactivated. Contact HR."
    );
  }

  return {
    user,
    employee,
  };
}

export async function verifyEmail(
  token: string
) {
  const tokenHash =
    hashVerificationToken(token);

  const rows = await db
    .select()
    .from(users)
    .where(
      eq(
        users.emailVerificationToken,
        tokenHash
      )
    )
    .limit(1);

  const user = rows[0];

  if (!user) {
    throw ApiError.badRequest(
      "Invalid or expired verification link."
    );
  }

  if (
    !user.emailVerificationExpiresAt ||
    new Date(
      user.emailVerificationExpiresAt
    ).getTime() <
      Date.now()
  ) {
    throw ApiError.badRequest(
      "This verification link has expired. Request a new one."
    );
  }

  await db
    .update(users)
    .set({
      emailVerified: true,

      emailVerificationToken:
        null,

      emailVerificationExpiresAt:
        null,
    })
    .where(
      eq(users.id, user.id)
    );

  return user;
}

export const resendVerificationSchema =
  z.object({
    identifier: z
      .string()
      .trim()
      .min(
        1,
        "Enter your email or Employee ID."
      ),
  });

export type ResendVerificationInput =
  z.infer<
    typeof resendVerificationSchema
  >;

export interface VerificationRequestResult {
  token: string;
  email: string;
  fullName: string;
}

/**
 * Issues a fresh verification token for
 * an existing, still-unverified account.
 *
 * Returns null for:
 * - no matching account
 * - already verified account
 * - cooldown period
 *
 * This prevents account enumeration.
 */
export async function requestEmailVerification(
  identifier: string
): Promise<
  VerificationRequestResult | null
> {
  const trimmed =
    identifier.trim();

  if (!trimmed) {
    return null;
  }

  const rows = await db
    .select()
    .from(users)
    .where(
      or(
        eq(
          users.email,
          trimmed.toLowerCase()
        ),

        eq(
          users.employeeCode,
          trimmed.toUpperCase()
        )
      )
    )
    .limit(1);

  const user = rows[0];

  if (
    !user ||
    user.emailVerified
  ) {
    return null;
  }

  if (
    user.emailVerificationExpiresAt
  ) {
    const issuedAtMs =
      new Date(
        user.emailVerificationExpiresAt
      ).getTime() -
      VERIFICATION_TOKEN_TTL_MINUTES *
        60_000;

    if (
      Date.now() -
        issuedAtMs <
      VERIFICATION_RESEND_COOLDOWN_SECONDS *
        1000
    ) {
      return null;
    }
  }

  const {
    token,
    tokenHash,
    expiresAt,
  } =
    generateVerificationToken();

  await db
    .update(users)
    .set({
      emailVerificationToken:
        tokenHash,

      emailVerificationExpiresAt:
        expiresAt,
    })
    .where(
      eq(users.id, user.id)
    );

  const employeeRows =
    await db
      .select()
      .from(employees)
      .where(
        eq(
          employees.userId,
          user.id
        )
      )
      .limit(1);

  return {
    token,

    email:
      user.email,

    fullName:
      employeeRows[0]?.fullName ??
      "there",
  };
}

/**
 * HR-only: create an additional employee
 * or HR account without going through
 * public signup.
 */
export const createEmployeeByHrSchema =
  signUpSchema.extend({
    role: z
      .enum([
        "EMPLOYEE",
        "HR",
      ])
      .default("EMPLOYEE"),
  });

export type CreateEmployeeByHrInput =
  z.infer<
    typeof createEmployeeByHrSchema
  >;

export async function createEmployeeByHr(
  hrActorEmployeeId: string,
  input: CreateEmployeeByHrInput
) {
  const passwordCheck =
    validatePasswordStrength(
      input.password
    );

  if (!passwordCheck.valid) {
    throw ApiError.badRequest(
      passwordCheck.errors.join(" ")
    );
  }

  const existing = await db
    .select()
    .from(users)
    .where(
      or(
        eq(
          users.email,
          input.email.toLowerCase()
        ),

        eq(
          users.employeeCode,
          input.employeeCode.toUpperCase()
        )
      )
    );

  if (existing.length > 0) {
    throw ApiError.conflict(
      "An account with this email or Employee ID already exists."
    );
  }

  const passwordHash =
    await hashPassword(
      input.password
    );

  const userId = newId("usr");

  await db.insert(users).values({
    id: userId,

    employeeCode:
      input.employeeCode.toUpperCase(),

    email:
      input.email.toLowerCase(),

    passwordHash,

    role: input.role,

    emailVerified: true,

    emailVerificationToken:
      null,
  });

  const departmentId =
    input.department
      ? await ensureDepartment(
          input.department
        )
      : null;

  const employeeId =
    await createEmployeeProfile({
      userId,

      fullName:
        input.fullName,

      departmentId,

      jobTitle:
        input.jobTitle || null,
    });

  await ensureLeaveBalances(
    employeeId
  );

  await recordActivity({
    actorId:
      hrActorEmployeeId,

    action:
      "EMPLOYEE_CREATED",

    entityType:
      "employee",

    entityId:
      employeeId,

    subjectEmployeeId:
      employeeId,

    metadata: {
      via: "hr-created",
      role: input.role,
    },
  });

  return {
    userId,
    employeeId,
  };
}