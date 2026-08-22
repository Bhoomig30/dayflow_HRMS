import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { verifyEmail } from "@/lib/services/auth.service";

export const GET = withApiHandler(async (req: NextRequest) => {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/sign-in?error=missing_token", req.url));
  }
  try {
    await verifyEmail(token);
    // No session exists at this point (signup no longer creates one) — send
    // the user to sign in rather than a protected page.
    return NextResponse.redirect(new URL("/sign-in?verified=1", req.url));
  } catch {
    return NextResponse.redirect(new URL("/sign-in?verified=0", req.url));
  }
});
