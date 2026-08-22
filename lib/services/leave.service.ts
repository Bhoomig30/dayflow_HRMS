import { db } from "@/lib/db/client";
import {
  attendance,
  employees,
  leaveBalances,
  leaveRequests,
  users,
  type LeaveStatus,
  type LeaveType,
} from "@/lib/db/schema";
import { newId } from "@/lib/utils/id";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { recordActivity } from "./activity.service";
import { createNotification } from "./notification.service";
import { BALANCED_LEAVE_TYPES, DEFAULT_PAID_LEAVE_DAYS, DEFAULT_SICK_LEAVE_DAYS } from "@/lib/config/leave";
import { countWorkingDays, currentYear, dateRange, isWeekend, parseISODate, todayISO } from "@/lib/utils/date";

export const submitLeaveSchema = z
  .object({
    leaveType: z.enum(["PAID", "SICK", "UNPAID"]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date."),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date."),
    remarks: z.string().trim().max(500).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.endDate < val.startDate) {
      ctx.addIssue({ code: "custom", message: "End date cannot be before start date.", path: ["endDate"] });
    }
  });
export type SubmitLeaveInput = z.infer<typeof submitLeaveSchema>;

export const reviewLeaveSchema = z.object({
  comment: z.string().trim().max(500).optional(),
});

function defaultAllotment(leaveType: LeaveType): number {
  if (leaveType === "PAID") return DEFAULT_PAID_LEAVE_DAYS;
  if (leaveType === "SICK") return DEFAULT_SICK_LEAVE_DAYS;
  return 0;
}

export async function ensureLeaveBalances(employeeId: string, year = currentYear()) {
  for (const leaveType of BALANCED_LEAVE_TYPES) {
    const existing = await db
      .select()
      .from(leaveBalances)
      .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.leaveType, leaveType), eq(leaveBalances.year, year)))
      .limit(1);
    if (!existing[0]) {
      await db.insert(leaveBalances).values({
        id: newId("lbal"),
        employeeId,
        leaveType,
        year,
        totalDays: defaultAllotment(leaveType),
        usedDays: 0,
      });
    }
  }
}

export interface LeaveBalanceView {
  leaveType: LeaveType;
  totalDays: number | null; // null = unlimited (UNPAID)
  usedDays: number;
  pendingDays: number;
  remainingDays: number | null;
}

export async function getLeaveBalanceSummary(employeeId: string, year = currentYear()): Promise<LeaveBalanceView[]> {
  await ensureLeaveBalances(employeeId, year);
  const balances = await db
    .select()
    .from(leaveBalances)
    .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.year, year)));

  const pending = await db
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.employeeId, employeeId), eq(leaveRequests.status, "PENDING")));

  const pendingByType = (type: LeaveType) =>
    pending.filter((p) => p.leaveType === type && p.startDate.startsWith(String(year))).reduce((s, p) => s + p.workingDays, 0);

  const result: LeaveBalanceView[] = balances.map((b) => ({
    leaveType: b.leaveType,
    totalDays: b.totalDays,
    usedDays: b.usedDays,
    pendingDays: pendingByType(b.leaveType),
    remainingDays: Math.max(0, b.totalDays - b.usedDays - pendingByType(b.leaveType)),
  }));

  const unpaidUsed = 0; // Unpaid leave has no balance to track against; used count surfaced via history instead.
  result.push({
    leaveType: "UNPAID",
    totalDays: null,
    usedDays: unpaidUsed,
    pendingDays: pendingByType("UNPAID"),
    remainingDays: null,
  });

  return result;
}

export async function listLeaveRequestsForEmployee(employeeId: string) {
  return db.select().from(leaveRequests).where(eq(leaveRequests.employeeId, employeeId)).orderBy(desc(leaveRequests.createdAt));
}

export async function listAllLeaveRequests(status?: LeaveStatus) {
  const rows = await db
    .select({ request: leaveRequests, employee: employees })
    .from(leaveRequests)
    .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
    .orderBy(desc(leaveRequests.createdAt));
  return status ? rows.filter((r) => r.request.status === status) : rows;
}

export async function getLeaveRequestById(id: string) {
  const rows = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1);
  return rows[0] ?? null;
}

