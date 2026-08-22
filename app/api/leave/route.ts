import { NextRequest } from "next/server";
import { withApiHandler, ok } from "@/lib/api/handler";
import { requireSession } from "@/lib/auth/guards";
import { listLeaveRequestsForEmployee, submitLeaveRequest, submitLeaveSchema } from "@/lib/services/leave.service";

export const GET = withApiHandler(async () => {
  const session = await requireSession();
  const requests = await listLeaveRequestsForEmployee(session.employeeId);
  return ok({ requests });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const session = await requireSession();
  const body = await req.json();
  const input = submitLeaveSchema.parse(body);
  const request = await submitLeaveRequest(session.employeeId, input);
  return ok({ request }, 201);
});
