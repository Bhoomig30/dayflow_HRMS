import { db } from "@/lib/db/client";
import { attendance, departments, employees, leaveRequests } from "@/lib/db/schema";
import { eq, gte } from "drizzle-orm";
import { todayISO, toISODate } from "@/lib/utils/date";
import { LATE_GRACE_MINUTES, WORKDAY_START, minutesSinceMidnight } from "@/lib/config/attendance";
import { profileCompleteness } from "./employee.service";
import { detectAnomaliesForWindow } from "./anomaly.service";

/**
 * All figures here are computed directly from stored rows at request time —
 * nothing is cached-and-drifted, nothing is a placeholder number. Where the
 * underlying data doesn't exist yet (e.g. no departments assigned), the
 * function returns an empty array/zero rather than inventing a chart.
 */

export async function getHrOverview() {
  const today = todayISO();
  const activeEmployees = (await db.select().from(employees).where(eq(employees.employmentStatus, "ACTIVE")));
  const totalEmployees = activeEmployees.length;

  const todaysAttendance = await db.select().from(attendance).where(eq(attendance.date, today));
  const presentToday = todaysAttendance.filter((a) => a.status === "PRESENT").length;
  const halfDayToday = todaysAttendance.filter((a) => a.status === "HALF_DAY").length;
  const onLeaveToday = todaysAttendance.filter((a) => a.status === "LEAVE").length;
  const isWeekendToday = [0, 6].includes(new Date().getDay());
  const accountedFor = new Set(todaysAttendance.map((a) => a.employeeId));
  const absentToday = isWeekendToday ? 0 : Math.max(0, totalEmployees - accountedFor.size);

  const pending = await db.select().from(leaveRequests).where(eq(leaveRequests.status, "PENDING"));

  const incompleteProfiles = activeEmployees.filter((e) => !profileCompleteness(e).complete);
  const anomalies = await detectAnomaliesForWindow(30);

  const attentionItems: { type: string; label: string; count: number }[] = [];
  if (pending.length > 0) attentionItems.push({ type: "PENDING_LEAVE", label: "Pending leave requests", count: pending.length });
  if (incompleteProfiles.length > 0) attentionItems.push({ type: "INCOMPLETE_PROFILE", label: "Incomplete employee profiles", count: incompleteProfiles.length });
  if (anomalies.length > 0) attentionItems.push({ type: "ATTENDANCE_ANOMALY", label: "Attendance anomalies flagged", count: anomalies.length });

  return {
    totalEmployees,
    presentToday,
    halfDayToday,
    onLeaveToday,
    absentToday,
    pendingLeaveRequests: pending.length,
    attentionItems,
    isWeekendToday,
  };
}

export async function getAttendanceTrend(days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceISO = toISODate(since);

  const rows = await db.select().from(attendance).where(gte(attendance.date, sinceISO));
  const byDate = new Map<string, { present: number; absent: number; halfDay: number; leave: number }>();

  for (const r of rows) {
    const bucket = byDate.get(r.date) ?? { present: 0, absent: 0, halfDay: 0, leave: 0 };
    if (r.status === "PRESENT") bucket.present++;
    else if (r.status === "ABSENT") bucket.absent++;
    else if (r.status === "HALF_DAY") bucket.halfDay++;
    else if (r.status === "LEAVE") bucket.leave++;
    byDate.set(r.date, bucket);
  }

  const out: { date: string; present: number; absent: number; halfDay: number; leave: number }[] = [];
  const cur = new Date(since);
  const end = new Date();
  while (cur <= end) {
    const iso = toISODate(cur);
    const weekend = [0, 6].includes(cur.getDay());
    if (!weekend) {
      const bucket = byDate.get(iso) ?? { present: 0, absent: 0, halfDay: 0, leave: 0 };
      out.push({ date: iso, ...bucket });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export async function getDepartmentDistribution() {
  const depts = await db.select().from(departments);
  const emps = await db.select().from(employees).where(eq(employees.employmentStatus, "ACTIVE"));
  if (depts.length === 0) return [];
  return depts
    .map((d) => ({ department: d.name, count: emps.filter((e) => e.departmentId === d.id).length }))
    .filter((d) => d.count > 0);
}

export async function getLeaveTypeUtilization(year: number) {
  const rows = await db.select().from(leaveRequests).where(eq(leaveRequests.status, "APPROVED"));
  const inYear = rows.filter((r) => r.startDate.startsWith(String(year)));
  const types: Record<string, { approvedWorkingDays: number; requestCount: number }> = {};
  for (const r of inYear) {
    types[r.leaveType] ??= { approvedWorkingDays: 0, requestCount: 0 };
    types[r.leaveType].approvedWorkingDays += r.workingDays;
    types[r.leaveType].requestCount += 1;
  }
  return Object.entries(types).map(([leaveType, v]) => ({ leaveType, ...v }));
}

export async function getLateArrivalTrend(weeks = 8) {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  const sinceISO = toISODate(since);
  const rows = await db.select().from(attendance).where(gte(attendance.date, sinceISO));
  const thresholdMinutes = minutesSinceMidnight(WORKDAY_START) + LATE_GRACE_MINUTES;

  const byWeek = new Map<string, number>();
  for (const r of rows) {
    if (!r.checkInAt) continue;
    const d = new Date(r.checkInAt);
    const minutes = d.getHours() * 60 + d.getMinutes();
    if (minutes <= thresholdMinutes) continue;
    // ISO week start (Monday)
    const weekStart = new Date(r.date);
    const day = weekStart.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    weekStart.setDate(weekStart.getDate() + diff);
    const key = toISODate(weekStart);
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1);
  }
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([weekStart, lateCount]) => ({ weekStart, lateCount }));
}

export async function getSalaryOverview() {
  const { payrollRecords } = await import("@/lib/db/schema");
  const rows = await db.select().from(payrollRecords).where(eq(payrollRecords.status, "PUBLISHED"));
  if (rows.length === 0) return null;
  const totalNet = rows.reduce((s, r) => s + r.netSalary, 0);
  const byMonth = new Map<string, number>();
  for (const r of rows) byMonth.set(r.effectiveMonth, (byMonth.get(r.effectiveMonth) ?? 0) + r.netSalary);
  return {
    recordCount: rows.length,
    averageNet: Math.round((totalNet / rows.length) * 100) / 100,
    byMonth: Array.from(byMonth.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 })),
  };
}