async function findOverlappingRequests(employeeId: string, startDate: string, endDate: string, excludeId?: string) {
  const rows = await db
    .select()
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.employeeId, employeeId),
        inArray(leaveRequests.status, ["PENDING", "APPROVED"]),
        excludeId ? ne(leaveRequests.id, excludeId) : undefined
      )
    );
  return rows.filter((r) => !(r.endDate < startDate || r.startDate > endDate));
}

export async function submitLeaveRequest(employeeId: string, input: SubmitLeaveInput) {
  const { leaveType, startDate, endDate, remarks } = input;

  if (startDate < todayISO()) {
    throw ApiError.badRequest("Leave cannot be requested for a date in the past.");
  }

  const workingDays = countWorkingDays(startDate, endDate);
  if (workingDays <= 0) {
    throw ApiError.badRequest("The selected range does not include any working days (Mon–Fri).");
  }

  const overlaps = await findOverlappingRequests(employeeId, startDate, endDate);
  if (overlaps.length > 0) {
    throw ApiError.conflict(
      `This overlaps with an existing ${overlaps[0].status.toLowerCase()} leave request (${overlaps[0].startDate} to ${overlaps[0].endDate}).`
    );
  }

  if (leaveType === "PAID" || leaveType === "SICK") {
    // Cross-year edge case: attribute the balance check to the request's
    // OWN start-year, not always "this calendar year" — otherwise a leave
    // request that starts in a future (or, in principle, past) year would
    // be checked against the wrong year's allotment. This mirrors the same
    // start-year attribution used when the balance is actually decremented
    // on approval below, so the two stay consistent. A request that spans a
    // year boundary (e.g. Dec 29 - Jan 2) is attributed *entirely* to its
    // start year for balance purposes — Dayflow has no specified policy for
    // prorating a single leave request across two years' allotments, so it
    // is not invented here; this is documented, not silently decided.
    const requestYear = Number(startDate.slice(0, 4));
    const [summary] = (await getLeaveBalanceSummary(employeeId, requestYear)).filter((b) => b.leaveType === leaveType);
    if (summary && summary.remainingDays !== null && workingDays > summary.remainingDays) {
      throw ApiError.badRequest(
        `Insufficient ${leaveType.toLowerCase()} leave balance: requested ${workingDays} day(s), ${summary.remainingDays} remaining.`
      );
    }
  }

  const id = newId("lv");
  await db.insert(leaveRequests).values({
    id,
    employeeId,
    leaveType,
    startDate,
    endDate,
    workingDays,
    remarks: remarks || null,
    status: "PENDING",
  });

  await recordActivity({
    actorId: employeeId,
    action: "LEAVE_SUBMITTED",
    entityType: "leave_request",
    entityId: id,
    subjectEmployeeId: employeeId,
    metadata: { leaveType, startDate, endDate, workingDays },
  });

  await createNotification({
    recipientId: employeeId,
    type: "LEAVE_SUBMITTED",
    title: "Leave request submitted",
    message: `Your ${leaveType.toLowerCase()} leave request for ${startDate} to ${endDate} (${workingDays} working day${workingDays === 1 ? "" : "s"}) has been submitted and is pending review.`,
  });

  // Notify HR staff of the new pending request.
  const hrRows = await db.select({ employee: employees }).from(employees).innerJoin(users, eq(employees.userId, users.id)).where(eq(users.role, "HR"));
  for (const hr of hrRows) {
    await createNotification({
      recipientId: hr.employee.id,
      type: "LEAVE_SUBMITTED",
      title: "New leave request awaiting review",
      message: `A ${leaveType.toLowerCase()} leave request was submitted for ${startDate} to ${endDate}.`,
    });
  }

  return getLeaveRequestById(id);
}

interface ReviewResult {
  request: typeof leaveRequests.$inferSelect;
}

