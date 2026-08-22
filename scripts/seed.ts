/**
 * Dayflow demo seed script.
 *
 * Populates a small, coherent demo dataset — clearly demo data, not real
 * records — so the application can be evaluated end to end. Run with:
 *
 *   npm run seed
 *
 * Safe to re-run: it skips creating anything that already exists.
 */
import { db, rawDb } from "../src/lib/db/client";
import { attendance, employees, leaveRequests, payrollRecords, users } from "../src/lib/db/schema";
import { newId } from "../src/lib/utils/id";
import { hashPassword } from "../src/lib/auth/password";
import { createEmployeeProfile, ensureDepartment } from "../src/lib/services/employee.service";
import { ensureLeaveBalances, approveLeaveRequest, rejectLeaveRequest, submitLeaveRequest } from "../src/lib/services/leave.service";
import { upsertPayrollRecord, publishPayrollRecord } from "../src/lib/services/payroll.service";
import { recordActivity } from "../src/lib/services/activity.service";
import { createNotification } from "../src/lib/services/notification.service";
import { eq } from "drizzle-orm";
import { toISODate } from "../src/lib/utils/date";

const DEMO_PASSWORD = "Demo@1234";

async function userExists(email: string): Promise<boolean> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows.length > 0;
}

async function createAccount(params: {
  employeeCode: string;
  email: string;
  fullName: string;
  role: "EMPLOYEE" | "HR";
  departmentName: string;
  jobTitle: string;
  dateOfJoining: string;
}) {
  if (await userExists(params.email)) {
    console.log(`  · ${params.email} already exists, skipping`);
    const existing = await db.select().from(users).where(eq(users.email, params.email)).limit(1);
    const emp = await db.select().from(employees).where(eq(employees.userId, existing[0].id)).limit(1);
    return emp[0].id;
  }
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const userId = newId("usr");
  await db.insert(users).values({
    id: userId,
    employeeCode: params.employeeCode,
    email: params.email,
    passwordHash,
    role: params.role,
    emailVerified: true,
  });
  const departmentId = await ensureDepartment(params.departmentName);
  const employeeId = await createEmployeeProfile({
    userId,
    fullName: params.fullName,
    departmentId,
    jobTitle: params.jobTitle,
    dateOfJoining: params.dateOfJoining,
  });
  await ensureLeaveBalances(employeeId);
  await recordActivity({
    actorId: employeeId,
    action: "EMPLOYEE_CREATED",
    entityType: "employee",
    entityId: employeeId,
    subjectEmployeeId: employeeId,
    metadata: { via: "seed" },
  });
  console.log(`  · created ${params.fullName} (${params.employeeCode})`);
  return employeeId;
}

