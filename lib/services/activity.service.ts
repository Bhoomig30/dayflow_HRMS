import { db } from "@/lib/db/client";
import { activityEvents } from "@/lib/db/schema";
import { newId } from "@/lib/utils/id";
import { desc, eq } from "drizzle-orm";

export type ActivityAction =
  | "EMPLOYEE_CREATED"
  | "EMPLOYEE_UPDATED"
  | "PROFILE_UPDATED"
  | "ATTENDANCE_CHECK_IN"
  | "ATTENDANCE_CHECK_OUT"
  | "LEAVE_SUBMITTED"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "PAYROLL_UPDATED"
  | "PAYROLL_PUBLISHED"
  | "DOCUMENT_UPLOADED";

interface RecordActivityInput {
  actorId: string | null;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  subjectEmployeeId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes a single audit/activity event. Never pass secrets, tokens, or
 * password data through `metadata` — this table backs the user-visible
 * Employee Timeline as well as internal audit needs.
 */
export async function recordActivity(input: RecordActivityInput) {
  await db.insert(activityEvents).values({
    id: newId("evt"),
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    subjectEmployeeId: input.subjectEmployeeId,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}

export async function getEmployeeTimeline(employeeId: string, limit = 50) {
  const rows = await db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.subjectEmployeeId, employeeId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    metadata: r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : null,
  }));
}

export async function getRecentActivity(limit = 30) {
  const rows = await db.select().from(activityEvents).orderBy(desc(activityEvents.createdAt)).limit(limit);
  return rows.map((r) => ({
    ...r,
    metadata: r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : null,
  }));
}
