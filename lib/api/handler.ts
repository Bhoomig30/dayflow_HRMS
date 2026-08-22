import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./errors";

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>;

/**
 * Wraps a route handler with consistent error handling so we never leak a
 * raw stack trace or internal error message to the client. Every API route
 * in Dayflow is wrapped with this.
 */
export function withApiHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Some fields were invalid.",
              details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
            },
          },
          { status: 400 }
        );
      }
      // A malformed request body (invalid JSON, or empty body where JSON was
      // expected) is a client input error, not a server fault — every route
      // here calls `await req.json()` before validating with Zod, and a
      // parse failure throws a plain SyntaxError at that point rather than
      // reaching Zod at all. Without this, it would fall through to the
      // generic 500 below, which is both misleading (nothing on the server
      // actually broke) and inconsistent with how every other validation
      // failure in this app is reported.
      if (err instanceof SyntaxError) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "The request body is not valid JSON." } },
          { status: 400 }
        );
      }
      console.error("[api] unhandled error:", err);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
        { status: 500 }
      );
    }
  };
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