export async function approveLeaveRequest(hrEmployeeId: string, leaveRequestId: string, comment?: string): Promise<ReviewResult> {
  const existing = await getLeaveRequestById(leaveRequestId);
  if (!existing) throw ApiError.notFound("Leave request not found.");
  if (existing.status !== "PENDING") {
    // Fast, friendly rejection for the common single-request case. This is
    // NOT the concurrency guarantee by itself (see the conditional UPDATE
    // inside the transaction below) — it's a read moments before the
    // transaction starts, so two near-simultaneous requests can both pass
    // this check. It just avoids doing unnecessary work before the real
    // atomic check.
    throw ApiError.conflict(`This request has already been ${existing.status.toLowerCase()}.`);
  }
  if (BALANCED_LEAVE_TYPES.includes(existing.leaveType as (typeof BALANCED_LEAVE_TYPES)[number])) {
    // Cross-year edge case: ensure the balance row for the leave's OWN
    // start-year exists, not always "this calendar year" — a leave request
    // approved into a future year would otherwise find no matching balance
    // row for that year (ensureLeaveBalances defaults to currentYear()) and
    // the usedDays increment below would silently no-op.
    await ensureLeaveBalances(existing.employeeId, Number(existing.startDate.slice(0, 4)));
  }

  const workingDates = dateRange(existing.startDate, existing.endDate).filter((d) => !isWeekend(parseISODate(d)));
  const now = new Date().toISOString();

  const updated = db.transaction((tx) => {
    // The actual concurrency guarantee: a conditional UPDATE scoped to
    // status='PENDING', with the affected-row count checked. SQLite
    // serializes writer transactions (better-sqlite3 uses a single
    // connection), so if two approve requests for the same leave request
    // race, only the first transaction's UPDATE can match a PENDING row —
    // by the time the second transaction's UPDATE runs, status is already
    // APPROVED/REJECTED and it matches zero rows. That second transaction
    // then throws and rolls back before touching the balance or attendance
    // — so a PENDING request transitions exactly once, no double-counted
    // balance, no duplicate attendance side effects.
    const result = tx
      .update(leaveRequests)
      .set({ status: "APPROVED", hrComment: comment || null, reviewedBy: hrEmployeeId, reviewedAt: now, updatedAt: now })
      .where(and(eq(leaveRequests.id, leaveRequestId), eq(leaveRequests.status, "PENDING")))
      .run();
    if (result.changes === 0) {
      throw ApiError.conflict("This request was already processed by another request.");
    }

    if (existing.leaveType === "PAID" || existing.leaveType === "SICK") {
      const year = Number(existing.startDate.slice(0, 4));
      const bal = tx
        .select()
        .from(leaveBalances)
        .where(and(eq(leaveBalances.employeeId, existing.employeeId), eq(leaveBalances.leaveType, existing.leaveType), eq(leaveBalances.year, year)))
        .get();
      if (bal) {
        tx.update(leaveBalances)
          .set({ usedDays: bal.usedDays + existing.workingDays })
          .where(eq(leaveBalances.id, bal.id))
          .run();
      }
    }

    // Data-consistency requirement: approved leave reflects in attendance,
    // but we never overwrite a day the employee genuinely checked in for.
    for (const dateISO of workingDates) {
      const existingAttendance = tx
        .select()
        .from(attendance)
        .where(and(eq(attendance.employeeId, existing.employeeId), eq(attendance.date, dateISO)))
        .get();
      if (!existingAttendance) {
        tx.insert(attendance)
          .values({ id: newId("att"), employeeId: existing.employeeId, date: dateISO, status: "LEAVE", notes: "Auto-set from approved leave request" })
          .run();
      } else if (!existingAttendance.checkInAt) {
        tx.update(attendance)
          .set({ status: "LEAVE", notes: "Auto-set from approved leave request", updatedAt: now })
          .where(eq(attendance.id, existingAttendance.id))
          .run();
      }
    }

    const row = tx.select().from(leaveRequests).where(eq(leaveRequests.id, leaveRequestId)).get()!;
    return row;
  });

  await createNotification({
    recipientId: existing.employeeId,
    type: "LEAVE_APPROVED",
    title: "Leave request approved",
    message: `Your ${existing.leaveType.toLowerCase()} leave from ${existing.startDate} to ${existing.endDate} was approved.${comment ? ` HR note: ${comment}` : ""}`,
  });

  await recordActivity({
    actorId: hrEmployeeId,
    action: "LEAVE_APPROVED",
    entityType: "leave_request",
    entityId: leaveRequestId,
    subjectEmployeeId: existing.employeeId,
    metadata: { comment: comment || null },
  });

  return { request: updated };
}