/** The date `n` business days (Mon-Fri) after today — guarantees a weekday regardless of what today is. */
function businessDaysFromToday(n: number): string {
  const d = new Date();
  let count = 0;
  while (count < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return toISODate(d);
}

/**
 * The last `n` business days (Mon-Fri) strictly before today, oldest first.
 * Building the demo attendance data off an explicit weekday list — rather
 * than raw "N calendar days ago" offsets — guarantees the intended number
 * of late/absent/half-day occurrences actually land regardless of which
 * real-world weekday the seed script happens to run on, and keeps every
 * occurrence inside the anomaly detector's 30-calendar-day window.
 */
function lastBusinessDays(n: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  while (days.length < n) {
    cursor.setDate(cursor.getDate() - 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days.push(new Date(cursor));
  }
  return days.reverse(); // oldest first
}

function atTime(date: Date, hour: number, minute: number): string {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

async function seedAttendanceRow(
  employeeId: string,
  date: Date,
  opts: { checkIn?: [number, number]; checkOut?: [number, number]; status: "PRESENT" | "ABSENT" | "HALF_DAY"; notes?: string }
) {
  const dateISO = toISODate(date);
  const existing = await db.select().from(attendance).where(eq(attendance.employeeId, employeeId)).limit(1000);
  if (existing.some((r) => r.date === dateISO)) return;

  await db.insert(attendance).values({
    id: newId("att"),
    employeeId,
    date: dateISO,
    checkInAt: opts.checkIn ? atTime(date, opts.checkIn[0], opts.checkIn[1]) : null,
    checkOutAt: opts.checkOut ? atTime(date, opts.checkOut[0], opts.checkOut[1]) : null,
    status: opts.status,
    notes: opts.notes || null,
  });
}

async function main() {
  console.log("Seeding Dayflow demo data...\n");

  console.log("Departments & accounts:");
  const hrId = await createAccount({
    employeeCode: "HR001",
    email: "hr@dayflow.demo",
    fullName: "Priya Sharma",
    role: "HR",
    departmentName: "People Ops",
    jobTitle: "HR Manager",
    dateOfJoining: "2022-01-10",
  });

  const aditya = await createAccount({
    employeeCode: "EMP1001",
    email: "aditya@dayflow.demo",
    fullName: "Aditya Rao",
    role: "EMPLOYEE",
    departmentName: "Engineering",
    jobTitle: "Software Engineer",
    dateOfJoining: "2023-03-14",
  });
  const sara = await createAccount({
    employeeCode: "EMP1002",
    email: "sara@dayflow.demo",
    fullName: "Sara Khan",
    role: "EMPLOYEE",
    departmentName: "Engineering",
    jobTitle: "Senior Software Engineer",
    dateOfJoining: "2021-07-01",
  });
  const marcus = await createAccount({
    employeeCode: "EMP1003",
    email: "marcus@dayflow.demo",
    fullName: "Marcus Chen",
    role: "EMPLOYEE",
    departmentName: "Sales",
    jobTitle: "Account Executive",
    dateOfJoining: "2022-11-20",
  });
  const fatima = await createAccount({
    employeeCode: "EMP1004",
    email: "fatima@dayflow.demo",
    fullName: "Fatima Ali",
    role: "EMPLOYEE",
    departmentName: "Sales",
    jobTitle: "Sales Manager",
    dateOfJoining: "2020-05-18",
  });
  const diego = await createAccount({
    employeeCode: "EMP1005",
    email: "diego@dayflow.demo",
    fullName: "Diego Alvarez",
    role: "EMPLOYEE",
    departmentName: "Engineering",
    jobTitle: "QA Engineer",
    dateOfJoining: "2023-09-05",
  });
  const neha = await createAccount({
    employeeCode: "EMP1006",
    email: "neha@dayflow.demo",
    fullName: "Neha Verma",
    role: "EMPLOYEE",
    departmentName: "People Ops",
    jobTitle: "Recruiter",
    dateOfJoining: toISODate(new Date(Date.now() - 6 * 86400000)),
  });

  // Give most employees contact details so their profiles read as complete;
  // Neha is deliberately left incomplete to demonstrate the "attention required" flow.
  console.log("\nContact details:");
  for (const [id, phone, address] of [
    [aditya, "+91 90000 10001", "12 MG Road, Bengaluru"],
    [sara, "+91 90000 10002", "45 Indiranagar, Bengaluru"],
    [marcus, "+1 415 555 0102", "88 Market St, San Francisco"],
    [fatima, "+1 415 555 0134", "230 Mission St, San Francisco"],
    [diego, "+1 415 555 0177", "19 Valencia St, San Francisco"],
  ] as const) {
    await db.update(employees).set({ phone, address, emergencyContactName: "On file", emergencyContactPhone: "On file" }).where(eq(employees.id, id));
  }
  console.log("  · done");

console.log("\nAttendance (last 20 business days):");
  const businessDays = lastBusinessDays(20);
  const fatimaLeaveIndices = new Set([14, 15, 16]); // 3 consecutive business days, seeded as approved leave below

  for (let i = 0; i < businessDays.length; i++) {
    const date = businessDays[i];

    // Sara: model employee, always on time.
    await seedAttendanceRow(sara, date, { checkIn: [9, 20], checkOut: [18, 5], status: "PRESENT" });

    // Aditya: on time except 4 late check-ins (triggers the repeated-lateness anomaly) + one missing checkout.
    if (i === 9) {
      await seedAttendanceRow(aditya, date, { checkIn: [9, 25], status: "PRESENT", notes: "seed: missing checkout" });
    } else {
      const late = [2, 7, 12, 17].includes(i);
      await seedAttendanceRow(aditya, date, { checkIn: late ? [10, 5] : [9, 28], checkOut: [18, 15], status: "PRESENT" });
    }

    // Marcus: a few unexplained absences (no row at all) + one very long day.
    const marcusAbsent = [4, 10, 16].includes(i);
    if (!marcusAbsent) {
      await seedAttendanceRow(marcus, date, { checkIn: [9, 35], checkOut: i === 13 ? [22, 40] : [18, 30], status: "PRESENT" });
    }

    // Fatima: present outside her approved leave window (seeded separately below).
    if (!fatimaLeaveIndices.has(i)) {
      await seedAttendanceRow(fatima, date, { checkIn: [9, 15], checkOut: [17, 50], status: "PRESENT" });
    }

    // Diego: 4 half-days from checking in after the half-day cutoff (triggers the frequent-half-days anomaly).
    const diegoHalf = [1, 6, 11, 18].includes(i);
    await seedAttendanceRow(
      diego,
      date,
      diegoHalf ? { checkIn: [13, 30], checkOut: [18, 0], status: "HALF_DAY" } : { checkIn: [9, 40], checkOut: [18, 0], status: "PRESENT" }
    );

    // Neha: only joined a few business days ago.
    if (i >= 16) {
      await seedAttendanceRow(neha, date, { checkIn: [9, 45], checkOut: [17, 45], status: "PRESENT" });
    }
  }
  console.log("  · done");

  console.log("\nLeave requests:");
  // Fatima: an already-approved past PAID leave (seeded directly, then approved through the real service so attendance/notifications/activity all update consistently).
  const fatimaLeaveDays = [...fatimaLeaveIndices].sort((a, b) => a - b).map((i) => businessDays[i]);
  const fatimaLeaveStart = toISODate(fatimaLeaveDays[0]);
  const fatimaLeaveEnd = toISODate(fatimaLeaveDays[fatimaLeaveDays.length - 1]);
  const existingFatimaLeave = await db.select().from(leaveRequests).where(eq(leaveRequests.employeeId, fatima)).limit(50);
  if (existingFatimaLeave.length === 0) {
    const leaveId = newId("lv");
    await db.insert(leaveRequests).values({
      id: leaveId,
      employeeId: fatima,
      leaveType: "PAID",
      startDate: fatimaLeaveStart,
      endDate: fatimaLeaveEnd,
      workingDays: 3,
      remarks: "Family event (seed data)",
      status: "PENDING",
    });
    await approveLeaveRequest(hrId, leaveId, "Approved — enjoy your time off.");
    console.log("  · Fatima: approved past leave (attendance synced)");

    // Sara: a rejected request.
    const rejected = await submitLeaveRequest(sara, { leaveType: "SICK", startDate: businessDaysFromToday(2), endDate: businessDaysFromToday(2), remarks: "Feeling unwell (seed data)" });
    await rejectLeaveRequest(hrId, rejected!.id, "Please submit with a bit more notice next time.");
    console.log("  · Sara: rejected leave");

    // Aditya & Marcus: pending requests awaiting HR review (guaranteed future weekdays).
    await submitLeaveRequest(aditya, { leaveType: "PAID", startDate: businessDaysFromToday(5), endDate: businessDaysFromToday(6), remarks: "Long weekend trip (seed data)" });
    await submitLeaveRequest(marcus, { leaveType: "UNPAID", startDate: businessDaysFromToday(8), endDate: businessDaysFromToday(8), remarks: "Personal errand (seed data)" });
    console.log("  · Aditya & Marcus: pending requests");
  } else {
    console.log("  · leave requests already exist, skipping");
  }

  console.log("\nPayroll:");
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const payrollPlan: [string, number, number, number][] = [
    [aditya, 95000, 8000, 4200],
    [sara, 140000, 12000, 6800],
    [marcus, 80000, 6000, 3100],
    [fatima, 130000, 11000, 6200],
  ];
  for (const [empId, basic, allowances, deductions] of payrollPlan) {
    for (const month of [lastMonth, thisMonth]) {
      const existing = await db.select().from(payrollRecords).where(eq(payrollRecords.employeeId, empId)).limit(50);
      if (existing.some((r) => r.effectiveMonth === month)) continue;
      const record = await upsertPayrollRecord(hrId, empId, { effectiveMonth: month, currency: "INR", basicSalary: basic, allowances, deductions });
      await publishPayrollRecord(hrId, record!.id);
    }
  }
  // Diego: one unpublished draft, to demonstrate the draft -> publish flow live in the demo.
  const diegoExisting = await db.select().from(payrollRecords).where(eq(payrollRecords.employeeId, diego)).limit(10);
  if (diegoExisting.length === 0) {
    await upsertPayrollRecord(hrId, diego, { effectiveMonth: thisMonth, currency: "INR", basicSalary: 72000, allowances: 5000, deductions: 2600, notes: "Pending HR review before publishing (seed data)" });
  }
  console.log("  · done (Neha and Diego's current month intentionally left without a published payslip)");

  console.log("\nWelcome notification:");
  for (const empId of [aditya, sara, marcus, fatima, diego, neha]) {
    await createNotification({
      recipientId: empId,
      type: "ANNOUNCEMENT",
      title: "Welcome to Dayflow (demo)",
      message: "This is a demo environment. All data shown is sample data for evaluation purposes.",
    });
  }
  console.log("  · done");

  console.log("\nDemo accounts (password for all: " + DEMO_PASSWORD + "):");
  console.log("  HR:       HR001 / hr@dayflow.demo");
  console.log("  Employee: EMP1001 / aditya@dayflow.demo");
  console.log("  Employee: EMP1002 / sara@dayflow.demo");
  console.log("  Employee: EMP1003 / marcus@dayflow.demo");
  console.log("  Employee: EMP1004 / fatima@dayflow.demo");
  console.log("  Employee: EMP1005 / diego@dayflow.demo (has an unpublished draft payslip)");
  console.log("  Employee: EMP1006 / neha@dayflow.demo (incomplete profile, no payroll yet)");

  rawDb.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
