import { db } from "@/lib/db/client";
import { departments, employees, users } from "@/lib/db/schema";
import { newId } from "@/lib/utils/id";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { recordActivity } from "./activity.service";

// Fields an employee may edit on their own profile.
export const selfEditableProfileSchema = z.object({
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  emergencyContactName: z.string().trim().max(120).optional().nullable(),
  emergencyContactPhone: z.string().trim().max(30).optional().nullable(),
  profilePhotoUrl: z.string().trim().max(500).optional().nullable(),
});
export type SelfEditableProfile = z.infer<typeof selfEditableProfileSchema>;

// Additional fields only HR may edit. HR can also set any self-editable field.
export const hrEditableProfileSchema = selfEditableProfileSchema.extend({
  fullName: z.string().trim().min(1).max(120).optional(),
  departmentId: z.string().trim().min(1).optional().nullable(),
  jobTitle: z.string().trim().max(120).optional().nullable(),
  managerId: z.string().trim().min(1).optional().nullable(),
  employmentStatus: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  dateOfJoining: z.string().trim().optional().nullable(),
});
export type HrEditableProfile = z.infer<typeof hrEditableProfileSchema>;

export async function createEmployeeProfile(params: {
  userId: string;
  fullName: string;
  departmentId?: string | null;
  jobTitle?: string | null;
  dateOfJoining?: string | null;
}) {
  const id = newId("emp");
  await db.insert(employees).values({
    id,
    userId: params.userId,
    fullName: params.fullName,
    departmentId: params.departmentId ?? null,
    jobTitle: params.jobTitle ?? null,
    dateOfJoining: params.dateOfJoining ?? null,
    employmentStatus: "ACTIVE",
  });
  return id;
}

export async function getEmployeeById(employeeId: string) {
  const rows = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
  return rows[0] ?? null;
}

export async function getEmployeeWithUser(employeeId: string) {
  const rows = await db
    .select({ employee: employees, user: users, department: departments })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(eq(employees.id, employeeId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listEmployees(opts: { includeInactive?: boolean } = {}) {
  const rows = await db
    .select({ employee: employees, user: users, department: departments })
    .from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(departments, eq(employees.departmentId, departments.id));
  return opts.includeInactive ? rows : rows.filter((r) => r.employee.employmentStatus === "ACTIVE");
}

export async function listDepartments() {
  return db.select().from(departments);
}

export async function ensureDepartment(name: string): Promise<string> {
  const existing = await db.select().from(departments).where(eq(departments.name, name)).limit(1);
  if (existing[0]) return existing[0].id;
  const id = newId("dept");
  await db.insert(departments).values({ id, name });
  return id;
}

export async function updateEmployeeSelf(employeeId: string, data: SelfEditableProfile) {
  const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  if (Object.keys(patch).length === 0) return;
  await db
    .update(employees)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(employees.id, employeeId));
  await recordActivity({
    actorId: employeeId,
    action: "PROFILE_UPDATED",
    entityType: "employee",
    entityId: employeeId,
    subjectEmployeeId: employeeId,
    metadata: { fields: Object.keys(patch) },
  });
}

export async function updateEmployeeAsHr(actorEmployeeId: string, employeeId: string, data: HrEditableProfile) {
  const target = await getEmployeeById(employeeId);
  if (!target) throw ApiError.notFound("Employee not found.");

  // Impossible-state guards the Zod schema can't express on its own (it only
  // knows managerId is a non-empty string, not what a *valid* one is here).
  if (data.managerId) {
    if (data.managerId === employeeId) {
      throw ApiError.badRequest("An employee cannot be their own manager.");
    }
    const manager = await getEmployeeById(data.managerId);
    if (!manager) {
      throw ApiError.badRequest("The selected manager does not exist.");
    }
  }

  const patch = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  if (Object.keys(patch).length === 0) return;
  await db
    .update(employees)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(employees.id, employeeId));
  await recordActivity({
    actorId: actorEmployeeId,
    action: "EMPLOYEE_UPDATED",
    entityType: "employee",
    entityId: employeeId,
    subjectEmployeeId: employeeId,
    metadata: { fields: Object.keys(patch) },
  });
}

/** Profile completeness — used by HR "attention required" and employee nudges. Never fabricated: derived from actual stored fields. */
export function profileCompleteness(emp: typeof employees.$inferSelect): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!emp.phone) missing.push("phone");
  if (!emp.address) missing.push("address");
  if (!emp.emergencyContactName) missing.push("emergency contact name");
  if (!emp.emergencyContactPhone) missing.push("emergency contact phone");
  if (!emp.departmentId) missing.push("department");
  if (!emp.jobTitle) missing.push("job title");
  return { complete: missing.length === 0, missing };
}
