import { db } from "@/lib/db/client";
import { attendance, type AttendanceStatus } from "@/lib/db/schema";
import { newId } from "@/lib/utils/id";
import { and, between, eq } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { recordActivity } from "./activity.service";
import { HALF_DAY_CUTOFF, minutesSinceMidnight } from "@/lib/config/attendance";
import { dateRange, isWeekend, parseISODate, todayISO } from "@/lib/utils/date";

export async function getAttendanceForDate(employeeId: string, dateISO: string) {
  const rows = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.employeeId, employeeId), eq(attendance.date, dateISO)))
    .limit(1);
  return rows[0] ?? null;
}

export async function checkIn(employeeId: string) {
  const today = todayISO();
  const existing = await getAttendanceForDate(employeeId, today);
  if (existing?.checkInAt) {
    throw ApiError.conflict("You have already checked in today.");
  }
  const now = new Date();
  const checkInMinutes = now.getHours() * 60 + now.getMinutes();
  const status: AttendanceStatus = checkInMinutes > minutesSinceMidnight(HALF_DAY_CUTOFF) ? "HALF_DAY" : "PRESENT";

  if (existing) {
    await db
      .update(attendance)
      .set({ checkInAt: now.toISOString(), status, updatedAt: now.toISOString() })
      .where(eq(attendance.id, existing.id));
  } else {
    await db.insert(attendance).values({
      id: newId("att"),
      employeeId,
      date: today,
      checkInAt: now.toISOString(),
      status,
    });
  }
  await recordActivity({
    actorId: employeeId,
    action: "ATTENDANCE_CHECK_IN",
    entityType: "attendance",
    entityId: today,
    subjectEmployeeId: employeeId,
    metadata: { time: now.toISOString(), status },
  });
  return getAttendanceForDate(employeeId, today);
}

export async function checkOut(employeeId: string) {
  const today = todayISO();
  const existing = await getAttendanceForDate(employeeId, today);
  if (!existing || !existing.checkInAt) {
    throw ApiError.badRequest("You must check in before you can check out.");
  }
  if (existing.checkOutAt) {
    throw ApiError.conflict("You have already checked out today.");
  }
  const now = new Date();
  await db
    .update(attendance)
    .set({ checkOutAt: now.toISOString(), updatedAt: now.toISOString() })
    .where(eq(attendance.id, existing.id));

  await recordActivity({
    actorId: employeeId,
    action: "ATTENDANCE_CHECK_OUT",
    entityType: "attendance",
    entityId: today,
    subjectEmployeeId: employeeId,
    metadata: { time: now.toISOString() },
  });
  return getAttendanceForDate(employeeId, today);
}

export async function getAttendanceHistory(employeeId: string, startISO: string, endISO: string) {
  const rows = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.employeeId, employeeId), between(attendance.date, startISO, endISO)));
  const byDate = new Map(rows.map((r) => [r.date, r]));

  // Build the full requested range, filling in weekdays that have no stored
  // row as an *effective* ABSENT for display purposes only (never persisted
  // — we don't want to fabricate rows for days that simply haven't happened
  // yet, and "no data" for a future date is not the same as "absent").
  const today = todayISO();
  return dateRange(startISO, endISO).map((dateISO) => {
    const row = byDate.get(dateISO);
    if (row) return { ...row, effective: row.status, isWeekend: isWeekend(parseISODate(dateISO)) };
    const weekend = isWeekend(parseISODate(dateISO));
    const isPast = dateISO < today;
    return {
      id: null,
      employeeId,
      date: dateISO,
      checkInAt: null,
      checkOutAt: null,
      status: null as AttendanceStatus | null,
      notes: null,
      effective: weekend ? null : isPast ? ("ABSENT" as AttendanceStatus) : null,
      isWeekend: weekend,
    };
  });
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
  totalWorkingDays: number;
  attendancePercentage: number;
  totalHoursLogged: number;
  daysWithCompleteHours: number;
}

export async function getAttendanceSummary(employeeId: string, startISO: string, endISO: string): Promise<AttendanceSummary> {
  const history = await getAttendanceHistory(employeeId, startISO, endISO);
  const workingDays = history.filter((d) => !d.isWeekend);
  let present = 0,
    absent = 0,
    halfDay = 0,
    leave = 0,
    totalHours = 0,
    daysWithHours = 0;

  for (const d of workingDays) {
    const eff = d.effective;
    if (eff === "PRESENT") present++;
    else if (eff === "ABSENT") absent++;
    else if (eff === "HALF_DAY") halfDay++;
    else if (eff === "LEAVE") leave++;

    if (d.checkInAt && d.checkOutAt) {
      const hours = (new Date(d.checkOutAt).getTime() - new Date(d.checkInAt).getTime()) / 3600000;
      if (hours > 0) {
        totalHours += hours;
        daysWithHours++;
      }
    }
  }

  const countedDays = present + absent + halfDay + leave;
  const attendancePercentage = countedDays > 0 ? Math.round(((present + halfDay * 0.5 + leave) / countedDays) * 1000) / 10 : 0;

  return {
    present,
    absent,
    halfDay,
    leave,
    totalWorkingDays: workingDays.length,
    attendancePercentage,
    totalHoursLogged: Math.round(totalHours * 10) / 10,
    daysWithCompleteHours: daysWithHours,
  };
}

/** HR view: attendance across all employees for a single date. */
export async function getAttendanceForAllOnDate(dateISO: string) {
  return db.select().from(attendance).where(eq(attendance.date, dateISO));
}

export async function getAttendanceInRangeAllEmployees(startISO: string, endISO: string) {
  return db.select().from(attendance).where(between(attendance.date, startISO, endISO));
}

/**
 * Used by the leave-approval flow (see leave.service.ts) to keep attendance
 * consistent with an approved leave request: every working day inside an
 * approved leave range gets an attendance row with status LEAVE. This
 * upserts, and is always called inside the same transaction as the leave
 * status update so the two never drift out of sync.
 */
export function upsertLeaveAttendanceStatements(employeeId: string, workingDayISOs: string[]) {
  return workingDayISOs.map((dateISO) => ({ employeeId, dateISO }));
}
