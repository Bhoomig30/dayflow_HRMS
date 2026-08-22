// Covers the parts of the email-verification flow tests/auth.test.ts
// doesn't: single-use enforcement, expiry, and the resend-verification
// endpoint (including its anti-enumeration behavior). Mostly real HTTP
// requests against the running test server, same as auth.test.ts — the one
// exception is backdating a token's expiry, which (short of actually
// waiting DAYFLOW_EMAIL_VERIFICATION_TTL_MINUTES in real time) has no HTTP
// surface to trigger it, so that one step goes directly through the same
// db client the app itself uses, exactly like tests/ai-tools.unit.test.ts
// already does for the tool-execution layer. vitest.config.ts points this
// process at the same disposable test database as the spawned server.
import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { apiFetch, signIn, uniqueCode } from "./helpers";

async function signUpUnverified() {
  const employeeCode = uniqueCode("EMP");
  const email = `${employeeCode.toLowerCase()}@dayflow.test`;
  const password = "TestPass1";
  const res = await apiFetch("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ fullName: "Verification Tester", employeeCode, email, password }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.devEmailVerificationLink).toBeTruthy();
  return { employeeCode, email, password, link: body.devEmailVerificationLink as string };
}

describe("email verification: single-use", () => {
  it("a verification link works once; replaying the exact same link afterward fails", async () => {
    const { link, employeeCode, password } = await signUpUnverified();

    const first = await apiFetch(link);
    expect(first.headers.get("location")).toContain("verified=1");

    const replay = await apiFetch(link);
    expect(replay.headers.get("location")).toContain("verified=0");

    // The account really did get verified by the first (and only the
    // first) use — sign-in now succeeds.
    const session = await signIn(employeeCode, password);
    expect(session.employeeCode).toBe(employeeCode);
  });
});

describe("email verification: expiry", () => {
  it("an expired token is rejected and does not verify the account", async () => {
    const { link, employeeCode, password } = await signUpUnverified();

    // Backdate the token's expiry directly in the DB — the only way to
    // exercise real expiry without waiting out the TTL in wall-clock time.
    await db
      .update(users)
      .set({ emailVerificationExpiresAt: new Date(Date.now() - 60_000).toISOString() })
      .where(eq(users.employeeCode, employeeCode));

    const verifyRes = await apiFetch(link);
    expect(verifyRes.headers.get("location")).toContain("verified=0");

    const signInRes = await apiFetch("/api/auth/signin", { method: "POST", body: JSON.stringify({ identifier: employeeCode, password }) });
    expect(signInRes.status).toBe(401);
    const body = await signInRes.json();
    expect(body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });
});

describe("email verification: resend", () => {
  it("issues a working new link for a genuinely unverified account, invalidating the old one", async () => {
    const { link: oldLink, employeeCode, email, password } = await signUpUnverified();

    // Signup itself already issued a token moments ago, so an immediate
    // resend would otherwise be blocked by the resend cooldown (covered by
    // its own test below) — push the recorded issuance time back outside
    // the cooldown window the same way the expiry test backdates it, so
    // this test can exercise "resend succeeds" independently of "resend is
    // cooldown-limited" without a real wall-clock wait.
    await db
      .update(users)
      .set({ emailVerificationExpiresAt: new Date(Date.now() + 1_000).toISOString() })
      .where(eq(users.employeeCode, employeeCode));

    const resendRes = await apiFetch("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ identifier: email }) });
    expect(resendRes.status).toBe(200);
    const resendBody = await resendRes.json();
    expect(resendBody.devEmailVerificationLink).toBeTruthy();
    expect(resendBody.devEmailVerificationLink).not.toBe(oldLink);

    // The old (pre-resend) link no longer verifies the account.
    const oldLinkRes = await apiFetch(oldLink);
    expect(oldLinkRes.headers.get("location")).toContain("verified=0");

    // The new link does, and sign-in then works.
    const newLinkRes = await apiFetch(resendBody.devEmailVerificationLink);
    expect(newLinkRes.headers.get("location")).toContain("verified=1");
    const session = await signIn(employeeCode, password);
    expect(session.employeeCode).toBe(employeeCode);
  });

  it("responds identically for a nonexistent account and an already-verified seeded account (no enumeration)", async () => {
    const nonexistentRes = await apiFetch("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ identifier: "no-such-account@dayflow.test" }),
    });
    const verifiedRes = await apiFetch("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ identifier: "EMP1001" }), // seeded, already verified
    });

    expect(nonexistentRes.status).toBe(verifiedRes.status);
    const [nonexistentBody, verifiedBody] = await Promise.all([nonexistentRes.json(), verifiedRes.json()]);
    expect(nonexistentBody).toEqual(verifiedBody);
    expect(nonexistentBody.devEmailVerificationLink).toBeUndefined();
  });

  it("does not rotate the token again within the resend cooldown", async () => {
    const { email } = await signUpUnverified(); // signup itself issues the first token

    const secondRes = await apiFetch("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ identifier: email }) });
    expect(secondRes.status).toBe(200);
    const secondBody = await secondRes.json();
    // Still within DAYFLOW_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS of
    // signup's own token issuance, so no new token — and therefore no dev
    // link — is produced by this immediate second call.
    expect(secondBody.devEmailVerificationLink).toBeUndefined();
  });
});