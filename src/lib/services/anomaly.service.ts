import { db } from "@/lib/db/client";
import { attendance, employees } from "@/lib/db/schema";
import { eq, gte } from "drizzle-orm";
import {
  HALF_DAY_CUTOFF,
  LATE_GRACE_MINUTES,
  LONG_DAY_HOURS_THRESHOLD,
  REPEATED_LATE_THRESHOLD,
  WORKDAY_START,
  minutesSinceMidnight,
} from "@/lib/config/attendance";
import { toISODate } from "@/lib/utils/date";

/**
 * Explainable, rule-based attendance anomaly detection.
 *
 * This is intentionally NOT machine learning — every anomaly below carries
 * the exact rule, the raw dates, and the source records that triggered it,
 * so an HR reviewer can verify it directly rather than trusting an opaque
 * score. If a statistical/ML model is added later, it should plug in
 * alongside these rules (same output shape) rather than replacing this
 * explainability.
 */

export type AnomalySeverity = "LOW" | "MEDIUM" | "HIGH";

export interface AttendanceAnomaly {
  id: string;
  type: "REPEATED_LATE" | "MISSING_CHECKOUT" | "LONG_WORKING_HOURS" | "FREQUENT_HALF_DAYS";
  employeeId: string;
  employeeName: string;
  reason: string;
  dates: string[];
  severity: AnomalySeverity;
  sourceData: Record<string, unknown>;
}

const lateThresholdMinutes = minutesSinceMidnight(WORKDAY_START) + LATE_GRACE_MINUTES;

function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

export async function detectAnomaliesForWindow(windowDays = 30): Promise<AttendanceAnomaly[]> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceISO = toISODate(since);
  const todayISOValue = toISODate(new Date());

  const rows = await db
    .select({ attendance: attendance, employee: employees })
    .from(attendance)
    .innerJoin(employees, eq(attendance.employeeId, employees.id))
    .where(gte(attendance.date, sinceISO));

  const byEmployee = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byEmployee.get(row.employee.id) ?? [];
    list.push(row);
    byEmployee.set(row.employee.id, list);
  }

  const anomalies: AttendanceAnomaly[] = [];

  for (const [employeeId, records] of byEmployee.entries()) {
    const employeeName = records[0].employee.fullName;

    // Rule 1: repeated late check-ins
    const lateDates = records
      .filter((r) => r.attendance.checkInAt && minutesOfDay(r.attendance.checkInAt) > lateThresholdMinutes)
      .map((r) => r.attendance.date)
      .sort();
    if (lateDates.length >= REPEATED_LATE_THRESHOLD) {
      anomalies.push({
        id: `late_${employeeId}`,
        type: "REPEATED_LATE",
        employeeId,
        employeeName,
        reason: `Checked in after ${WORKDAY_START} (+${LATE_GRACE_MINUTES}m grace) on ${lateDates.length} day(s) in the last ${windowDays} days.`,
        dates: lateDates,
        severity: lateDates.length >= REPEATED_LATE_THRESHOLD * 2 ? "HIGH" : "MEDIUM",
        sourceData: { threshold: WORKDAY_START, graceMinutes: LATE_GRACE_MINUTES, count: lateDates.length },
      });
    }

    // Rule 2: missing checkout on past days
    const missingCheckoutDates = records
      .filter((r) => r.attendance.checkInAt && !r.attendance.checkOutAt && r.attendance.date < todayISOValue)
      .map((r) => r.attendance.date)
      .sort();
    if (missingCheckoutDates.length > 0) {
      anomalies.push({
        id: `missed_checkout_${employeeId}`,
        type: "MISSING_CHECKOUT",
        employeeId,
        employeeName,
        reason: `Checked in but never checked out on ${missingCheckoutDates.length} day(s).`,
        dates: missingCheckoutDates,
        severity: missingCheckoutDates.length >= 3 ? "HIGH" : "MEDIUM",
        sourceData: { count: missingCheckoutDates.length },
      });
    }

    // Rule 3: unusually long working hours
    const longDays = records
      .filter((r) => r.attendance.checkInAt && r.attendance.checkOutAt)
      .map((r) => ({
        date: r.attendance.date,
        hours: (new Date(r.attendance.checkOutAt!).getTime() - new Date(r.attendance.checkInAt!).getTime()) / 3600000,
      }))
      .filter((d) => d.hours >= LONG_DAY_HOURS_THRESHOLD);
    if (longDays.length > 0) {
      anomalies.push({
        id: `long_day_${employeeId}`,
        type: "LONG_WORKING_HOURS",
        employeeId,
        employeeName,
        reason: `Logged ${LONG_DAY_HOURS_THRESHOLD}+ working hours on ${longDays.length} day(s) — worth checking for a missed checkout or unusual workload.`,
        dates: longDays.map((d) => d.date),
        severity: "LOW",
        sourceData: { threshold: LONG_DAY_HOURS_THRESHOLD, days: longDays },
      });
    }

    // Rule 4: frequent half-days
    const halfDays = records.filter((r) => r.attendance.status === "HALF_DAY").map((r) => r.attendance.date);
    if (halfDays.length >= 3) {
      anomalies.push({
        id: `half_days_${employeeId}`,
        type: "FREQUENT_HALF_DAYS",
        employeeId,
        employeeName,
        reason: `Checked in after ${HALF_DAY_CUTOFF} on ${halfDays.length} day(s), each recorded as a half-day.`,
        dates: halfDays.sort(),
        severity: "LOW",
        sourceData: { cutoff: HALF_DAY_CUTOFF, count: halfDays.length },
      });
    }
  }

  const severityRank: Record<AnomalySeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return anomalies.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

export async function detectAnomaliesForEmployee(employeeId: string, windowDays = 30): Promise<AttendanceAnomaly[]> {
  const all = await detectAnomaliesForWindow(windowDays);
  return all.filter((a) => a.employeeId === employeeId);
}
