/**
 * Attendance business rules.
 *
 * These thresholds are NOT specified anywhere in the Dayflow requirements
 * document, so they are treated as configurable engineering defaults
 * (per operating rule 0.2: technical decisions get a documented, reasonable
 * default rather than a blocked implementation). They are centralized here,
 * in one place, rather than scattered as magic numbers through the UI or
 * API routes, and can be overridden via environment variables without a
 * code change.
 */

/** Expected start-of-day time, 24h "HH:MM". Used only to flag lateness for anomaly detection — it does not block check-in. */
export const WORKDAY_START = process.env.DAYFLOW_WORKDAY_START || "09:30";

/** Minutes after WORKDAY_START before a check-in is flagged "late" for anomaly detection. */
export const LATE_GRACE_MINUTES = Number(process.env.DAYFLOW_LATE_GRACE_MINUTES || 15);

/** Check-in after this time ("HH:MM") is recorded as a half-day rather than a full present day. */
export const HALF_DAY_CUTOFF = process.env.DAYFLOW_HALF_DAY_CUTOFF || "13:00";

/** A single day worked longer than this many hours is flagged for review (possible missed checkout / unusual pattern). */
export const LONG_DAY_HOURS_THRESHOLD = Number(process.env.DAYFLOW_LONG_DAY_HOURS_THRESHOLD || 12);

/** Number of late check-ins within a rolling 30-day window before "repeated lateness" is raised. */
export const REPEATED_LATE_THRESHOLD = Number(process.env.DAYFLOW_REPEATED_LATE_THRESHOLD || 3);

export function minutesSinceMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