export async function rejectLeaveRequest(hrEmployeeId: string, leaveRequestId: string, comment?: string): Promise<ReviewResult> {
  const existing = await getLeaveRequestById(leaveRequestId);
  if (!existing) throw ApiError.notFound("Leave request not found.");
  if (existing.status !== "PENDING") {
    // Fast-path only — see the matching comment in approveLeaveRequest.
    throw ApiError.conflict(`This request has already been ${existing.status.toLowerCase()}.`);
  }
  const now = new Date().toISOString();

  // Same conditional-update pattern as approveLeaveRequest: only a PENDING
  // row can transition, and the affected-row count is checked so a
  // concurrent double-reject (or race with an approval) can't silently
  // "succeed" twice.
  const result = db
    .update(leaveRequests)
    .set({ status: "REJECTED", hrComment: comment || null, reviewedBy: hrEmployeeId, reviewedAt: now, updatedAt: now })
    .where(and(eq(leaveRequests.id, leaveRequestId), eq(leaveRequests.status, "PENDING")))
    .run();
  if (result.changes === 0) {
    throw ApiError.conflict("This request was already processed by another request.");
  }

  await createNotification({
    recipientId: existing.employeeId,
    type: "LEAVE_REJECTED",
    title: "Leave request rejected",
    message: `Your ${existing.leaveType.toLowerCase()} leave from ${existing.startDate} to ${existing.endDate} was rejected.${comment ? ` HR note: ${comment}` : ""}`,
  });

  await recordActivity({
    actorId: hrEmployeeId,
    action: "LEAVE_REJECTED",
    entityType: "leave_request",
    entityId: leaveRequestId,
    subjectEmployeeId: existing.employeeId,
    metadata: { comment: comment || null },
  });

  return { request: (await getLeaveRequestById(leaveRequestId))! };
}

// ---------------------------------------------------------------------------
// Smart Leave Planner
// ---------------------------------------------------------------------------
export interface LeavePlan {
  workingDays: number;
  calendarDays: number;
  balanceContext: LeaveBalanceView | null;
  overlappingTeammates: { employeeId: string; fullName: string; leaveType: LeaveType; startDate: string; endDate: string; status: LeaveStatus }[];
  hasTeamData: boolean;
  note: string;
}

export async function planLeave(employeeId: string, leaveType: LeaveType, startDate: string, endDate: string): Promise<LeavePlan> {
  const workingDays = countWorkingDays(startDate, endDate);
  const calendarDays = dateRange(startDate, endDate).length;

  const balances = leaveType === "UNPAID" ? [] : await getLeaveBalanceSummary(employeeId);
  const balanceContext = balances.find((b) => b.leaveType === leaveType) ?? null;

  const self = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
  const departmentId = self[0]?.departmentId ?? null;

  let overlappingTeammates: LeavePlan["overlappingTeammates"] = [];
  const hasTeamData = Boolean(departmentId);

  if (departmentId) {
    const teammates = await db.select().from(employees).where(eq(employees.departmentId, departmentId));
    const teammateIds = teammates.map((t) => t.id).filter((id) => id !== employeeId);
    if (teammateIds.length > 0) {
      const rows = await db
        .select({ request: leaveRequests, employee: employees })
        .from(leaveRequests)
        .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
        .where(and(inArray(leaveRequests.employeeId, teammateIds), inArray(leaveRequests.status, ["PENDING", "APPROVED"])));
      overlappingTeammates = rows
        .filter((r) => !(r.request.endDate < startDate || r.request.startDate > endDate))
        .map((r) => ({
          employeeId: r.employee.id,
          fullName: r.employee.fullName,
          leaveType: r.request.leaveType,
          startDate: r.request.startDate,
          endDate: r.request.endDate,
          status: r.request.status,
        }));
    }
  }

  return {
    workingDays,
    calendarDays,
    balanceContext,
    overlappingTeammates,
    hasTeamData,
    note:
      "Dayflow has no configured public-holiday calendar, so working days are calculated as Monday–Friday only. If any of these dates are company holidays, factor that in manually.",
  };
}
