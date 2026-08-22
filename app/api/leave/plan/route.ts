import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler, ok } from "@/lib/api/handler";
import { requireSession } from "@/lib/auth/guards";
import { planLeave } from "@/lib/services/leave.service";

const schema = z.object({
  leaveType: z.enum(["PAID", "SICK", "UNPAID"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const session = await requireSession();
  const body = await req.json();
  const { leaveType, startDate, endDate } = schema.parse(body);
  const plan = await planLeave(session.employeeId, leaveType, startDate, endDate);
  return ok({ plan });
});
