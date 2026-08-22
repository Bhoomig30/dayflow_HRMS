import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { requireOwnerOrHr } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api/errors";
import { getDocumentById, readDocumentFile } from "@/lib/services/document.service";

/** Ownership is re-checked here, not inferred from the URL — this is the guard against IDOR on document downloads. */
export const GET = withApiHandler(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  const doc = await getDocumentById(id);
  if (!doc) throw ApiError.notFound("Document not found.");
  await requireOwnerOrHr(doc.employeeId);

  const buffer = readDocumentFile(doc.storageKey);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.fileType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.name)}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
});
