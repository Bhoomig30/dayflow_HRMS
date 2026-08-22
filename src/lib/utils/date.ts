/**
 * Date helpers. Dayflow has no configured public-holiday calendar, so
 * "working day" here means Monday–Friday only. This is a deliberate,
 * documented simplification (see README "Known limitations") — we never
 * invent a holiday calendar.
 */

export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Inclusive list of ISO dates between start and end. */
export function dateRange(startISO: string, endISO: string): string[] {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Count weekday (Mon-Fri) dates between start and end, inclusive. */
export function countWorkingDays(startISO: string, endISO: string): number {
  return dateRange(startISO, endISO).filter((iso) => !isWeekend(parseISODate(iso))).length;
}

export function daysBetweenInclusive(startISO: string, endISO: string): number {
  return dateRange(startISO, endISO).length;
}

export function currentYear(): number {
  return new Date().getFullYear();
}
