import { db } from "@/lib/db/client";
import { payrollRecords } from "@/lib/db/schema";
import { newId } from "@/lib/utils/id";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { recordActivity } from "./activity.service";
import { createNotification } from "./notification.service";

/**
 * Dayflow does not implement a tax/PF/HRA calculation engine — no such
 * rules were supplied, and inventing them would mean presenting fabricated
 * statutory numbers as if they were real. HR enters basic salary,
 * allowances and deductions as flat, stored figures; net salary is a plain
 * arithmetic total of those stored values, not a computed statutory
 * result. Anything more (tax slabs, PF %, HRA rules) requires an actual
 * payroll policy to be provided and implemented deliberately — see README.
 */
export const upsertPayrollSchema = z.object({
  effectiveMonth: z.string().regex(/^\d{4}-\d{2}$/, "Expected format YYYY-MM."),
  currency: z.string().trim().min(1).max(10).default("INR"),
  basicSalary: z.number().min(0),
  allowances: z.number().min(0).default(0),
  deductions: z.number().min(0).default(0),
  notes: z.string().trim().max(500).optional(),
});
export type UpsertPayrollInput = z.infer<typeof upsertPayrollSchema>;

export async function getPublishedPayrollHistory(employeeId: string) {
  const rows = await db
    .select()
    .from(payrollRecords)
    .where(and(eq(payrollRecords.employeeId, employeeId), eq(payrollRecords.status, "PUBLISHED")))
    .orderBy(desc(payrollRecords.effectiveMonth));
  return rows;
}

export async function getLatestPublishedPayroll(employeeId: string) {
  const rows = await getPublishedPayrollHistory(employeeId);
  return rows[0] ?? null;
}

/** HR view: all records regardless of status, for management. */
export async function getAllPayrollForEmployee(employeeId: string) {
  return db.select().from(payrollRecords).where(eq(payrollRecords.employeeId, employeeId)).orderBy(desc(payrollRecords.effectiveMonth));
}

export async function getPayrollRecordById(id: string) {
  const rows = await db.select().from(payrollRecords).where(eq(payrollRecords.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function upsertPayrollRecord(hrEmployeeId: string, employeeId: string, input: UpsertPayrollInput) {
  const netSalary = Math.round((input.basicSalary + input.allowances - input.deductions) * 100) / 100;
  if (netSalary < 0) {
    throw ApiError.badRequest("Deductions cannot exceed basic salary plus allowances.");
  }

  const existing = await db
    .select()
    .from(payrollRecords)
    .where(and(eq(payrollRecords.employeeId, employeeId), eq(payrollRecords.effectiveMonth, input.effectiveMonth)))
    .limit(1);

  const now = new Date().toISOString();
  let id: string;
  if (existing[0]) {
    if (existing[0].status === "PUBLISHED") {
      throw ApiError.conflict("This payroll record has already been published and cannot be edited. Create a correction for a later month instead.");
    }
    id = existing[0].id;
    await db
      .update(payrollRecords)
      .set({ ...input, netSalary, updatedAt: now })
      .where(eq(payrollRecords.id, id));
  } else {
    id = newId("pay");
    await db.insert(payrollRecords).values({
      id,
      employeeId,
      effectiveMonth: input.effectiveMonth,
      currency: input.currency,
      basicSalary: input.basicSalary,
      allowances: input.allowances,
      deductions: input.deductions,
      netSalary,
      status: "DRAFT",
      notes: input.notes || null,
      createdBy: hrEmployeeId,
    });
  }

  await recordActivity({
    actorId: hrEmployeeId,
    action: "PAYROLL_UPDATED",
    entityType: "payroll_record",
    entityId: id,
    subjectEmployeeId: employeeId,
    metadata: { effectiveMonth: input.effectiveMonth, netSalary },
  });

  return getPayrollRecordById(id);
}

export async function publishPayrollRecord(hrEmployeeId: string, recordId: string) {
  const record = await getPayrollRecordById(recordId);
  if (!record) throw ApiError.notFound("Payroll record not found.");
  if (record.status === "PUBLISHED") {
    throw ApiError.conflict("This payroll record is already published.");
  }
  await db.update(payrollRecords).set({ status: "PUBLISHED", updatedAt: new Date().toISOString() }).where(eq(payrollRecords.id, recordId));

  await createNotification({
    recipientId: record.employeeId,
    type: "PAYROLL_AVAILABLE",
    title: "Payslip available",
    message: `Your payslip for ${record.effectiveMonth} is now available.`,
  });

  await recordActivity({
    actorId: hrEmployeeId,
    action: "PAYROLL_PUBLISHED",
    entityType: "payroll_record",
    entityId: recordId,
    subjectEmployeeId: record.employeeId,
    metadata: { effectiveMonth: record.effectiveMonth },
  });

  return getPayrollRecordById(recordId);
}
