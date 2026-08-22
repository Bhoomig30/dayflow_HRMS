import { NextRequest } from "next/server";
import { withApiHandler, ok } from "@/lib/api/handler";
import { requireRole } from "@/lib/auth/guards";
import { listAllLeaveRequests } from "@/lib/services/leave.service";
import type { LeaveStatus } from "@/lib/db/schema";

/** HR-only: all leave requests across the company, optionally filtered by status. */
export const GET = withApiHandler(async (req: NextRequest) => {
  await requireRole("HR");
  const statusParam = req.nextUrl.searchParams.get("status") as LeaveStatus | null;
  const rows = await listAllLeaveRequests(statusParam ?? undefined);
  return ok({
    requests: rows.map((r) => ({ ...r.request, employeeName: r.employee.fullName, employeeCode: undefined })),
  });
});
