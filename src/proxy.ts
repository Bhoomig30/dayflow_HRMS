import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up"];

/**
 * Route-level gate for PAGES. This is a UX convenience (avoids flashing a
 * protected page before redirecting) — it is NOT the security boundary.
 * Every API route independently re-checks auth/role/ownership via
 * lib/auth/guards.ts, because a client can always hit the API directly.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!session && !isPublic) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (session && (pathname === "/sign-in" || pathname === "/sign-up")) {
    return NextResponse.redirect(new URL(session.role === "HR" ? "/hr" : "/dashboard", req.url));
  }

  if (session && pathname.startsWith("/hr") && session.role !== "HR") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // scripts/ holds standalone Node dev-tooling (seeding, visual QA
    // screenshots) that isn't part of the shipped Next.js app and isn't run
    // through its module system — plain CommonJS is appropriate there, not
    // an app-wide lint exemption.
    "scripts/**",
  ]),
]);

export default eslintConfig;
