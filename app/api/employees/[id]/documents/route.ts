import { NextRequest } from "next/server";
import { withApiHandler, ok } from "@/lib/api/handler";
import { requireOwnerOrHr } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api/errors";
import { listDocumentsForEmployee, saveDocument } from "@/lib/services/document.service";

export const GET = withApiHandler(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  await requireOwnerOrHr(id);
  const docs = await listDocumentsForEmployee(id);
  return ok({ documents: docs });
});

/** Owner or HR may upload a document to an employee's file. */
export const POST = withApiHandler(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  const session = await requireOwnerOrHr(id);

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw ApiError.badRequest("No file provided.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const doc = await saveDocument({
    employeeId: id,
    uploadedBy: session.employeeId,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    buffer,
  });
  return ok({ document: doc }, 201);
});
