import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiHandler, ok } from "@/lib/api/handler";
import { requireRole, requireSession } from "@/lib/auth/guards";
import { ensureDepartment, listDepartments } from "@/lib/services/employee.service";
import { getDepartmentDistribution } from "@/lib/services/analytics.service";

export const GET = withApiHandler(async () => {
  await requireSession();
  const [departments, distribution] = await Promise.all([listDepartments(), getDepartmentDistribution()]);
  const counts = new Map(distribution.map((d) => [d.department, d.count]));
  return ok({ departments: departments.map((d) => ({ ...d, employeeCount: counts.get(d.name) ?? 0 })) });
});

const createSchema = z.object({ name: z.string().trim().min(2).max(80) });

/** HR-only: create a department. */
export const POST = withApiHandler(async (req: NextRequest) => {
  await requireRole("HR");
  const body = await req.json();
  const { name } = createSchema.parse(body);
  const id = await ensureDepartment(name);
  return ok({ id, name }, 201);
});
