export const MAX_DOCUMENT_SIZE_BYTES = Number(process.env.DAYFLOW_MAX_DOCUMENT_SIZE_BYTES ?? 5 * 1024 * 1024); // 5MB default
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
