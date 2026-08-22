import { NextRequest } from "next/server";
import { withApiHandler, ok } from "@/lib/api/handler";
import { requireOwnerOrHr, requireRole } from "@/lib/auth/guards";
import { getAllPayrollForEmployee, getPublishedPayrollHistory, upsertPayrollRecord, upsertPayrollSchema } from "@/lib/services/payroll.service";

/**
 * GET: owner sees only their PUBLISHED records; HR sees everything
 * (including drafts) for the employee they're managing.
 */
export const GET = withApiHandler(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  const session = await requireOwnerOrHr(id);
  const records = session.role === "HR" ? await getAllPayrollForEmployee(id) : await getPublishedPayrollHistory(id);
  return ok({ records });
});

/** HR-only: create or update a DRAFT payroll record for this employee (employees can never write payroll). */
export const POST = withApiHandler(async (req: NextRequest, ctx) => {
  const session = await requireRole("HR");
  const { id } = await ctx.params;
  const body = await req.json();
  const input = upsertPayrollSchema.parse(body);
  const record = await upsertPayrollRecord(session.employeeId, id, input);
  return ok({ record }, 201);
});
