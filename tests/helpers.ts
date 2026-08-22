import { BASE_URL, DEMO_PASSWORD } from "./config";

export interface Session {
  cookie: string;
  employeeId: string;
  role: "EMPLOYEE" | "HR";
  employeeCode: string;
}

export async function apiFetch(path: string, opts: (RequestInit & { cookie?: string }) = {}): Promise<Response> {
  // Don't force a JSON content-type over a FormData body (multipart upload
  // tests) — fetch sets the correct multipart boundary itself only when no
  // Content-Type header is present at all.
  const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (opts.cookie) headers["Cookie"] = opts.cookie;
  return fetch(BASE_URL + path, { ...opts, headers, redirect: "manual" as RequestRedirect });
}

function extractCookie(res: Response): string {
  const withGetSetCookie = res.headers as Headers & { getSetCookie?: () => string[] };
  const all = typeof withGetSetCookie.getSetCookie === "function" ? withGetSetCookie.getSetCookie() : [];
  const raw = all[0] ?? res.headers.get("set-cookie");
  if (!raw) throw new Error("Expected a Set-Cookie header in the response but found none.");
  return raw.split(";")[0];
}

export async function signIn(identifier: string, password: string = DEMO_PASSWORD): Promise<Session> {
  const res = await apiFetch("/api/auth/signin", { method: "POST", body: JSON.stringify({ identifier, password }) });
  if (!res.ok) throw new Error(`signIn(${identifier}) failed: ${res.status} ${await res.text()}`);
  const cookie = extractCookie(res);
  const body = await res.json();
  return { cookie, employeeId: body.user.employeeId, role: body.user.role, employeeCode: body.user.employeeCode };
}

let counter = 0;
export function uniqueCode(prefix = "TST"): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36).toUpperCase()}${counter}`;
}

/**
 * Full onboarding flow through the real HTTP API: sign up, follow the
 * dev-only email verification link (this suite always runs with
 * NODE_ENV=development, see global-setup.ts, so that link is present in the
 * signup response), then sign in. Used to get an isolated, disposable
 * employee for tests that shouldn't share state with the seeded demo
 * accounts (e.g. leave balance / concurrency tests).
 */
export async function createVerifiedEmployee(overrides: Partial<{ fullName: string; department: string; jobTitle: string; password: string }> = {}) {
  const employeeCode = uniqueCode("EMP");
  const email = `${employeeCode.toLowerCase()}@dayflow.test`;
  const password = overrides.password ?? "TestPass1";
  const signUpRes = await apiFetch("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({
      fullName: overrides.fullName ?? "Test Employee",
      employeeCode,
      email,
      password,
      department: overrides.department,
      jobTitle: overrides.jobTitle,
    }),
  });
  if (signUpRes.status !== 201) {
    throw new Error(`signup failed: ${signUpRes.status} ${await signUpRes.text()}`);
  }
  const signUpBody = await signUpRes.json();
  const link: string | undefined = signUpBody.devEmailVerificationLink;
  if (!link) throw new Error("Expected devEmailVerificationLink in signup response (NODE_ENV should be development in tests).");

  const verifyRes = await apiFetch(link);
  // The route redirects (30x) to /sign-in?verified=1|0 — we only care that
  // the request completed and did not error.
  if (verifyRes.status >= 400) throw new Error(`verify-email failed: ${verifyRes.status}`);

  const session = await signIn(employeeCode, password);
  return { ...session, email, employeeCode, password };
}
