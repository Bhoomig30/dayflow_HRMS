import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";
import { newId } from "@/lib/utils/id";
import { and, eq } from "drizzle-orm";
import { ApiError } from "@/lib/api/errors";
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/config/documents";
import { recordActivity } from "./activity.service";
import { getEmployeeById } from "./employee.service";

/** True if `resolved` is STORAGE_ROOT itself or strictly inside it — never a same-prefix sibling like "STORAGE_ROOT-evil". */
function isInsideStorageRoot(resolved: string): boolean {
  const root = path.resolve(/*turbopackIgnore: true*/ STORAGE_ROOT);
  return resolved === root || resolved.startsWith(root + path.sep);
}

// Documents are stored OUTSIDE of /public specifically so they cannot be
// fetched by guessing a URL — every read goes through the authorized
// download API route (api/documents/[id]/route.ts), which re-checks
// ownership/role before streaming the file.
const STORAGE_ROOT = process.env.DAYFLOW_DOCUMENT_STORAGE_DIR || path.join(process.cwd(), "data", "documents");

// The `/*turbopackIgnore: true*/` markers below tell the bundler's static
// analyzer not to trace the whole project through these dynamic fs calls —
// STORAGE_ROOT is a plain server-side path under ./data, never bundled or
// exposed to the client, so there's nothing here for the bundler to trace.
function ensureStorageDir() {
  if (!fs.existsSync(/*turbopackIgnore: true*/ STORAGE_ROOT)) fs.mkdirSync(/*turbopackIgnore: true*/ STORAGE_ROOT, { recursive: true });
}

export async function saveDocument(params: {
  employeeId: string;
  uploadedBy: string;
  fileName: string;
  fileType: string;
  buffer: Buffer;
}) {
  if (!ALLOWED_DOCUMENT_TYPES.includes(params.fileType)) {
    throw ApiError.badRequest("Unsupported file type. Allowed: PDF, PNG, JPEG, DOC, DOCX.");
  }
  if (params.buffer.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
    throw ApiError.badRequest(`File is too large. Maximum size is ${Math.round(MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024))}MB.`);
  }
  // Defense in depth: the route layer's requireOwnerOrHr(employeeId) already
  // ensures the caller is either this employeeId or HR, but for an HR
  // caller that check passes for ANY employeeId string HR supplies —
  // including one that was never a real employee record and, absent this
  // check, would flow straight into the storage path built below.
  // Confirming the employee actually exists closes that off and rejects a
  // mistaken/nonexistent employeeId with a clear error instead of silently
  // writing a file no one can ever look up.
  const employee = await getEmployeeById(params.employeeId);
  if (!employee) {
    throw ApiError.notFound("Employee not found.");
  }
  ensureStorageDir();

  const id = newId("doc");
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `${params.employeeId}/${id}_${safeName}`;
  const fullPath = path.join(/*turbopackIgnore: true*/ STORAGE_ROOT, storageKey);
  // Same path-traversal defense as the download path (readDocumentFile
  // below): even though employeeId is expected to be a safe generated ID
  // and the filename is already character-whitelisted above, resolving and
  // re-checking the final path means a write can never land outside the
  // storage directory no matter what produced storageKey.
  const resolved = path.resolve(fullPath);
  if (!isInsideStorageRoot(resolved)) {
    throw ApiError.badRequest("Invalid document reference.");
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, params.buffer);

  await db.insert(documents).values({
    id,
    employeeId: params.employeeId,
    name: params.fileName,
    fileType: params.fileType,
    fileSize: params.buffer.byteLength,
    storageKey,
    uploadedBy: params.uploadedBy,
  });

  await recordActivity({
    actorId: params.uploadedBy,
    action: "DOCUMENT_UPLOADED",
    entityType: "document",
    entityId: id,
    subjectEmployeeId: params.employeeId,
    metadata: { name: params.fileName, fileType: params.fileType },
  });

  return getDocumentById(id);
}

export async function listDocumentsForEmployee(employeeId: string) {
  return db.select().from(documents).where(eq(documents.employeeId, employeeId));
}

export async function getDocumentById(id: string) {
  const rows = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return rows[0] ?? null;
}

export function readDocumentFile(storageKey: string): Buffer {
  const fullPath = path.join(/*turbopackIgnore: true*/ STORAGE_ROOT, storageKey);
  const resolved = path.resolve(fullPath);
  if (!isInsideStorageRoot(resolved)) {
    // Defense in depth against path traversal via a malformed storageKey.
    throw ApiError.badRequest("Invalid document reference.");
  }
  return fs.readFileSync(resolved);
}

// Not currently wired to any API route (no document-delete endpoint exists
// in this build) — kept consistent with the same path defense as the other
// two file-touching functions above in case a delete route is added later.
export async function deleteDocument(id: string, employeeId: string) {
  const doc = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.employeeId, employeeId))).limit(1);
  if (!doc[0]) throw ApiError.notFound("Document not found.");
  const fullPath = path.join(/*turbopackIgnore: true*/ STORAGE_ROOT, doc[0].storageKey);
  const resolved = path.resolve(fullPath);
  if (isInsideStorageRoot(resolved) && fs.existsSync(resolved)) fs.unlinkSync(resolved);
  await db.delete(documents).where(eq(documents.id, id));
}
