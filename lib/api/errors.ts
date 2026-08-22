/**
 * Typed application error carrying an HTTP status code. Route handlers catch
 * this (see api/handler.ts) and turn it into a predictable, safe JSON error
 * response — never a raw stack trace.
 */
export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }

  static unauthorized(message = "You must be signed in to do this.") {
    return new ApiError(401, "UNAUTHENTICATED", message);
  }
  static forbidden(message = "You do not have permission to do this.") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static notFound(message = "The requested resource was not found.") {
    return new ApiError(404, "NOT_FOUND", message);
  }
  static badRequest(message = "The request was invalid.") {
    return new ApiError(400, "BAD_REQUEST", message);
  }
  static conflict(message = "This conflicts with existing data.") {
    return new ApiError(409, "CONFLICT", message);
  }
}
